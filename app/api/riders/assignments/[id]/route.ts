import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { RiderAssignment } from '@/lib/models/RiderAssignment'
import { requireRoles } from '@/lib/server-route-auth'
import { getLogisticsRegionConfig, type LogisticsRegionKey } from '@/lib/logistics-access'
import { applyOrderVendorStatus, resolveOrderVendorTarget } from '@/lib/order-vendor-status'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireRoles(request, ['rider'])
  if (response) return response

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const action = String(body?.action || '').trim()

  if (!['start', 'delivered'].includes(action)) {
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  }

  await connectToDatabase()

  const assignment = await RiderAssignment.findById(id)
  if (!assignment) {
    return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 })
  }

  if (String(assignment.riderId) !== user!.id) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const vendorStatus = action === 'start' ? 'out_for_delivery' : 'delivered'

  if (action === 'start') {
    if (assignment.status !== 'assigned') {
      return NextResponse.json({ success: false, error: 'Delivery already started' }, { status: 400 })
    }
    assignment.status = 'en_route'
    assignment.pickedUpAt = now
    assignment.enRouteAt = now
  } else {
    assignment.status = 'delivered'
    assignment.deliveredAt = now
  }
  assignment.updatedAt = now
  await assignment.save()

  try {
    const region = getLogisticsRegionConfig(assignment.region as LogisticsRegionKey)
    const target = await resolveOrderVendorTarget(assignment.orderId, assignment.vendorId || '', assignment.storeId || '')
    if (target) {
      await applyOrderVendorStatus({
        orderId: assignment.orderId,
        vendorId: assignment.vendorId,
        storeId: assignment.storeId,
        status: vendorStatus,
        region,
        existingOrder: target.existingOrder,
        targetStore: target.targetStore,
      })
    }
  } catch (err) {
    console.error('[api/riders/assignments/[id]] Failed to forward order status:', err)
  }

  return NextResponse.json({ success: true, assignment })
}
