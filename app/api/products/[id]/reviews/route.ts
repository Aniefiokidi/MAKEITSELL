import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Review } from '@/lib/models/Review'
import { Order } from '@/lib/models/Order'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { getProductById } from '@/lib/mongodb-operations'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectToDatabase()
  const reviews = await Review.find({ productId: id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
  return NextResponse.json({ success: true, reviews })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const product = await getProductById(id)
  if (!product) {
    return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
  }

  // Verify this order belongs to the customer, was delivered, and actually contained this product.
  const order = await Order.findOne({
    orderId,
    customerId: sessionUser.id,
    status: { $in: ['delivered', 'received', 'completed'] },
    'items.productId': id,
  }).lean()

  if (!order) {
    return NextResponse.json(
      { success: false, error: 'No eligible delivered order containing this product was found' },
      { status: 403 }
    )
  }

  const existing = await Review.findOne({ orderId, productId: id }).lean()
  if (existing) {
    return NextResponse.json(
      { success: false, error: 'You have already reviewed this product for this order' },
      { status: 409 }
    )
  }

  const review = await Review.create({
    storeId: String((product as any).storeId || (product as any).vendorId || ''),
    vendorId: String((product as any).vendorId || ''),
    productId: id,
    customerId: sessionUser.id,
    customerName: sessionUser.name || 'Customer',
    orderId,
    rating: Number(rating),
    comment: String(comment || '').trim().slice(0, 1000),
    createdAt: new Date(),
  })

  return NextResponse.json({ success: true, review })
}
