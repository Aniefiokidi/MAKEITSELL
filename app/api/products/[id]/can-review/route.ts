import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Review } from '@/lib/models/Review'
import { Order } from '@/lib/models/Order'
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

    const order = await Order.findOne({
      customerId: sessionUser.id,
      status: { $in: ['delivered', 'received'] },
      'items.productId': id,
    })
      .sort({ createdAt: -1 })
      .lean()

    if (!order) {
      return NextResponse.json({ success: true, canReview: false, reason: 'no_delivered_order' })
    }

    const existing = await Review.findOne({
      orderId: (order as any).orderId,
      productId: id,
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
    console.error('[product can-review]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
