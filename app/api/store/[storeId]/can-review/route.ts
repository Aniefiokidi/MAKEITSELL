import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Review } from '@/lib/models/Review'
import { Order } from '@/lib/models/Order'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: true, canReview: false, reason: 'not_logged_in' })
    }

    await connectToDatabase()

    // Find the most recent delivered/received order from this store by this customer
    const order = await Order.findOne({
      customerId: sessionUser.id,
      storeIds: storeId,
      status: { $in: ['delivered', 'received'] },
    })
      .sort({ createdAt: -1 })
      .lean()

    if (!order) {
      return NextResponse.json({ success: true, canReview: false, reason: 'no_delivered_order' })
    }

    // Check if this order+store already has a review
    const existing = await Review.findOne({
      orderId: (order as any).orderId,
      storeId,
    }).lean()

    if (existing) {
      return NextResponse.json({ success: true, canReview: false, reason: 'already_reviewed' })
    }

    return NextResponse.json({
      success: true,
      canReview: true,
      orderId: (order as any).orderId,
    })
  } catch (error: any) {
    console.error('[can-review]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
