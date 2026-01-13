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

    const updatedBooking = await BookingModel.findByIdAndUpdate(
      id,
      { status: data.status },
      { new: true, runValidators: true }
    ).lean()

    if (!updatedBooking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      )
    }

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
