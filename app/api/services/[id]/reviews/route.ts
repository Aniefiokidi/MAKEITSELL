import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Review } from '@/lib/models/Review'
import { Booking } from '@/lib/models/Booking'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { getServiceById } from '@/lib/mongodb-operations'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectToDatabase()
  const reviews = await Review.find({ serviceId: id })
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
  const { bookingId, rating, comment } = body

  if (!bookingId || !rating || Number(rating) < 1 || Number(rating) > 5) {
    return NextResponse.json(
      { success: false, error: 'bookingId and rating (1-5) are required' },
      { status: 400 }
    )
  }

  await connectToDatabase()

  const service = await getServiceById(id)
  if (!service) {
    return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 })
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    customerId: sessionUser.id,
    serviceId: id,
    status: 'completed',
  }).lean()

  if (!booking) {
    return NextResponse.json(
      { success: false, error: 'No eligible completed booking for this service was found' },
      { status: 403 }
    )
  }

  const existing = await Review.findOne({ orderId: bookingId, serviceId: id }).lean()
  if (existing) {
    return NextResponse.json(
      { success: false, error: 'You have already reviewed this service for this booking' },
      { status: 409 }
    )
  }

  const providerId = String((service as any).providerId || '')

  const review = await Review.create({
    storeId: providerId,
    vendorId: providerId,
    serviceId: id,
    customerId: sessionUser.id,
    customerName: sessionUser.name || 'Customer',
    orderId: bookingId,
    rating: Number(rating),
    comment: String(comment || '').trim().slice(0, 1000),
    createdAt: new Date(),
  })

  return NextResponse.json({ success: true, review })
}
