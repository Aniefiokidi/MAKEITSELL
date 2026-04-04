import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { updateOrder } from '@/lib/mongodb-operations'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

const LOGISTICS_USERNAME = 'A&CO@makeitselll.org'

function textContainsLagos(value: unknown): boolean {
  if (value == null) return false
  return String(value).toLowerCase().includes('lagos')
}

function orderMatchesLagos(order: any): boolean {
  const searchableBlob = [
    order?.shippingInfo,
    order?.shippingAddress,
    order?.items,
    order?.vendors,
    order,
  ]

  return searchableBlob.some((part) => textContainsLagos(JSON.stringify(part || {})))
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (String(sessionUser.email || '').toLowerCase() !== LOGISTICS_USERNAME.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { orderId } = await context.params
    const body = await request.json().catch(() => ({}))
    const requestedStatus = String(body?.status || '').trim()
    const vendorId = String(body?.vendorId || '').trim()
    const storeId = String(body?.storeId || '').trim()

    const allowedStatuses = new Set([
      'pending',
      'confirmed',
      'shipped',
      'out_for_delivery',
      'delivered',
      'received',
      'cancelled',
    ])

    if (!orderId || !allowedStatuses.has(requestedStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid orderId or status' }, { status: 400 })
    }

    await connectToDatabase()

    const existingOrder = await Order.findOne({ orderId }).lean()
    if (!existingOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    if (!orderMatchesLagos(existingOrder)) {
      return NextResponse.json({ success: false, error: 'Only Lagos orders can be managed here' }, { status: 400 })
    }

    const now = new Date()
    const timestampUpdates: Record<string, Date> = {}

    if (requestedStatus === 'confirmed') timestampUpdates.confirmedAt = now
    if (requestedStatus === 'shipped') timestampUpdates.shippedAt = now
    if (requestedStatus === 'out_for_delivery') timestampUpdates.outForDeliveryAt = now
    if (requestedStatus === 'delivered') timestampUpdates.deliveredAt = now
    if (requestedStatus === 'received') timestampUpdates.receivedAt = now
    if (requestedStatus === 'cancelled') timestampUpdates.cancelledAt = now

    let updatedOrder: any = null

    if (vendorId || storeId) {
      const query: any = { orderId }
      const arrayFilter: any = {}

      if (vendorId) {
        query['vendors.vendorId'] = vendorId
        arrayFilter.vendorId = vendorId
      }
      if (storeId) {
        query['vendors.storeId'] = storeId
        arrayFilter.storeId = storeId
      }

      const vendorTimestampUpdates = Object.fromEntries(
        Object.entries(timestampUpdates).map(([key, value]) => [`vendors.$[entry].${key}`, value])
      )

      const updated = await Order.findOneAndUpdate(
        query,
        {
          $set: {
            'vendors.$[entry].status': requestedStatus,
            ...vendorTimestampUpdates,
          },
        },
        {
          new: true,
          arrayFilters: [arrayFilter],
        }
      ).lean()

      if (updated) {
        updatedOrder = updated

        const vendorStatuses = (Array.isArray(updated.vendors) ? updated.vendors : [])
          .map((entry: any) => String(entry?.status || '').trim().toLowerCase())
          .filter(Boolean)

        // Keep root status consistent only when all vendor entries are at the same terminal stage.
        if (vendorStatuses.length > 0 && vendorStatuses.every((value: string) => value === requestedStatus.toLowerCase())) {
          updatedOrder = await updateOrder(orderId, {
            status: requestedStatus,
            ...timestampUpdates,
          })
        }
      }
    } else {
      updatedOrder = await updateOrder(orderId, {
        status: requestedStatus,
        ...timestampUpdates,
      })
    }

    if (!updatedOrder) {
      return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 })
    }

    return NextResponse.json({ success: true, order: updatedOrder })
  } catch (error) {
    console.error('Error updating logistics order status:', error)
    return NextResponse.json({ success: false, error: 'Failed to update status' }, { status: 500 })
  }
}
