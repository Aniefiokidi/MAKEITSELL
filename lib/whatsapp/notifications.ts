// Outbound WhatsApp notifications to vendors — new orders and per-vendor stage
// transitions. Every send here is a side effect of an order/stage change that has
// ALREADY committed by the time these run; nothing in this file may ever affect that
// underlying transaction. Scheduled via next/server's after() rather than awaited or
// left as a bare un-awaited promise — after() runs its callback once the response has
// been sent (so it never adds latency the caller waits on) while still keeping the
// serverless function alive long enough to finish, which a bare un-awaited promise on
// Vercel is not guaranteed to do.
//
// Both sends use approved message templates (order_received, order_status_update)
// rather than free-form text, so they deliver even outside Meta's 24h customer-service
// window — see lib/whatsapp/client.ts's sendTemplateMessage.
import { after } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { WhatsAppLink } from '@/lib/models/WhatsAppLink'
import { WhatsAppMessageMap } from '@/lib/models/WhatsAppMessageMap'
import { sendTemplateMessage } from '@/lib/whatsapp/client'

function shortRef(orderId: string): string {
  return String(orderId || '').slice(0, 8).toUpperCase()
}

function formatItemSummary(items: any[]): string {
  const list = Array.isArray(items) ? items : []
  const parts = list.slice(0, 3).map((item) => `${Math.max(1, Number(item?.quantity || 1))}x ${String(item?.title || 'Item')}`)
  const extra = list.length > 3 ? ` +${list.length - 3} more` : ''
  return (parts.join(', ') || 'items') + extra
}

function formatNaira(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}

async function getLinkedWaId(vendorId: string): Promise<string | null> {
  await connectToDatabase()
  const link: any = await WhatsAppLink.findOne({ vendorId, status: 'linked' }).lean()
  const waId = String(link?.waId || '').trim()
  return waId || null
}

// Every send goes through here so a delivery failure never stops the outcome from being
// logged — the business-logic log line fires first, independent of whether the send
// itself succeeds. Returns the raw API response (or null on skip/failure) so callers
// that need the sent message ID — just the new-order send, for the button mapping — can
// read it back.
async function trySendToVendor(
  vendorId: string,
  orderId: string,
  sendFn: (waId: string) => Promise<any>,
  context: string
): Promise<any | null> {
  try {
    const waId = await getLinkedWaId(vendorId)
    if (!waId) {
      console.log(`[whatsapp-notify] Skipping ${context} — order ${orderId}, vendor ${vendorId} not linked`)
      return null
    }
    const result = await sendFn(waId)
    console.log(`[whatsapp-notify] Sent ${context} — order ${orderId}, vendor ${vendorId}`)
    return result
  } catch (error) {
    // Covers real API errors and any lookup failure. Never rethrown — a notification
    // failure must never surface back onto the order/stage change it's reporting on.
    console.error(`[whatsapp-notify] Failed to send ${context} — order ${orderId}, vendor ${vendorId}:`, error)
    return null
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
      const earnings = formatNaira(Number(vendor?.total || 0))

      const result = await trySendToVendor(
        vendorId,
        orderId,
        (waId) => sendTemplateMessage(waId, 'order_received', [ref, summary, earnings]),
        'order_received template'
      )

      const messageId = String(result?.messages?.[0]?.id || '').trim()
      if (messageId) {
        try {
          await WhatsAppMessageMap.create({ messageId, orderId, vendorId })
        } catch (error) {
          // Best-effort — if this fails, the button tap just falls back to the typed
          // "dispatched [ref]" command instead of resolving automatically.
          console.error(`[whatsapp-notify] Failed to persist message map for order ${orderId}, vendor ${vendorId}:`, error)
        }
      }
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
    await trySendToVendor(
      vendorId,
      orderId,
      (waId) => sendTemplateMessage(waId, 'order_status_update', [ref, summary, label]),
      `order_status_update template (${status})`
    )
  })
}
