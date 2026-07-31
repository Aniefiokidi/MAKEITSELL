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
import { buildOrder, type BuildOrderResult } from '@/lib/order-creation'
import { findOrCreateBuyerForWaId, placeholderEmailForWaId } from '@/lib/whatsapp/buyer-identity'

export type CreateOrderForWaBuyerInput = {
  waId: string
  name?: string
  items: any[]
  shippingInfo: any
  paymentMethod: string
  shipbubbleSelections?: Record<string, any>
}

export async function createOrderForWaBuyer(input: CreateOrderForWaBuyerInput): Promise<BuildOrderResult> {
  const { waId, name, items, shippingInfo, paymentMethod, shipbubbleSelections } = input

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
    shipbubbleSelections,
  })
}
