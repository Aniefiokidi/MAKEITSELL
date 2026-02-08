import { NextRequest, NextResponse } from "next/server"
import { getBookingsByProvider, getAllBookings, getBookingsByCustomer, createBooking, getUserById } from "@/lib/mongodb-operations"
import { AppointmentEmailService } from "@/lib/appointment-emails"

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
    
    // 1. Check for double-booking prevention
    const { providerId, bookingDate, startTime, endTime } = bookingData
    
    if (!providerId || !bookingDate || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields for booking validation' },
        { status: 400 }
      )
    }
    
    // Get existing bookings for this provider on the same date
    const existingBookings = await getBookingsByProvider(providerId)
    
    // Convert booking date to string for comparison (YYYY-MM-DD format)
    const requestedDate = new Date(bookingDate).toISOString().split('T')[0]
    
    // Check for time conflicts
    const conflictingBooking = existingBookings.find(booking => {
      if (!booking.bookingDate) return false
      
      const existingDate = new Date(booking.bookingDate).toISOString().split('T')[0]
      
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
    
    // 2. Create the booking (no conflicts found)
    const booking = await createBooking(bookingData)
    
    // 3. Send email notifications
    try {
      // Get provider email
      const provider = await getUserById(providerId)
      const providerEmail = provider?.email
      
      if (providerEmail) {
        const emailService = new AppointmentEmailService()
        await emailService.sendBookingConfirmationEmails({
          bookingId: booking.id,
          customerName: bookingData.customerName,
          customerEmail: bookingData.customerEmail,
          customerPhone: bookingData.customerPhone,
          providerName: bookingData.providerName,
          providerEmail: providerEmail,
          serviceTitle: bookingData.serviceTitle,
          bookingDate: new Date(bookingData.bookingDate),
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          location: bookingData.location,
          totalPrice: bookingData.totalPrice,
          notes: bookingData.notes
        })
        console.log('✅ Booking confirmation emails sent successfully')
      } else {
        console.warn('⚠️ Provider email not found, skipping email notifications')
      }
    } catch (emailError) {
      console.error('❌ Email notification failed:', emailError)
      // Don't fail the booking creation if email fails
    }
    
    return NextResponse.json({
      success: true,
      id: booking?.id,
      data: booking,
      message: 'Booking created successfully and notifications sent'
    }, { status: 201 })
  } catch (error: any) {
    console.error('Create booking error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create booking' },
      { status: 500 }
    )
  }
}