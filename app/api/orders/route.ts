import { NextRequest, NextResponse } from 'next/server'
import { getOrders, getOrderById, releaseEscrowForOrder, updateOrder } from '@/lib/mongodb-operations'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

const CUSTOMER_VISIBLE_PAYMENT_STATUSES = new Set([
  'escrow',
  'released',
  'disputed',
  'refunded',
  'paid',
  'successful',
  'success',
  'completed',
  'confirmed',
])

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const isAdmin = String(sessionUser.role || '').toLowerCase() === 'admin'
    const requestedCustomerId = String(customerId || '')
    const requestedVendorId = String(vendorId || '')
    const sessionUserId = String(sessionUser.id || '')

    if (!isAdmin) {
      if (requestedCustomerId && requestedCustomerId !== sessionUserId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (requestedVendorId && requestedVendorId !== sessionUserId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const orders = await getOrders(filters)
    const visibleOrders = (orders || []).filter((order: any) => {
      const paymentStatus = String(order?.paymentStatus || '').trim().toLowerCase()
      return CUSTOMER_VISIBLE_PAYMENT_STATUSES.has(paymentStatus)
    })

    return NextResponse.json(visibleOrders)
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
    const { orderId, status } = body || {}
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
