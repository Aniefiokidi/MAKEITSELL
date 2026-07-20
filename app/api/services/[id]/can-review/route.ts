import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Review } from '@/lib/models/Review'
import { Booking } from '@/lib/models/Booking'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: true, canReview: false, reason: 'not_logged_in' })
    }

    await connectToDatabase()

    const booking = await Booking.findOne({
      customerId: sessionUser.id,
      serviceId: id,
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .lean()

    if (!booking) {
      return NextResponse.json({ success: true, canReview: false, reason: 'no_completed_booking' })
    }

    const existing = await Review.findOne({
      orderId: String((booking as any)._id),
      serviceId: id,
    }).lean()

    if (existing) {
      return NextResponse.json({ success: true, canReview: false, reason: 'already_reviewed' })
    }

    return NextResponse.json({
      success: true,
      canReview: true,
      bookingId: String((booking as any)._id),
    })
  } catch (error: any) {
    console.error('[service can-review]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
