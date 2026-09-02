import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { Store } from '@/lib/models/Store'
import { verifyFezWebhookSignature } from '@/lib/fez'
import { applyOrderVendorStatus } from '@/lib/order-vendor-status'
import { ESCROW_DISPUTE_GRACE_HOURS } from '@/lib/shipbubble'

// Fez → MakeItSell vendor-leg status. Docs don't enumerate a full status vocabulary
// (only "Dispatched" and "Delivered" are shown as real examples, plus a handful of
// cancellable-state names from the /order/cancel error message) — anything not listed
// here is a deliberate no-op rather than a guess, same defensive posture as the
// Shipbubble webhook's STATUS_MAP.
const STATUS_MAP: Record<string, string> = {
  'pending pick-up': 'confirmed',
  'dropped-off': 'shipped',
  dispatched: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'cancelled',
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const orderNo = String(payload?.orderNumber || '').trim()
  const rawStatus = String(payload?.status || '').trim()

  if (!verifyFezWebhookSignature({
    orderNo,
    orderStatus: rawStatus,
    timestamp: request.headers.get('x-timestamp') || '',
    signatureHeader: request.headers.get('x-signature'),
  })) {
    console.error('[fez-webhook] Signature verification failed')
    return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 })
  }

  console.log('[fez-webhook] Received payload:', JSON.stringify(payload))

  if (!orderNo || !rawStatus) {
    return NextResponse.json({ success: true }) // ack anyway — malformed payload isn't retry-worthy
  }

  const mappedStatus = STATUS_MAP[rawStatus.toLowerCase()]
  if (!mappedStatus) {
    // Unrecognized status — no MakeItSell-side change yet, same as Shipbubble's webhook.
    return NextResponse.json({ success: true })
  }

  try {
    await connectToDatabase()
    const order: any = await Order.findOne({ 'vendors.deliveryProviderOrderId': orderNo }).lean()
    if (!order) {
      console.error(`[fez-webhook] No order found for Fez orderNo ${orderNo}`)
      return NextResponse.json({ success: true }) // ack — nothing retrying this will fix
    }

    const vendorEntry = (order.vendors || []).find((v: any) => v?.deliveryProviderOrderId === orderNo)
    const vendorId = String(vendorEntry?.vendorId || '').trim()
    const storeId = String(vendorEntry?.storeId || '').trim()

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

    await Order.updateOne(
      { orderId: order.orderId, 'vendors.vendorId': vendorId },
      { $set: { 'vendors.$[entry].deliveryStatus': rawStatus } },
      { arrayFilters: [{ 'entry.vendorId': vendorId }] }
    )

    // Same tightening logic as the Shipbubble webhook: real courier-confirmed delivery
    // beats the pessimistic ETA-based estimate set at checkout.
    if (mappedStatus === 'delivered' && updatedOrder?.status === 'delivered') {
      const tightenedReleaseAt = new Date(Date.now() + ESCROW_DISPUTE_GRACE_HOURS * 60 * 60 * 1000)
      const currentReleaseAt = updatedOrder?.escrowReleaseAt ? new Date(updatedOrder.escrowReleaseAt) : null
      if (!currentReleaseAt || tightenedReleaseAt < currentReleaseAt) {
        await Order.updateOne(
          { orderId: order.orderId },
          { $set: { escrowReleaseAt: tightenedReleaseAt } }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[fez-webhook] Failed to process webhook:', error)
    return NextResponse.json({ success: false, error: 'Processing failed' }, { status: 200 })
  }
}
