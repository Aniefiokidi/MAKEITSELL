// Service-role order creation for the WhatsApp bot — creates a real order for a
// wa_id-identified buyer with NO session and NO browser involved.
//
// This is deliberately NOT an HTTP route: it's a plain server-side function, only
// importable from other server code in this codebase (a future chat-driven checkout
// handler in lib/whatsapp/). There is no app/api/*/route.ts wired to it, so there is no
// public URL, no client-exposed secret, and no network request for an attacker to
// forge — the only way to reach this function is to already be executing as trusted
// server code inside this deployment.
//
// The real trust boundary sits upstream of this file, in app/api/whatsapp/webhook/
// route.ts: every inbound payload is HMAC-verified against Meta's x-hub-signature-256
// header (using WHATSAPP_APP_SECRET) BEFORE a wa_id is ever read from it. By the time a
// wa_id reaches this function it has already been through that verification, so a
// caller can't place an order "as" a wa_id it doesn't actually own without also forging
// that signature — which requires a secret that never leaves the server.
import { Order } from '@/lib/models/Order'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { updateOrder } from '@/lib/mongodb-operations'
import connectToDatabase from '@/lib/mongodb'
import { buildOrder, type BuildOrderResult } from '@/lib/order-creation'
import { findOrCreateBuyerForWaId, placeholderEmailForWaId } from '@/lib/whatsapp/buyer-identity'
import { calculatePaystackCheckoutAmounts } from '@/lib/paystack-charges'
import { paystackService } from '@/lib/payment'

export type CreateOrderForWaBuyerInput = {
  waId: string
  name?: string
  items: any[]
  shippingInfo: any
  paymentMethod: string
  courierSelections?: Record<string, any>
}

export async function createOrderForWaBuyer(input: CreateOrderForWaBuyerInput): Promise<BuildOrderResult> {
  const { waId, name, items, shippingInfo, paymentMethod, courierSelections } = input

  const { customerId } = await findOrCreateBuyerForWaId(waId, name)

  // A phone-only buyer generally has no real email to give — fall back to the same
  // derived placeholder used for their User record so buildOrder's hard-required email
  // check is satisfied without ever asking for one. A caller that DOES have a real
  // email on hand (e.g. a future "want your receipt emailed?" step) can still pass it
  // through as-is; this only fills the gap, never overrides a real value.
  const effectiveShippingInfo = {
    ...shippingInfo,
    email: String(shippingInfo?.email || '').trim() || placeholderEmailForWaId(waId),
    phone: String(shippingInfo?.phone || '').trim() || waId,
    country: shippingInfo?.country || 'Nigeria',
  }

  return buildOrder({
    customerId,
    items,
    shippingInfo: effectiveShippingInfo,
    paymentMethod,
    courierSelections,
  })
}

export type InitiateWaBuyerPaystackCheckoutInput = Omit<CreateOrderForWaBuyerInput, 'paymentMethod'>

export type InitiateWaBuyerPaystackCheckoutResult =
  | { success: true; orderId: string; totalAmount: number; authorizationUrl: string }
  | { success: false; error: string }

// Order creation + Paystack link generation for the bot's checkout confirmation step.
// Deliberately reuses the exact same pieces the web checkout's Paystack branch uses
// (calculatePaystackCheckoutAmounts, paystackService.initializePayment) — no separate
// fee math or payment logic. This is the ONE place that composes them for a WhatsApp
// buyer; lib/whatsapp/checkout.ts never talks to Paystack directly.
export async function initiateWaBuyerPaystackCheckout(
  input: InitiateWaBuyerPaystackCheckoutInput
): Promise<InitiateWaBuyerPaystackCheckoutResult> {
  const orderResult = await createOrderForWaBuyer({ ...input, paymentMethod: 'paystack' })
  if (!orderResult.success) {
    return { success: false, error: orderResult.error }
  }

  const { customerId } = await findOrCreateBuyerForWaId(input.waId, input.name)
  const email = String(input.shippingInfo?.email || '').trim() || placeholderEmailForWaId(input.waId)

  const paystackAmounts = calculatePaystackCheckoutAmounts(Number(orderResult.totalAmount))
  if (paystackAmounts.payableAmount <= 0) {
    return { success: false, error: 'Invalid order amount for payment initialization' }
  }

  const paymentResult = await paystackService.initializePayment({
    email,
    amount: paystackAmounts.payableAmount,
    orderId: orderResult.orderId,
    customerId,
    items: [
      ...input.items,
      {
        productId: 'paystack-processing-charge',
        title: 'Paystack Processing Charge',
        quantity: 1,
        price: paystackAmounts.chargeAmount,
        vendorId: 'system',
        vendorName: 'Make It Sell',
      },
    ],
  })

  if (!paymentResult.success || !paymentResult.authUrl) {
    return { success: false, error: paymentResult.message || 'Payment initialization failed' }
  }

  return {
    success: true,
    orderId: orderResult.orderId,
    totalAmount: paystackAmounts.orderAmount,
    authorizationUrl: paymentResult.authUrl,
  }
}

// "I received my order" from the buyer's own number — the chat equivalent of the signed
// confirm-received link (app/api/orders/confirm-received-link): same guard (escrow, not
// disputed), same update. `ref` is an optional short order ref when they have several.
export async function markOrderReceived(waId: string, ref?: string): Promise<string> {
  await connectToDatabase()
  const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()
  if (!mapping?.customerId) return "I don't see any orders on this number yet."

  const candidates: any[] = await Order.find({
    customerId: String(mapping.customerId),
    paymentStatus: 'escrow',
    status: { $in: ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'received'] },
  }).sort({ createdAt: -1 }).limit(10).lean()
  const shortRef = (id: string) => String(id || '').slice(0, 8).toUpperCase()
  const wanted = String(ref || '').toUpperCase().replace(/[^A-Z0-9-]/g, '')

  // Already-received orders only matter when the buyer names one (or it's the only one).
  const open = candidates.filter((o) => String(o.status || '') !== 'received')
  let order = open.length === 1 ? open[0] : undefined
  if (wanted) order = candidates.find((o) => shortRef(o.orderId).startsWith(wanted) || String(o.orderId).toUpperCase().startsWith(wanted))
  if (!order && open.length === 0 && candidates.length === 1) order = candidates[0]
  if (!order && open.length > 1) {
    const lines = open.map((o) => {
      const items = (Array.isArray(o.items) && o.items.length ? o.items : (o.vendors || []).flatMap((v: any) => v?.items || []))
      const first = items[0]
      return `- ${shortRef(o.orderId)}: ${first ? `${Number(first.quantity || 1)}x ${first.title || first.name || 'item'}` : 'items'}${items.length > 1 ? ` +${items.length - 1} more` : ''}`
    })
    return `Which order did you receive?\n${lines.join('\n')}\n\nReply e.g. "received ${shortRef(open[0].orderId)}".`
  }
  if (!order) {
    return "I don't see a delivered order waiting for your confirmation. Type \"my orders\" to check their status."
  }
  const disputed = Boolean(order.disputeRaisedAt) || String(order.disputeStatus || '').toLowerCase() === 'active'
  if (disputed) return `Order ${shortRef(order.orderId)} has an open dispute, so it can't be marked received until that's resolved.`
  if (String(order.status || '') === 'received') return `Order ${shortRef(order.orderId)} is already marked as received — thank you!`

  await updateOrder(order.orderId, { status: 'received', receivedAt: new Date() })
  return `Thank you! Order ${shortRef(order.orderId)} is marked as received. The seller is paid after the protection window. If anything's wrong with it, reply "problem with my order" within 5 days and your payment stays protected.`
}
