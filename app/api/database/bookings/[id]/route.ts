import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Booking as BookingModel } from "@/lib/models/Booking"

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
    const requestedStatus = typeof data.status === 'string' ? data.status.trim() : ''
    const requestedPricingStatus = typeof data.pricingStatus === 'string' ? data.pricingStatus.trim() : ''
    const existingPricingStatus = String((existingBooking as any).pricingStatus || '')
    const requiresQuote =
      typeof data.requiresQuote === 'boolean'
        ? data.requiresQuote
        : Boolean((existingBooking as any).requiresQuote)

    const allowedStatuses = new Set(['pending', 'confirmed', 'completed', 'cancelled'])
    const allowedPricingStatuses = new Set(['estimated', 'quoted', 'accepted'])

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
    }

    if (typeof data.status === 'string' && data.status.trim()) {
      updatePayload.status = data.status
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
