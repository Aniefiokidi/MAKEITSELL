import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Booking as BookingModel } from "@/lib/models/Booking"
import { User as UserModel } from "@/lib/models/User"
import { WalletTransaction } from "@/lib/models/WalletTransaction"
import { computeCancellationFee } from "@/lib/service-pricing"
import { getServiceById } from "@/lib/mongodb-operations"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const data = await request.json()

    await connectToDatabase()

    const existingBooking = await BookingModel.findById(id).lean()
    if (!existingBooking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      )
    }

    const updatePayload: Record<string, unknown> = {}
    const actionType = typeof data.actionType === 'string' ? data.actionType.trim() : ''
    const requestedStatus = typeof data.status === 'string' ? data.status.trim() : ''
    const requestedPricingStatus = typeof data.pricingStatus === 'string' ? data.pricingStatus.trim() : ''
    const existingPricingStatus = String((existingBooking as any).pricingStatus || '')
    const requiresQuote =
      typeof data.requiresQuote === 'boolean'
        ? data.requiresQuote
        : Boolean((existingBooking as any).requiresQuote)

    const allowedStatuses = new Set(['pending', 'confirmed', 'completed', 'cancelled'])
    const allowedPricingStatuses = new Set(['estimated', 'quoted', 'accepted'])

    if (actionType && actionType !== 'cancel' && actionType !== 'reschedule') {
      return NextResponse.json(
        { success: false, error: 'Invalid actionType value' },
        { status: 400 }
      )
    }

    if (requestedStatus && !allowedStatuses.has(requestedStatus)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status value' },
        { status: 400 }
      )
    }

    if (requestedPricingStatus && !allowedPricingStatuses.has(requestedPricingStatus)) {
      return NextResponse.json(
        { success: false, error: 'Invalid pricingStatus value' },
        { status: 400 }
      )
    }

    if (requiresQuote) {
      const hasExistingFinalPrice = Number.isFinite(Number((existingBooking as any).finalPrice))
      const hasIncomingFinalPrice = data.finalPrice === null ? false : Number.isFinite(Number(data.finalPrice))

      if (requestedPricingStatus === 'accepted' && !hasExistingFinalPrice && !hasIncomingFinalPrice) {
        return NextResponse.json(
          { success: false, error: 'Cannot accept quote without a final quoted price' },
          { status: 409 }
        )
      }

      if (requestedStatus === 'confirmed' && requestedPricingStatus !== 'accepted' && existingPricingStatus !== 'accepted') {
        return NextResponse.json(
          { success: false, error: 'Quote-required bookings can only be confirmed after quote acceptance' },
          { status: 409 }
        )
      }

      if (requestedPricingStatus === 'quoted' && !hasIncomingFinalPrice) {
        return NextResponse.json(
          { success: false, error: 'A final price is required when setting pricingStatus to quoted' },
          { status: 409 }
        )
      }

      if (requestedPricingStatus === 'quoted') {
        const service = await getServiceById(String((existingBooking as any).serviceId || ''))
        const quoteSlaHours = Number((service as any)?.quoteSlaHours || 24)
        updatePayload.quoteSentAt = new Date()
        updatePayload.quoteExpiresAt = new Date(Date.now() + Math.max(1, quoteSlaHours) * 60 * 60 * 1000)
      }
    }

    if (actionType === 'cancel') {
      const bookingDate = new Date((existingBooking as any).bookingDate)
      const startTime = String((existingBooking as any).startTime || '00:00')
      const amount = Number((existingBooking as any).finalPrice ?? (existingBooking as any).totalPrice ?? 0)
      const policyPercent = Number((existingBooking as any).cancellationPolicyPercent || 30)
      const windowHours = Number((existingBooking as any).cancellationWindowHours || 24)

      const feeResult = computeCancellationFee({
        bookingDate,
        startTime,
        amount,
        policyPercent,
        windowHours,
      })

      updatePayload.status = 'cancelled'
      updatePayload.cancelledAt = new Date()
      updatePayload.cancellationReason = typeof data.reason === 'string' ? data.reason.trim() : ''
      updatePayload.cancellationFeeApplied = feeResult.shouldCharge
      updatePayload.cancellationFeeAmount = feeResult.feeAmount
      updatePayload.cancellationFeeStatus = feeResult.shouldCharge ? 'pending' : 'none'

      const customerId = String((existingBooking as any).customerId || '')
      const reference = `cancel_fee_${id}`
      if (feeResult.shouldCharge && customerId) {
        const chargeResult = await UserModel.updateOne(
          { _id: customerId, walletBalance: { $gte: feeResult.feeAmount } },
          {
            $inc: { walletBalance: -feeResult.feeAmount },
            $set: { updatedAt: new Date() },
          }
        )

        if (chargeResult.modifiedCount > 0) {
          await WalletTransaction.updateOne(
            { reference },
            {
              $setOnInsert: {
                userId: customerId,
                type: 'booking_cancellation_fee',
                amount: feeResult.feeAmount,
                status: 'completed',
                reference,
                provider: 'internal_wallet',
                note: `Cancellation fee for booking ${id}`,
                metadata: {
                  bookingId: id,
                  policyPercent,
                  windowHours,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
            { upsert: true }
          )
          updatePayload.cancellationFeeStatus = 'charged'
        }
      }
    }

    if (actionType === 'reschedule') {
      const nextDateValue = data.newBookingDate
      const nextStart = typeof data.newStartTime === 'string' ? data.newStartTime : ''
      const nextEnd = typeof data.newEndTime === 'string' ? data.newEndTime : ''

      if (!nextDateValue || !nextStart || !nextEnd) {
        return NextResponse.json(
          { success: false, error: 'newBookingDate, newStartTime and newEndTime are required for reschedule' },
          { status: 400 }
        )
      }

      const providerId = String((existingBooking as any).providerId || '')
      const nextDateOnly = new Date(nextDateValue).toISOString().split('T')[0]
      const parseTime = (timeStr: string) => {
        const [hh, mm] = String(timeStr || '00:00').split(':').map(Number)
        return (hh * 60) + mm
      }
      const nextStartMinutes = parseTime(nextStart)
      const nextEndMinutes = parseTime(nextEnd)

      const sameDayBookings = await BookingModel.find({
        providerId,
        _id: { $ne: id },
        status: { $ne: 'cancelled' },
      }).lean()

      const overlap = sameDayBookings.some((item: any) => {
        if (!item?.bookingDate) return false
        const itemDateOnly = new Date(item.bookingDate).toISOString().split('T')[0]
        if (itemDateOnly !== nextDateOnly) return false
        const itemStart = parseTime(item.startTime)
        const itemEnd = parseTime(item.endTime)
        return nextStartMinutes < itemEnd && nextEndMinutes > itemStart
      })

      if (overlap) {
        return NextResponse.json(
          { success: false, error: 'Selected reschedule slot is already booked for this provider' },
          { status: 409 }
        )
      }

      updatePayload.bookingDate = new Date(nextDateValue)
      updatePayload.startTime = nextStart
      updatePayload.endTime = nextEnd
      updatePayload.status = 'pending'
      updatePayload.lastRescheduledAt = new Date()
      updatePayload.rescheduleCount = Number((existingBooking as any).rescheduleCount || 0) + 1
      updatePayload.cancellationFeeApplied = false
      updatePayload.cancellationFeeAmount = 0
      updatePayload.cancellationFeeStatus = 'waived'

      if (requiresQuote) {
        updatePayload.pricingStatus = 'estimated'
      }
    }

    if (typeof data.status === 'string' && data.status.trim()) {
      updatePayload.status = data.status
      if (data.status === 'cancelled' && !updatePayload.cancelledAt) {
        updatePayload.cancelledAt = new Date()
      }
    }

    if (typeof data.pricingStatus === 'string' && data.pricingStatus.trim()) {
      updatePayload.pricingStatus = data.pricingStatus
    }

    if (typeof data.selectedPackageId === 'string') {
      updatePayload.selectedPackageId = data.selectedPackageId
    }

    if (typeof data.selectedPackageName === 'string') {
      updatePayload.selectedPackageName = data.selectedPackageName
    }

    if (Array.isArray(data.selectedAddOns)) {
      updatePayload.selectedAddOns = data.selectedAddOns
    }

    const estimatedPrice = Number(data.estimatedPrice)
    if (Number.isFinite(estimatedPrice)) {
      updatePayload.estimatedPrice = estimatedPrice
    }

    if (data.finalPrice === null) {
      updatePayload.finalPrice = null
    } else {
      const finalPrice = Number(data.finalPrice)
      if (Number.isFinite(finalPrice)) {
        updatePayload.finalPrice = finalPrice
        updatePayload.totalPrice = finalPrice
      }
    }

    if (typeof data.requiresQuote === 'boolean') {
      updatePayload.requiresQuote = data.requiresQuote
    }

    if (typeof data.quoteExpiresAt === 'string' || data.quoteExpiresAt instanceof Date) {
      const parsed = new Date(data.quoteExpiresAt)
      if (!Number.isNaN(parsed.getTime())) {
        updatePayload.quoteExpiresAt = parsed
      }
    }

    if (typeof data.customerLocation === 'string') {
      updatePayload.customerLocation = data.customerLocation
    }

    if (typeof data.serviceAddress === 'string') {
      updatePayload.serviceAddress = data.serviceAddress
    }

    if (typeof data.rescheduledFromBookingId === 'string') {
      updatePayload.rescheduledFromBookingId = data.rescheduledFromBookingId
    }

    if (typeof data.rescheduledToBookingId === 'string') {
      updatePayload.rescheduledToBookingId = data.rescheduledToBookingId
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields provided for update' },
        { status: 400 }
      )
    }

    const updatedBooking = await BookingModel.findByIdAndUpdate(id, updatePayload, {
      new: true,
      runValidators: true,
    }).lean()

    return NextResponse.json({
      success: true,
      data: {
        ...updatedBooking,
        id: updatedBooking._id,
      },
    })
  } catch (error: any) {
    console.error("Update booking error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update booking" },
      { status: 500 }
    )
  }
}
