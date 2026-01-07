import { NextRequest, NextResponse } from "next/server"
import { getBookingsByProvider, getAllBookings } from "@/lib/mongodb-operations"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId')

    let bookings
    if (providerId) {
      bookings = await getBookingsByProvider(providerId)
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