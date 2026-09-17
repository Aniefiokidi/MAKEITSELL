import { recordProtectedDelivery, sendProtectionNotices } from '@/lib/after-sales'
import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { Store } from '@/lib/models/Store'
import { verifyShipbubbleWebhookSignature } from '@/lib/shipbubble'
import { applyOrderVendorStatus } from '@/lib/order-vendor-status'

// Courier delivery starts the protected clearance period; customer receipt does not waive it.
const STATUS_MAP: Record<string, string> = {
  confirmed: 'confirmed',
  picked_up: 'shipped',
  in_transit: 'out_for_delivery',
  completed: 'delivered',
  cancelled: 'cancelled',
}

// The exact top-level webhook payload shape isn't confirmed from docs alone (no test
// shipment exists yet to trigger a real one, or Shipbubble's own simulator, against).
// Reads defensively across a few plausible shapes and logs the raw payload on receipt
// so this can be tightened once a real webhook (or their simulator) is observed.
function extractShipmentFields(payload: any): { orderId: string; status: string } | null {
  const shipment = payload?.data?.shipment || payload?.data || payload
  const orderId = String(shipment?.order_id || payload?.order_id || '').trim()
  const rawStatus = String(shipment?.status || payload?.status || '').trim().toLowerCase()
  if (!orderId || !rawStatus) return null
  return { orderId, status: rawStatus }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-ship-signature')

  if (!verifyShipbubbleWebhookSignature(rawBody, signature)) {
    console.error('[shipbubble-webhook] Signature verification failed')
    return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  console.log('[shipbubble-webhook] Received payload:', JSON.stringify(payload))

  const extracted = extractShipmentFields(payload)
  if (!extracted) {
    console.error('[shipbubble-webhook] Could not extract order_id/status from payload')
    return NextResponse.json({ success: true }) // ack anyway — malformed payload isn't retry-worthy
  }

  const mappedStatus = STATUS_MAP[extracted.status]
  if (!mappedStatus) {
    // "pending" and anything unrecognized — no MakeItSell-side status change needed yet
    return NextResponse.json({ success: true })
  }

  try {
    await connectToDatabase()
    const order: any = await Order.findOne({ 'vendors.shipbubbleOrderId': extracted.orderId }).lean()
    if (!order) {
      console.error(`[shipbubble-webhook] No order found for Shipbubble order_id ${extracted.orderId}`)
      return NextResponse.json({ success: true }) // ack — nothing retrying this will fix
    }

    const vendorEntry = (order.vendors || []).find((v: any) => v?.shipbubbleOrderId === extracted.orderId)
    const vendorId = String(vendorEntry?.vendorId || '').trim()
    const storeId = String(vendorEntry?.storeId || '').trim()

    if (mappedStatus === 'delivered') { await recordProtectedDelivery(order.orderId, vendorId, storeId); await sendProtectionNotices(order.orderId) }
    const stages = ['pending', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'received', 'completed']
    if (stages.indexOf(String(vendorEntry?.status || 'pending')) > stages.indexOf(mappedStatus) && mappedStatus !== 'cancelled') return NextResponse.json({ success: true })
    if (mappedStatus === 'cancelled' && order.protectionLines?.some((l: any) => l.vendorId === vendorId && (!storeId || l.storeId === storeId) && l.availableAt)) return NextResponse.json({ success: true })
    let targetStore: any = null
    if (storeId) targetStore = await Store.findById(storeId).lean()
    if (!targetStore && vendorId) targetStore = await Store.findOne({ vendorId }).lean()

    const updatedOrder: any = await applyOrderVendorStatus({
      orderId: order.orderId,
      vendorId,
      storeId,
      status: mappedStatus,
      existingOrder: order,
      targetStore,
    })

    // Keep the raw Shipbubble status visible too, alongside the mapped MakeItSell one
    await Order.updateOne(
      { orderId: order.orderId, 'vendors.vendorId': vendorId },
      { $set: { 'vendors.$[entry].shipbubbleStatus': extracted.status } },
      { arrayFilters: [{ 'entry.vendorId': vendorId, ...(storeId ? { 'entry.storeId': storeId } : {}) }] }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[shipbubble-webhook] Failed to process webhook:', error)
    // Return an error so a transient database failure can be retried.
    return NextResponse.json({ success: false, error: 'Processing failed' }, { status: 500 })
  }
}
