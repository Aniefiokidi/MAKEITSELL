import { NextRequest, NextResponse } from "next/server"
import { getBookingsByProvider, getAllBookings, getBookingsByCustomer, createBooking, getUserById } from "@/lib/mongodb-operations"
import { AppointmentEmailService } from "@/lib/appointment-emails"
import { getServiceById } from "@/lib/mongodb-operations"
import { applyLocationPricing } from "@/lib/service-pricing"
import { getIcsBusyRanges, hasBusyOverlap } from "@/lib/calendar-sync"
import { connectToDatabase } from "@/lib/mongodb"
import { User as UserModel } from "@/lib/models/User"
import { WalletTransaction } from "@/lib/models/WalletTransaction"
import { normalizeNigerianPhone, sendBookingConfirmationSms } from "@/lib/sms"

const BOOKING_FEE_NAIRA = 500

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId')
    const customerId = searchParams.get('customerId')

    let bookings
    if (providerId) {
      bookings = await getBookingsByProvider(providerId)
    } else if (customerId) {
      // Fetch bookings for a specific customer
      bookings = await getBookingsByCustomer(customerId)
    } else {
      bookings = await getAllBookings()
    }

    return NextResponse.json({
      success: true,
      data: bookings
    })
  } catch (error) {
    console.error('Bookings API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let bookingFeeCharged = false
  let bookingFeeReference = ''
  let bookingFeeCustomerId = ''

  try {
    const rangesOverlap = (startA: Date, endA: Date, startB: Date, endB: Date) => {
      return startA < endB && endA > startB
    }

    const toLocalDateKey = (value: Date) => {
      const year = value.getFullYear()
      const month = String(value.getMonth() + 1).padStart(2, '0')
      const day = String(value.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const bookingData = await request.json()
    const paymentMethod = String(bookingData?.paymentMethod || 'wallet').trim().toLowerCase()

    if (paymentMethod !== 'wallet') {
      return NextResponse.json(
        { success: false, error: 'Service bookings support wallet payment only.' },
        { status: 400 }
      )
    }

    const service = bookingData?.serviceId ? await getServiceById(String(bookingData.serviceId)) : null
    const numericEstimated = Number(bookingData?.estimatedPrice)
    const numericFinal = Number(bookingData?.finalPrice)
    const numericTotal = Number(bookingData?.totalPrice)
    const requiresQuote = Boolean(bookingData?.requiresQuote)

    const normalizedEstimated = Number.isFinite(numericEstimated)
      ? numericEstimated
      : (Number.isFinite(numericTotal) ? numericTotal : 0)
    const normalizedFinal = Number.isFinite(numericFinal)
      ? numericFinal
      : (requiresQuote ? null : normalizedEstimated)
    const normalizedTotal = Number.isFinite(numericTotal)
      ? numericTotal
      : (Number.isFinite(normalizedFinal as any) ? Number(normalizedFinal) : normalizedEstimated)

    const baseEstimated = Number.isFinite(normalizedEstimated) ? normalizedEstimated : 0
    const customerLocation = typeof bookingData?.customerLocation === 'string' ? bookingData.customerLocation.trim() : ''
    const tripDistanceMiles = Number(bookingData?.tripDistanceMiles)
    const normalizedTripDistanceMiles = Number.isFinite(tripDistanceMiles) && tripDistanceMiles > 0
      ? tripDistanceMiles
      : 0
    const locationPricing = await applyLocationPricing({
      basePrice: baseEstimated,
      customerLocation,
      serviceLocation: typeof service?.location === 'string' ? service.location : undefined,
      locationPricingRules: Array.isArray((service as any)?.locationPricingRules) ? (service as any).locationPricingRules : [],
      distanceRatePerMile: Number((service as any)?.distanceRatePerMile || 0),
      tripDistanceMiles: normalizedTripDistanceMiles,
    })

    const locationAdjustedTotal = Math.max(0, Math.round(locationPricing.total))
    const quoteSlaHours = Number((service as any)?.quoteSlaHours || 24)

    const normalizedBookingData = {
      ...bookingData,
      paymentMethod: 'wallet',
      estimatedPrice: locationAdjustedTotal,
      finalPrice: normalizedFinal,
      totalPrice: requiresQuote ? locationAdjustedTotal : (Number.isFinite(normalizedTotal) ? normalizedTotal : locationAdjustedTotal),
      pricingStatus: bookingData?.pricingStatus || (requiresQuote ? 'estimated' : 'accepted'),
      requiresQuote,
      selectedAddOns: Array.isArray(bookingData?.selectedAddOns) ? bookingData.selectedAddOns : [],
      customerLocation,
      tripDistanceMiles: normalizedTripDistanceMiles > 0 ? normalizedTripDistanceMiles : undefined,
      serviceAddress: typeof service?.location === 'string' ? service.location : bookingData?.serviceAddress,
      cancellationPolicyPercent: Number((service as any)?.cancellationPolicyPercent || 30),
      cancellationWindowHours: Number((service as any)?.cancellationWindowHours || 24),
      bookingFeeAmount: BOOKING_FEE_NAIRA,
      bookingFeeStatus: 'pending',
      quoteExpiresAt: requiresQuote ? new Date(Date.now() + quoteSlaHours * 60 * 60 * 1000) : null,
    }

    const stayDetails = bookingData?.stayDetails && typeof bookingData.stayDetails === 'object'
      ? bookingData.stayDetails
      : null
    const hasStayBooking = Boolean(stayDetails?.checkInDate && stayDetails?.checkOutDate)

    if (hasStayBooking) {
      const checkInDate = new Date(stayDetails.checkInDate)
      const checkOutDate = new Date(stayDetails.checkOutDate)
      const nights = Math.max(1, Number(stayDetails.nights || 1))
      const requestedRooms = Math.max(1, Number(stayDetails.rooms || 1))

      if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
        return NextResponse.json(
          { success: false, error: 'Invalid check-in/check-out date range' },
          { status: 400 }
        )
      }

      const roomTypeId = String(stayDetails.roomTypeId || bookingData?.selectedPackageId || '')
      if (!roomTypeId) {
        return NextResponse.json(
          { success: false, error: 'Missing room type for stay booking' },
          { status: 400 }
        )
      }

      const roomTypes = Array.isArray((service as any)?.hospitalityDetails?.roomTypes)
        ? (service as any).hospitalityDetails.roomTypes
        : []
      const roomType = roomTypes.find((item: any) => String(item?.id || '') === roomTypeId)
      const totalRoomsInType = Math.max(0, Number(roomType?.roomCount || 0))
      if (totalRoomsInType <= 0) {
        return NextResponse.json(
          { success: false, error: 'Selected room type is currently unavailable' },
          { status: 409 }
        )
      }

      const existingBookings = await getBookingsByProvider(String(bookingData?.providerId || ''))
      const alreadyBookedRooms = existingBookings
        .filter((item: any) => {
          if (!item || item.status === 'cancelled') return false
          const stay = item?.stayDetails
          if (!stay?.checkInDate || !stay?.checkOutDate) return false
          if (String(stay?.roomTypeId || '') !== roomTypeId) return false
          const existingCheckIn = new Date(stay.checkInDate)
          const existingCheckOut = new Date(stay.checkOutDate)
          if (Number.isNaN(existingCheckIn.getTime()) || Number.isNaN(existingCheckOut.getTime())) return false
          return rangesOverlap(checkInDate, checkOutDate, existingCheckIn, existingCheckOut)
        })
        .reduce((sum: number, item: any) => sum + Math.max(0, Number(item?.stayDetails?.rooms || 1)), 0)

      const remainingRooms = Math.max(0, totalRoomsInType - alreadyBookedRooms)
      if (requestedRooms > remainingRooms) {
        return NextResponse.json(
          {
            success: false,
            error: remainingRooms > 0
              ? `Only ${remainingRooms} room(s) available for selected dates.`
              : 'Selected room type is fully booked for these dates.',
          },
          { status: 409 }
        )
      }

      normalizedBookingData.stayDetails = {
        ...stayDetails,
        roomTypeId,
        roomTypeName: stayDetails.roomTypeName || roomType?.name || bookingData?.selectedPackageName || 'Room',
        rooms: requestedRooms,
        checkInDate,
        checkOutDate,
        nights,
      }
      normalizedBookingData.bookingDate = checkInDate
      normalizedBookingData.startTime = typeof bookingData?.startTime === 'string' ? bookingData.startTime : '14:00'
      normalizedBookingData.endTime = typeof bookingData?.endTime === 'string' ? bookingData.endTime : '12:00'
      normalizedBookingData.duration = Number.isFinite(Number(bookingData?.duration))
        ? Number(bookingData.duration)
        : nights * 24 * 60
    }
    
    // 1. Check for double-booking prevention
    const { providerId, bookingDate, startTime, endTime } = normalizedBookingData
    
    if (!providerId || !bookingDate || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields for booking validation' },
        { status: 400 }
      )
    }
    
    if (!hasStayBooking) {
      // Get existing bookings for this provider on the same date
      const existingBookings = await getBookingsByProvider(providerId)

      // Convert booking date to string for comparison (YYYY-MM-DD format)
      const requestedDate = toLocalDateKey(new Date(bookingDate))

      // Check for time conflicts
      const conflictingBooking = existingBookings.find(booking => {
        if (!booking.bookingDate) return false

        const existingDate = toLocalDateKey(new Date(booking.bookingDate))

        // Only check bookings on the same date that aren't cancelled
        if (existingDate !== requestedDate || booking.status === 'cancelled') {
          return false
        }

        // Convert time strings to minutes for comparison
        const parseTime = (timeStr: string) => {
          const [hours, minutes] = timeStr.split(':').map(Number)
          return hours * 60 + minutes
        }

        const requestStart = parseTime(startTime)
        const requestEnd = parseTime(endTime)
        const existingStart = parseTime(booking.startTime)
        const existingEnd = parseTime(booking.endTime)

        // Check for overlap: new booking starts before existing ends AND new booking ends after existing starts
        return requestStart < existingEnd && requestEnd > existingStart
      })

      if (conflictingBooking) {
        return NextResponse.json(
          {
            success: false,
            error: 'This time slot is already booked. Please choose a different time.',
            conflictingBooking: {
              date: conflictingBooking.bookingDate,
              startTime: conflictingBooking.startTime,
              endTime: conflictingBooking.endTime,
              serviceTitle: conflictingBooking.serviceTitle
            }
          },
          { status: 409 } // Conflict status
        )
      }
    }

    // 1b. External calendar conflict check (Google/Outlook ICS feed).
    const icsUrl = typeof (service as any)?.externalCalendarIcsUrl === 'string'
      ? String((service as any).externalCalendarIcsUrl).trim()
      : ''
    const isCalendarSyncEnabled = Boolean((service as any)?.calendarSyncEnabled) && Boolean(icsUrl)

    if (isCalendarSyncEnabled && !hasStayBooking) {
      const [startHour, startMinute] = String(startTime).split(':').map(Number)
      const [endHour, endMinute] = String(endTime).split(':').map(Number)
      const bookingDateObj = new Date(bookingDate)
      const requestStart = new Date(bookingDateObj)
      requestStart.setHours(startHour, startMinute, 0, 0)
      const requestEnd = new Date(bookingDateObj)
      requestEnd.setHours(endHour, endMinute, 0, 0)

      const busyRanges = await getIcsBusyRanges({
        icsUrl,
        from: requestStart,
        to: requestEnd,
      })

      if (hasBusyOverlap({ busyRanges, start: requestStart, end: requestEnd })) {
        return NextResponse.json(
          {
            success: false,
            error: 'Provider calendar shows this slot as unavailable. Please select another time.',
          },
          { status: 409 }
        )
      }
    }
    
    // 2. Charge booking fee before creating booking.
    await connectToDatabase()
    bookingFeeCustomerId = String(normalizedBookingData.customerId || '')
    if (!bookingFeeCustomerId) {
      return NextResponse.json(
        { success: false, error: 'Missing customer account for booking fee charge' },
        { status: 400 }
      )
    }

    const chargeResult = await UserModel.updateOne(
      { _id: bookingFeeCustomerId, walletBalance: { $gte: BOOKING_FEE_NAIRA } },
      {
        $inc: { walletBalance: -BOOKING_FEE_NAIRA },
        $set: { updatedAt: new Date() },
      }
    )

    if (chargeResult.modifiedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient wallet balance. You need ₦${BOOKING_FEE_NAIRA.toLocaleString('en-NG')} to place a booking.`,
        },
        { status: 402 }
      )
    }

    bookingFeeCharged = true
    bookingFeeReference = `booking_fee_${bookingFeeCustomerId}_${Date.now()}`

    await WalletTransaction.create({
      userId: bookingFeeCustomerId,
      type: 'purchase_debit',
      amount: BOOKING_FEE_NAIRA,
      status: 'completed',
      reference: bookingFeeReference,
      provider: 'internal_wallet',
      note: 'Service booking fee',
      metadata: {
        serviceId: normalizedBookingData.serviceId,
        providerId: normalizedBookingData.providerId,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    normalizedBookingData.bookingFeeStatus = 'charged'
    normalizedBookingData.bookingFeeReference = bookingFeeReference

    // 3. Create the booking (no conflicts found)
    const booking = await createBooking(normalizedBookingData)
    
    // 4. Send notifications
    try {
      // Get provider email
      const provider = await getUserById(providerId)
      const providerEmail = String(provider?.email || '').trim()

      const emailPayload = {
        bookingId: booking.id,
        customerName: normalizedBookingData.customerName,
        customerEmail: normalizedBookingData.customerEmail,
        customerPhone: normalizedBookingData.customerPhone,
        providerName: normalizedBookingData.providerName,
        providerEmail,
        serviceTitle: normalizedBookingData.serviceTitle,
        bookingDate: new Date(normalizedBookingData.bookingDate),
        startTime: normalizedBookingData.startTime,
        endTime: normalizedBookingData.endTime,
        duration: normalizedBookingData.duration || 60,
        location: normalizedBookingData.location,
        locationType: normalizedBookingData.locationType || 'in-person',
        totalPrice: normalizedBookingData.totalPrice,
        status: normalizedBookingData.status || 'pending',
        notes: normalizedBookingData.notes,
      } as const

      if (String(normalizedBookingData.customerEmail || '').trim()) {
        await AppointmentEmailService.sendCustomerBookingConfirmation(emailPayload as any)
      }
      if (providerEmail) {
        await AppointmentEmailService.sendProviderBookingNotification(emailPayload as any)
      }

      const customerPhone = normalizeNigerianPhone(normalizedBookingData.customerPhone || '')
      if (customerPhone) {
        await sendBookingConfirmationSms({
          phoneNumber: customerPhone,
          bookingId: booking.id,
          serviceTitle: normalizedBookingData.serviceTitle,
          bookingDate: new Date(normalizedBookingData.bookingDate),
          startTime: normalizedBookingData.startTime,
          endTime: normalizedBookingData.endTime,
          totalPrice: Number(normalizedBookingData.totalPrice || 0),
          recipient: 'customer',
        })
      }

      const providerPhone = normalizeNigerianPhone((provider as any)?.phone_number || (provider as any)?.phone || '')
      if (providerPhone) {
        await sendBookingConfirmationSms({
          phoneNumber: providerPhone,
          bookingId: booking.id,
          serviceTitle: normalizedBookingData.serviceTitle,
          bookingDate: new Date(normalizedBookingData.bookingDate),
          startTime: normalizedBookingData.startTime,
          endTime: normalizedBookingData.endTime,
          totalPrice: Number(normalizedBookingData.totalPrice || 0),
          recipient: 'provider',
          counterpartyName: normalizedBookingData.customerName,
        })
      }

      console.log('✅ Booking notifications dispatched')
    } catch (emailError) {
      console.error('❌ Email notification failed:', emailError)
      // Don't fail the booking creation if email fails
    }
    
    return NextResponse.json({
      success: true,
      id: booking?.id,
      data: booking,
      message: `Booking created successfully. ₦${BOOKING_FEE_NAIRA.toLocaleString('en-NG')} booking fee charged.`
    }, { status: 201 })
  } catch (error: any) {
    console.error('Create booking error:', error)

    if (bookingFeeCharged && bookingFeeCustomerId) {
      try {
        await connectToDatabase()
        await UserModel.updateOne(
          { _id: bookingFeeCustomerId },
          {
            $inc: { walletBalance: BOOKING_FEE_NAIRA },
            $set: { updatedAt: new Date() },
          }
        )

        if (bookingFeeReference) {
          await WalletTransaction.updateOne(
            { reference: bookingFeeReference },
            {
              $set: {
                status: 'failed',
                note: 'Service booking fee refunded due to booking failure',
                updatedAt: new Date(),
              },
            }
          )
        }
      } catch (rollbackError) {
        console.error('Booking fee rollback failed:', rollbackError)
      }
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create booking' },
      { status: 500 }
    )
  }
}