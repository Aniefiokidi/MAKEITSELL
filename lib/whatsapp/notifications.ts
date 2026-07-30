// Outbound WhatsApp notifications to vendors — new orders and per-vendor stage
// transitions. Every send here is a side effect of an order/stage change that has
// ALREADY committed by the time these run; nothing in this file may ever affect that
// underlying transaction. Scheduled via next/server's after() rather than awaited or
// left as a bare un-awaited promise — after() runs its callback once the response has
// been sent (so it never adds latency the caller waits on) while still keeping the
// serverless function alive long enough to finish, which a bare un-awaited promise on
// Vercel is not guaranteed to do.
import { after } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { WhatsAppLink } from '@/lib/models/WhatsAppLink'
import { sendTextMessage } from '@/lib/whatsapp/client'

function shortRef(orderId: string): string {
  return String(orderId || '').slice(0, 8).toUpperCase()
}

function formatItemSummary(items: any[]): string {
  const list = Array.isArray(items) ? items : []
  const parts = list.slice(0, 3).map((item) => `${Math.max(1, Number(item?.quantity || 1))}x ${String(item?.title || 'Item')}`)
  const extra = list.length > 3 ? ` +${list.length - 3} more` : ''
  return (parts.join(', ') || 'items') + extra
}

async function getLinkedWaId(vendorId: string): Promise<string | null> {
  await connectToDatabase()
  const link: any = await WhatsAppLink.findOne({ vendorId, status: 'linked' }).lean()
  const waId = String(link?.waId || '').trim()
  return waId || null
}

// TODO(whatsapp-templates): these are free-form text sends, only deliverable within
// Meta's 24h customer-service window (measured from the vendor's last message to the
// bot). Outside that window, sendTextMessage will fail (Meta returns an error, e.g.
// code 131047) and the send below is skipped after logging — nothing crashes, but the
// vendor won't get it. Fixing that needs an approved message template, a separate
// process not built here (per spec).
async function trySendToVendor(vendorId: string, orderId: string, body: string, context: string): Promise<void> {
  try {
    const waId = await getLinkedWaId(vendorId)
    if (!waId) {
      console.log(`[whatsapp-notify] Skipping ${context} — order ${orderId}, vendor ${vendorId} not linked`)
      return
    }
    await sendTextMessage(waId, body)
    console.log(`[whatsapp-notify] Sent ${context} — order ${orderId}, vendor ${vendorId}`)
  } catch (error) {
    // Covers real API errors (including the outside-24h-window case above) and any
    // lookup failure. Never rethrown — a notification failure must never surface back
    // onto the order/stage change it's reporting on.
    console.error(`[whatsapp-notify] Failed to send ${context} — order ${orderId}, vendor ${vendorId}:`, error)
  }
}

// New order — one message per vendor in the order, each with only their own
// items/earnings. Call this after the order is actually paid, not at creation time.
export function notifyVendorsNewOrder(orderId: string): void {
  after(async () => {
    await connectToDatabase()
    const order: any = await Order.findOne({ orderId }).lean()
    if (!order || !Array.isArray(order.vendors)) return

    for (const vendor of order.vendors) {
      const vendorId = String(vendor?.vendorId || '').trim()
      if (!vendorId) continue

      const ref = shortRef(orderId)
      const summary = formatItemSummary(vendor.items)
      const earnings = Number(vendor?.total || 0)
      const body = `New order! Ref: ${ref}\n${summary}\nYour earnings: NGN ${earnings.toLocaleString('en-NG')}`

      await trySendToVendor(vendorId, orderId, body, 'new-order notification')
    }
  })
}

const STAGE_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  received: 'Received — payment released to your wallet',
  cancelled: 'Cancelled',
}

// Stage transition on one vendor's leg — called from applyOrderVendorStatus, after its
// DB commit. `vendorEntry` is the already-updated leg (has items/total for the
// message), passed in by the caller so this never needs a second DB round-trip for
// data it already has in hand.
export function notifyVendorStageChange(orderId: string, vendorEntry: any, status: string): void {
  const label = STAGE_LABELS[status]
  const vendorId = String(vendorEntry?.vendorId || '').trim()
  if (!label || !vendorId) return // unrecognized status or no resolvable vendor — nothing to send

  after(async () => {
    const ref = shortRef(orderId)
    const summary = formatItemSummary(vendorEntry?.items)
    const body = `Order ${ref} (${summary}) is now: ${label}`
    await trySendToVendor(vendorId, orderId, body, `stage-change (${status}) notification`)
  })
}
