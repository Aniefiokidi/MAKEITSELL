import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { Store } from '@/lib/models/Store'
import { verifyShipbubbleWebhookSignature } from '@/lib/shipbubble'
import { applyOrderVendorStatus } from '@/lib/order-vendor-status'

// Shipbubble → MakeItSell vendor-leg status. "completed" maps to 'delivered', not
// 'received' — receipt confirmation (and the escrow release it triggers) stays a
// deliberate customer action, exactly like the rider system it replaces.
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

    let targetStore: any = null
    if (storeId) targetStore = await Store.findById(storeId).lean()
    if (!targetStore && vendorId) targetStore = await Store.findOne({ vendorId }).lean()

    await applyOrderVendorStatus({
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
      { arrayFilters: [{ 'entry.vendorId': vendorId }] }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[shipbubble-webhook] Failed to process webhook:', error)
    // Still 200 — Shipbubble will retry on non-200, but a processing error here is
    // unlikely to be transient, and their retry schedule (5x over 25 min) isn't a
    // substitute for our own error handling.
    return NextResponse.json({ success: false, error: 'Processing failed' }, { status: 200 })
  }
}
