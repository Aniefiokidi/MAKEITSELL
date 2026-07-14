import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { RiderAssignment } from '@/lib/models/RiderAssignment'
import { Order } from '@/lib/models/Order'
import { Store } from '@/lib/models/Store'
import { requireRoles } from '@/lib/server-route-auth'

export async function GET(request: NextRequest) {
  const { user, response } = await requireRoles(request, ['rider'])
  if (response) return response

  await connectToDatabase()

  const assignments = await RiderAssignment.find({
    riderId: user!.id,
    status: { $ne: 'delivered' },
  })
    .sort({ assignedAt: -1 })
    .lean()

  const orderIds = Array.from(new Set((assignments as any[]).map((a) => a.orderId)))
  const orders = orderIds.length > 0
    ? await Order.find({ orderId: { $in: orderIds } }).lean()
    : []
  const orderById = new Map<string, any>()
  for (const order of orders as any[]) {
    orderById.set(String(order.orderId), order)
  }

  const storeIds = Array.from(new Set((assignments as any[]).map((a) => String(a.storeId || '')).filter(Boolean)))
  const stores = storeIds.length > 0 ? await Store.find({ _id: { $in: storeIds } }).lean() : []
  const storeById = new Map<string, any>()
  for (const store of stores as any[]) {
    storeById.set(String(store._id), store)
  }

  const results = (assignments as any[]).map((assignment) => {
    const order = orderById.get(String(assignment.orderId))
    const store = storeById.get(String(assignment.storeId || ''))
    const vendorEntry = Array.isArray(order?.vendors)
      ? order.vendors.find((v: any) => String(v?.vendorId || '') === String(assignment.vendorId || '')) : null
    const items = vendorEntry?.items && vendorEntry.items.length > 0 ? vendorEntry.items : (order?.items || [])

    return {
      id: String(assignment._id),
      orderId: assignment.orderId,
      status: assignment.status,
      destination: assignment.destination,
      trackingToken: assignment.trackingToken,
      assignedAt: assignment.assignedAt,
      pickupLocation: store?.address || 'Pickup address not provided',
      pickupPhone: store?.phone || '',
      customerName: order?.shippingInfo
        ? `${order.shippingInfo.firstName || ''} ${order.shippingInfo.lastName || ''}`.trim()
        : 'Customer',
      customerPhone: order?.shippingInfo?.phone || '',
      totalAmount: Number(order?.totalAmount || 0),
      items,
    }
  })

  return NextResponse.json({ success: true, assignments: results })
}
