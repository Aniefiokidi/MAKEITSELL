import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Review } from '@/lib/models/Review'
import { Booking } from '@/lib/models/Booking'
import { ServiceContact } from '@/lib/models/ServiceContact'
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

    // Primary path: a real completed Booking (still how bot-originated bookings work —
    // see lib/booking-payment.ts and the booking-completion-job cron, unaffected by
    // services no longer being monetized).
    const booking = await Booking.findOne({
      customerId: sessionUser.id,
      serviceId: id,
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .lean()

    if (booking) {
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
    }

    // Fallback: no in-app Booking exists at all — the buyer connected with the provider
    // over WhatsApp instead (app/api/services/[id]/contact/route.ts). Eligibility here is
    // self-reported, not automatic.
    const contact = await ServiceContact.findOne({ customerId: sessionUser.id, serviceId: id }).lean()

    if (!contact) {
      return NextResponse.json({ success: true, canReview: false, reason: 'no_completed_booking' })
    }

    if ((contact as any).status !== 'received') {
      return NextResponse.json({
        success: true,
        canReview: false,
        reason: 'awaiting_receipt_confirmation',
        contactId: String((contact as any)._id),
      })
    }

    const existingFromContact = await Review.findOne({
      orderId: String((contact as any)._id),
      serviceId: id,
    }).lean()

    if (existingFromContact) {
      return NextResponse.json({ success: true, canReview: false, reason: 'already_reviewed' })
    }

    return NextResponse.json({
      success: true,
      canReview: true,
      bookingId: String((contact as any)._id),
    })
  } catch (error: any) {
    console.error('[service can-review]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
