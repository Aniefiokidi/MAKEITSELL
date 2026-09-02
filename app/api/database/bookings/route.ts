import { NextRequest, NextResponse } from "next/server"
import { getBookingsByProvider, getAllBookings, getBookingsByCustomer, getUserById } from "@/lib/mongodb-operations"
import { AppointmentEmailService } from "@/lib/appointment-emails"
import { getServiceById } from "@/lib/mongodb-operations"
import { applyLocationPricing } from "@/lib/service-pricing"
import { getIcsBusyRanges, hasBusyOverlap } from "@/lib/calendar-sync"
import { sendBookingConfirmationSms } from "@/lib/sms"
import { getSessionUserFromRequest } from "@/lib/server-route-auth"
import { initiateBookingPayment } from "@/lib/booking-payment"
import { findBookingSlotConflict } from "@/lib/booking-availability"
import { getCanonicalAppBaseUrl } from "@/lib/app-url"

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId')
    const customerId = searchParams.get('customerId')
    const isAdmin = sessionUser.role === 'admin'

    // Non-admins can only ever read their own bookings, either side — this used to
    // accept any customerId/providerId from the query string with no session check at
    // all, and returned every booking in the system (including customer names/addresses)
    // when neither was given.
    if (!isAdmin) {
      if (providerId && providerId !== sessionUser.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
      if (customerId && customerId !== sessionUser.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
      if (!providerId && !customerId) {
        return NextResponse.json({ success: false, error: 'customerId or providerId is required' }, { status: 400 })
      }
    }

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
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const rangesOverlap = (startA: Date, endA: Date, startB: Date, endB: Date) => {
      return startA < endB && endA > startB
    }

    const bookingData = await request.json()

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
      // Always the caller's own session — never trust customerId from the body. Payment
      // now goes through Paystack (lib/booking-payment.ts), which does confirm
      // independently, but this still matters: it's what the confirmation email/SMS and
      // the provider's booking record are addressed to.
      customerId: sessionUser.id,
      customerName: bookingData?.customerName || sessionUser.name,
      customerEmail: bookingData?.customerEmail || sessionUser.email,
      estimatedPrice: locationAdjustedTotal,
      finalPrice: normalizedFinal,
      totalPrice: requiresQuote ? locationAdjustedTotal : (Number.isFinite(normalizedTotal) ? normalizedTotal : locationAdjustedTotal),
      pricingStatus: bookingData?.pricingStatus || (requiresQuote ? 'estimated' : 'accepted'),
      requiresQuote,
      selectedAddOns: Array.isArray(bookingData?.selectedAddOns) ? bookingData.selectedAddOns : [],
      customerLocation,
      tripDistanceMiles: normalizedTripDistanceMiles > 0 ? normalizedTripDistanceMiles : undefined,
      serviceAddress: typeof service?.location === 'string' ? service.location : bookingData?.serviceAddress,
      // Same fallback pattern as serviceAddress above: the client (BookingModal.tsx)
      // always sends this, but a caller that omits it should fall back to the service's
      // own duration rather than hit a raw Mongoose "duration is required" 500.
      duration: Number.isFinite(Number(bookingData?.duration))
        ? Number(bookingData.duration)
        : (Number.isFinite(Number((service as any)?.duration)) ? Number((service as any).duration) : undefined),
      cancellationPolicyPercent: Number((service as any)?.cancellationPolicyPercent || 30),
      cancellationWindowHours: Number((service as any)?.cancellationWindowHours || 24),
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
      // lib/booking-availability.ts — one implementation, also called again inside
      // lib/booking-payment.ts right before the booking is actually created. Checking
      // here too isn't redundant: it lets this route fail fast with the full
      // conflictingBooking detail below before doing any pricing/Paystack work.
      const conflictingBooking = await findBookingSlotConflict({ providerId, bookingDate, startTime, endTime })

      if (conflictingBooking) {
        return NextResponse.json(
          {
            success: false,
            error: 'This time slot is already booked. Please choose a different time.',
            conflictingBooking,
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
    
    // 2 & 3. Create the booking — lib/booking-payment.ts. Services aren't monetized, so
    // requiresPayment is always false on the result now regardless of requiresQuote;
    // branch on the local requiresQuote instead to tell "fee-free, awaiting a quote" apart
    // from "fixed-price, already confirmed" (initiateBookingPayment confirms + sends its
    // own notifications for that case internally now — see lib/booking-payment.ts).
    // Re-checks the slot conflict internally too (see lib/booking-availability.ts's
    // comment on why that's still not fully race-proof).
    const appBaseUrl = getCanonicalAppBaseUrl(new URL(request.url).origin)
    const paymentResult = await initiateBookingPayment(normalizedBookingData, {
      callbackUrl: `${appBaseUrl}/api/payments/booking-verify`,
    })

    if (!paymentResult.success) {
      return NextResponse.json({ success: false, error: paymentResult.error }, { status: paymentResult.status })
    }

    if (requiresQuote) {
      // Created fee-free, exactly as before, awaiting a quote. Send the "booking request
      // received" notifications immediately, same as always; this path's timing hasn't
      // changed, only the (now-removed) fee has.
      try {
        const provider = await getUserById(providerId)
        const providerEmail = String(provider?.email || '').trim()

        const emailPayload = {
          bookingId: paymentResult.bookingId,
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
          status: 'pending',
          notes: normalizedBookingData.notes,
        } as const

        if (String(normalizedBookingData.customerEmail || '').trim()) {
          await AppointmentEmailService.sendCustomerBookingConfirmation(emailPayload as any)
        }
        if (providerEmail) {
          await AppointmentEmailService.sendProviderBookingNotification(emailPayload as any)
        }
        if (String(normalizedBookingData.customerPhone || '').trim()) {
          await sendBookingConfirmationSms({
            phoneNumber: String(normalizedBookingData.customerPhone || '').trim(),
            bookingId: paymentResult.bookingId,
            serviceTitle: String(normalizedBookingData.serviceTitle || '').trim(),
            bookingDate: new Date(normalizedBookingData.bookingDate),
            startTime: String(normalizedBookingData.startTime || '').trim(),
            endTime: String(normalizedBookingData.endTime || '').trim(),
            totalPrice: Number(normalizedBookingData.totalPrice || 0),
            recipient: 'customer',
            status: 'pending',
          })
        }
        console.log('✅ Booking-request notifications dispatched (requiresQuote)')
      } catch (emailError) {
        console.error('❌ Email notification failed:', emailError)
      }

      return NextResponse.json({
        success: true,
        id: paymentResult.bookingId,
        requiresPayment: false,
        message: 'Booking request submitted — awaiting a quote from the provider.',
      }, { status: 201 })
    }

    // Fixed-price path — already confirmed at this point; initiateBookingPayment claimed
    // it as paid internally (via lib/booking-payment-confirmation.ts's handleBookingPaid),
    // which also sent the customer/provider confirmation email + SMS. Nothing left to do
    // here but report success.
    return NextResponse.json({
      success: true,
      id: paymentResult.bookingId,
      requiresPayment: false,
      message: 'Booking confirmed.',
    }, { status: 201 })
  } catch (error: any) {
    console.error('Create booking error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create booking' },
      { status: 500 }
    )
  }
}
