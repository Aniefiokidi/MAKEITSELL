import { NextRequest, NextResponse } from "next/server"
import { getBookingsByProvider, getAllBookings, getBookingsByCustomer, createBooking } from "@/lib/mongodb-operations"

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
  try {
    const bookingData = await request.json()
    
    const booking = await createBooking(bookingData)
    
    return NextResponse.json({
      success: true,
      id: booking?.id,
      data: booking
    }, { status: 201 })
  } catch (error: any) {
    console.error('Create booking error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create booking' },
      { status: 500 }
    )
  }
}