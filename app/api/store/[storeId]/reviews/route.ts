import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Review } from '@/lib/models/Review'
import { Order } from '@/lib/models/Order'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  await connectToDatabase()
  const reviews = await Review.find({ storeId: params.storeId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
  return NextResponse.json({ success: true, reviews })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { orderId, rating, comment } = body

  if (!orderId || !rating || Number(rating) < 1 || Number(rating) > 5) {
    return NextResponse.json(
      { success: false, error: 'orderId and rating (1-5) are required' },
      { status: 400 }
    )
  }

  await connectToDatabase()

  // Verify order belongs to this customer, includes this store, and was delivered/received
  const order = await Order.findOne({
    orderId,
    customerId: sessionUser.id,
    storeIds: params.storeId,
    status: { $in: ['delivered', 'received'] },
  }).lean()

  if (!order) {
    return NextResponse.json(
      { success: false, error: 'No eligible delivered order found for this store' },
      { status: 403 }
    )
  }

  // Prevent duplicate review for same order+store
  const existing = await Review.findOne({ orderId, storeId: params.storeId }).lean()
  if (existing) {
    return NextResponse.json(
      { success: false, error: 'You have already reviewed this order' },
      { status: 409 }
    )
  }

  const review = await Review.create({
    storeId:      params.storeId,
    vendorId:     String((order as any).vendors?.[0]?.vendorId || params.storeId),
    customerId:   sessionUser.id,
    customerName: sessionUser.name || 'Customer',
    orderId,
    rating:       Number(rating),
    comment:      String(comment || '').trim().slice(0, 1000),
    createdAt:    new Date(),
  })

  return NextResponse.json({ success: true, review })
}
