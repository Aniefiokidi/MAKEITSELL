import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { logisticsEmailAllowedForRegion, resolveLogisticsRegion, storeMatchesLogisticsRegion } from '@/lib/logistics-access'
import { ALLOWED_VENDOR_STATUSES, applyOrderVendorStatus, resolveOrderVendorTarget } from '@/lib/order-vendor-status'

export async function PATCH(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId } = await context.params
    const body = await request.json().catch(() => ({}))
    const region = resolveLogisticsRegion(body?.region)

    if (!logisticsEmailAllowedForRegion(sessionUser.email, region)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const requestedStatus = String(body?.status || '').trim()
    const vendorId = String(body?.vendorId || '').trim()
    const storeId = String(body?.storeId || '').trim()

    if (!orderId || !ALLOWED_VENDOR_STATUSES.has(requestedStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid orderId or status' }, { status: 400 })
    }

    const target = await resolveOrderVendorTarget(orderId, vendorId, storeId)
    if (!target) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const { existingOrder, targetStore } = target

    if (!storeMatchesLogisticsRegion(targetStore, region)) {
      return NextResponse.json({ success: false, error: `Only ${region.cityLabel} orders can be managed here` }, { status: 400 })
    }

    const updatedOrder = await applyOrderVendorStatus({
      orderId,
      vendorId,
      storeId,
      status: requestedStatus,
      region,
      existingOrder,
      targetStore,
    })

    if (!updatedOrder) {
      return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 })
    }

    return NextResponse.json({ success: true, order: updatedOrder })
  } catch (error) {
    console.error('Error updating logistics order status:', error)
    return NextResponse.json({ success: false, error: 'Failed to update status' }, { status: 500 })
  }
}
