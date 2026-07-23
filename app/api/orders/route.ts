import { NextRequest, NextResponse } from 'next/server'
import { getOrders, getOrderById, releaseEscrowForOrder, updateOrder } from '@/lib/mongodb-operations'
import { sendOrderStatusChangeNotifications } from '@/lib/order-notifications'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { applyOrderVendorStatus, resolveOrderVendorTarget } from '@/lib/order-vendor-status'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customerId')
    const vendorId = searchParams.get('vendorId')

    if (!customerId && !vendorId) {
      return NextResponse.json(
        { error: 'customerId or vendorId is required' },
        { status: 400 }
      )
    }

    const filters: any = {}
    if (customerId) filters.customerId = customerId
    if (vendorId) filters.vendorId = vendorId

    const orders = await getOrders(filters)
    return NextResponse.json(orders || [])
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, status, vendorId: rawVendorId, storeId: rawStoreId } = body || {}
    if (!orderId || !status) {
      return NextResponse.json({ error: 'orderId and status are required' }, { status: 400 })
    }

    const existingOrder: any = await getOrderById(orderId)
    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const isAdmin = String(sessionUser.role || '').toLowerCase() === 'admin'
    const isOwner = String(existingOrder.customerId || '') === String(sessionUser.id || '')

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Customers are only allowed to confirm receipt of their own orders.
    if (!isAdmin && status !== 'received') {
      return NextResponse.json({ error: 'Customers can only mark orders as received' }, { status: 403 })
    }

    const vendorId = String(rawVendorId || '').trim()
    const storeId = String(rawStoreId || '').trim()
    const hasMultipleVendorLegs = Array.isArray(existingOrder.vendors) && existingOrder.vendors.length > 1

    // Multi-vendor orders must only advance the one vendor leg the caller identified —
    // otherwise confirming receipt of one vendor's item releases escrow (and pays out)
    // every vendor on the order, including ones whose items haven't even shipped yet.
    // Single-vendor orders keep the original whole-order update below unchanged.
    if ((vendorId || storeId) && hasMultipleVendorLegs) {
      const target = await resolveOrderVendorTarget(orderId, vendorId, storeId)
      if (!target) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      const updated = await applyOrderVendorStatus({
        orderId,
        vendorId,
        storeId,
        status,
        existingOrder: target.existingOrder,
        targetStore: target.targetStore,
      })

      if (!updated) {
        return NextResponse.json({ error: 'Failed to update this vendor\'s item' }, { status: 500 })
      }

      return NextResponse.json({ success: true, order: updated })
    }

    const now = new Date()
    const timestampUpdates: any = {}
    if (status === 'received') {
      timestampUpdates.receivedAt = now
    } else if (status === 'delivered') {
      timestampUpdates.deliveredAt = now
    }


    const updated = await updateOrder(orderId, { status, ...timestampUpdates })
    if (!updated) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Send status change notification (customer & vendor)
    try {
      await sendOrderStatusChangeNotifications(orderId, updated, status)
    } catch (notifyErr) {
      console.error('[order-status-notification] Failed:', notifyErr)
    }

    if (status === 'received') {
      const freshOrder: any = await getOrderById(orderId)
      const paymentStatus = String(freshOrder?.paymentStatus || '').toLowerCase()
      const isDisputed = Boolean(freshOrder?.disputeRaisedAt) || String(freshOrder?.disputeStatus || '').toLowerCase() === 'active'

      if (paymentStatus === 'escrow' && !isDisputed) {
        await releaseEscrowForOrder(orderId, {
          paymentReference: String(freshOrder?.paymentReference || ''),
          provider: String(freshOrder?.paymentMethod || ''),
          source: 'buyer_received_confirmation',
        })

        await updateOrder(orderId, {
          paymentStatus: 'released',
          status: 'completed',
          confirmedAt: new Date(),
        })
      }
    }

    return NextResponse.json({ success: true, order: updated })
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
