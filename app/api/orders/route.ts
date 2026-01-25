import { NextRequest, NextResponse } from 'next/server'
import { getOrders, updateOrder } from '@/lib/mongodb-operations'

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
    const body = await request.json()
    const { orderId, status } = body || {}
    if (!orderId || !status) {
      return NextResponse.json({ error: 'orderId and status are required' }, { status: 400 })
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
    return NextResponse.json({ success: true, order: updated })
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
