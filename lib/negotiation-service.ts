// Shared price-negotiation logic (Phase S4 Part B) — extracted from
// app/api/services/negotiate/route.ts's POST and app/api/services/negotiate/[id]/action/
// route.ts's POST so a negotiation created or acted on from EITHER the web UI
// (PriceNegotiationModal.tsx) or WhatsApp (lib/whatsapp/service-negotiation.ts) behaves
// identically and notifies the other party on every channel they're reachable on. Both web
// routes now just do session auth, call the functions below, and map the result to a
// NextResponse — no business logic duplicated between the two callers.
import { connectToDatabase } from '@/lib/mongodb'
import { PriceNegotiation } from '@/lib/models/PriceNegotiation'
import { WhatsAppLink } from '@/lib/models/WhatsAppLink'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { pushToUser } from '@/lib/push-notifications'
import { emailService } from '@/lib/email'
import { getServiceById, getUserById } from '@/lib/mongodb-operations'
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp/client'

export function negotiationRef(negotiationId: string): string {
  return String(negotiationId || '').slice(0, 8).toUpperCase()
}

// For push/email — preserves the exact formatting the original (pre-extraction) web
// routes always used there, unchanged.
function formatNaira(amount: number): string {
  return `₦${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}

// For WhatsApp text — matches lib/whatsapp/service-quote.ts's "NGN " convention (the rest
// of the bot's money formatting) rather than push/email's "₦" symbol, so a buyer/provider
// doesn't see two different currency formats across the same conversation.
function formatNairaWa(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}

export type NegotiationActionResult =
  | { success: true; negotiation: any }
  | { success: false; error: string; status: number; negotiation?: any }

// ---------------------------------------------------------------------------
// WhatsApp fan-out — additive alongside the existing push+email below, no-ops silently for
// a recipient who hasn't linked WhatsApp (same non-regressing precedent as every other
// WhatsApp notification in this codebase, e.g. lib/whatsapp/service-quote.ts's
// notifyProviderNewQuoteRequest). Uses the SAME two templates Phase S4 Part A already
// introduced for the Booking-backed quote-counter flow, since the body shape ("someone
// offered/countered on ref X for service Y at price Z") is identical regardless of which
// underlying collection the ref resolves to.
// ---------------------------------------------------------------------------

async function trySendWa(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[negotiation-service] WhatsApp text send failed for ${waId}:`, error)
  }
}

async function resolveRecipientWaId(kind: 'customer' | 'provider', userId: string): Promise<string> {
  await connectToDatabase()
  if (kind === 'provider') {
    const link: any = await WhatsAppLink.findOne({ vendorId: userId, status: 'linked' }).lean()
    return String(link?.waId || '').trim()
  }
  const mapping: any = await WhatsAppBuyer.findOne({ customerId: userId }).lean()
  return String(mapping?.waId || '').trim()
}

async function notifyPartyWa(params: {
  kind: 'customer' | 'provider'
  userId: string
  negotiationId: string
  freeTextBody: string
  template?: { name: string; params: string[] }
}): Promise<void> {
  try {
    const waId = await resolveRecipientWaId(params.kind, params.userId)
    if (!waId) return

    if (params.template) {
      try {
        await sendTemplateMessage(waId, params.template.name, params.template.params)
        return
      } catch (templateError) {
        console.log(
          `[negotiation-service] ${params.template.name} template send failed, falling back to free text — negotiation ${params.negotiationId}:`,
          templateError
        )
      }
    }

    await trySendWa(waId, params.freeTextBody)
  } catch (error) {
    console.error(`[negotiation-service] notifyPartyWa failed for negotiation ${params.negotiationId}:`, error)
  }
}

// ---------------------------------------------------------------------------
// Email templates — moved verbatim from the two web routes, unchanged.
// ---------------------------------------------------------------------------

function negotiationEmail({
  recipientName,
  otherParty,
  serviceName,
  basePrice,
  offeredPrice,
  message,
  isProvider,
}: {
  recipientName: string
  otherParty: string
  serviceName: string
  basePrice: number
  offeredPrice: number
  message: string
  isProvider: boolean
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://makeitsell.ng'
  const link = isProvider
    ? `${appUrl}/vendor/dashboard?tab=negotiations`
    : `${appUrl}/dashboard?tab=negotiations`

  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:1px solid #f0f0f0">
    <img src="${appUrl}/images/logo.png" alt="Make It Sell" style="height:36px" />
  </div>
  <div style="border-top:3px solid #e53e3e">
    <div style="background:#7b1c1c;padding:20px 32px">
      <h2 style="color:#ffffff;margin:0;font-size:18px">New Price Offer — ${serviceName}</h2>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;color:#2d3748">Hi ${recipientName},</p>
      <p style="color:#4a5568"><strong>${otherParty}</strong> has made a price offer on <strong>${serviceName}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;border-radius:8px;overflow:hidden">
        <tr>
          <td style="padding:10px 14px;background:#f7fafc;font-weight:600;color:#4a5568;border:1px solid #e2e8f0;width:40%">Listed price</td>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#2d3748">₦${basePrice.toLocaleString('en-NG')}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#f7fafc;font-weight:600;color:#4a5568;border:1px solid #e2e8f0">Offered price</td>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#2f855a;font-weight:700;font-size:16px">₦${offeredPrice.toLocaleString('en-NG')}</td>
        </tr>
        ${message ? `<tr><td style="padding:10px 14px;background:#f7fafc;font-weight:600;color:#4a5568;border:1px solid #e2e8f0">Note</td><td style="padding:10px 14px;border:1px solid #e2e8f0;color:#4a5568;font-style:italic">"${message}"</td></tr>` : ''}
      </table>
      <a href="${link}" style="display:inline-block;background:#e53e3e;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">View &amp; Respond</a>
      <p style="margin-top:24px;color:#a0aec0;font-size:12px">This negotiation expires in 48 hours.</p>
    </div>
  </div>
</div>`
}

function actionEmail({
  recipientName,
  senderName,
  serviceName,
  type,
  amount,
  text,
  isRecipientProvider,
}: {
  recipientName: string
  senderName: string
  serviceName: string
  type: string
  amount: number | null
  text: string
  isRecipientProvider: boolean
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://makeitsell.ng'
  const link = isRecipientProvider
    ? `${appUrl}/vendor/dashboard?tab=negotiations`
    : `${appUrl}/dashboard?tab=negotiations`

  const color = type === 'accept' ? '#2f855a' : type === 'reject' ? '#c53030' : '#2b6cb0'
  const label =
    type === 'accept' ? 'Price Agreed ✓' :
    type === 'reject' ? 'Negotiation Ended' :
    'Counter-Offer Received'

  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:1px solid #f0f0f0">
    <img src="${appUrl}/images/logo.png" alt="Make It Sell" style="height:36px" />
  </div>
  <div style="border-top:3px solid #e53e3e">
    <div style="background:#7b1c1c;padding:20px 32px">
      <h2 style="color:#ffffff;margin:0;font-size:18px">${label} — ${serviceName}</h2>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;color:#2d3748">Hi ${recipientName},</p>
      <p style="color:#4a5568"><strong>${senderName}</strong> has responded to the price negotiation for <strong>${serviceName}</strong>.</p>
      <div style="background:#f7fafc;border-left:4px solid ${color};padding:14px 18px;margin:20px 0;border-radius:0 6px 6px 0">
        <p style="margin:0;font-weight:700;color:${color};font-size:15px">${label}</p>
        ${amount ? `<p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#2d3748">₦${Number(amount).toLocaleString('en-NG')}</p>` : ''}
        ${text ? `<p style="margin:8px 0 0;color:#4a5568;font-style:italic">"${text}"</p>` : ''}
      </div>
      ${type !== 'reject' ? `<a href="${link}" style="display:inline-block;background:#e53e3e;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">
        ${type === 'accept' ? 'View Agreement' : 'View &amp; Respond'}
      </a>` : ''}
    </div>
  </div>
</div>`
}

// ---------------------------------------------------------------------------
// createNegotiation — extracted from app/api/services/negotiate/route.ts's POST, unchanged
// behavior other than accepting a plain input object instead of reading a NextRequest, and
// the new additive WhatsApp fan-out to the provider at the end.
// ---------------------------------------------------------------------------

export type CreateNegotiationInput = {
  serviceId: string
  customerId: string
  customerName: string
  customerEmail: string
  amount: number
  text?: string
}

export async function createNegotiation(input: CreateNegotiationInput): Promise<NegotiationActionResult> {
  const { serviceId, customerId, text } = input
  const customerName = input.customerName || 'Customer'
  const customerEmail = input.customerEmail
  const amount = Number(input.amount)

  if (!serviceId || !Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: 'serviceId and a valid amount are required', status: 400 }
  }

  await connectToDatabase()

  const serviceDoc: any = await getServiceById(String(serviceId))
  if (!serviceDoc) return { success: false, error: 'Service not found', status: 404 }

  const providerId = String(serviceDoc.providerId || serviceDoc.vendor_id || '')

  let providerEmail = serviceDoc.providerEmail || ''
  if (!providerEmail && providerId) {
    const provider: any = await getUserById(providerId)
    providerEmail = provider?.email || ''
  }

  // Expire stale open negotiations for this service+customer
  await PriceNegotiation.updateMany(
    { serviceId, customerId, status: 'open', expiresAt: { $lt: new Date() } },
    { $set: { status: 'expired', updatedAt: new Date() } }
  )

  const alreadyOpen = await PriceNegotiation.findOne({ serviceId, customerId, status: 'open' })
  if (alreadyOpen) {
    return {
      success: false,
      error: 'You already have an open negotiation for this service',
      status: 409,
      negotiation: alreadyOpen.toObject(),
    }
  }

  const basePrice = Number(serviceDoc.price || 0)
  const serviceTitle = serviceDoc.title || 'Service'

  const negotiation = await PriceNegotiation.create({
    serviceId,
    providerId,
    customerId,
    customerName,
    customerEmail,
    providerName: serviceDoc.providerName || 'Provider',
    providerEmail,
    serviceName: serviceTitle,
    basePrice,
    messages: [
      {
        id: String(Date.now()),
        senderId: customerId,
        senderName: customerName,
        senderRole: 'customer',
        type: 'offer',
        amount,
        text: text || '',
        createdAt: new Date(),
      },
    ],
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  })

  if (providerId) {
    pushToUser(providerId, {
      title: 'New Price Offer',
      body: `${customerName || 'A customer'} offered ${formatNaira(amount)} for ${serviceTitle}`,
      url: '/vendor/dashboard?tab=negotiations',
      tag: `negotiation-${negotiation._id}`,
    }).catch(() => {})
  }

  if (providerEmail) {
    emailService.sendEmail({
      to: providerEmail,
      subject: `New price offer on "${serviceTitle}"`,
      html: negotiationEmail({
        recipientName: serviceDoc.providerName || 'Provider',
        otherParty: customerName || 'A customer',
        serviceName: serviceTitle,
        basePrice,
        offeredPrice: amount,
        message: text || '',
        isProvider: true,
      }),
    }).catch(() => {})
  }

  if (providerId) {
    const ref = negotiationRef(String(negotiation._id))
    notifyPartyWa({
      kind: 'provider',
      userId: providerId,
      negotiationId: String(negotiation._id),
      freeTextBody: [
        `New offer! Ref ${ref}`,
        `${serviceTitle} — ${formatNairaWa(amount)}`,
        '',
        `Reply "counter ${ref} <amount>" to counter, "accept ${ref}" to accept, or "decline ${ref}" to decline.`,
      ].join('\n'),
      template: { name: 'provider_booking_counter_received', params: [ref, serviceTitle, formatNairaWa(amount)] },
    }).catch(() => {})
  }

  return { success: true, negotiation: negotiation.toObject() }
}

// ---------------------------------------------------------------------------
// applyNegotiationAction — extracted from app/api/services/negotiate/[id]/action/route.ts's
// POST, same unchanged-behavior-plus-WhatsApp-fan-out shape as createNegotiation above.
// ---------------------------------------------------------------------------

export type ApplyNegotiationActionInput = {
  negotiationId: string
  actorId: string
  actorName?: string
  type: 'offer' | 'counter' | 'accept' | 'reject' | 'note'
  amount?: number | null
  text?: string
}

export async function applyNegotiationAction(input: ApplyNegotiationActionInput): Promise<NegotiationActionResult> {
  const { negotiationId, actorId, type } = input
  const amount = input.amount != null ? Number(input.amount) : null
  const text = input.text || ''

  if (!['offer', 'counter', 'accept', 'reject', 'note'].includes(type)) {
    return { success: false, error: 'Invalid action type', status: 400 }
  }

  await connectToDatabase()

  const negotiation: any = await PriceNegotiation.findById(negotiationId)
  if (!negotiation) return { success: false, error: 'Not found', status: 404 }

  if (negotiation.customerId !== actorId && negotiation.providerId !== actorId) {
    return { success: false, error: 'Forbidden', status: 403 }
  }

  if (negotiation.status !== 'open') {
    return {
      success: false,
      error: `Negotiation is already ${negotiation.status}`,
      status: 409,
      negotiation: negotiation.toObject(),
    }
  }

  const senderRole: 'customer' | 'provider' = negotiation.customerId === actorId ? 'customer' : 'provider'
  const senderName = input.actorName || (senderRole === 'customer' ? negotiation.customerName : negotiation.providerName)

  negotiation.messages.push({
    id: String(Date.now()),
    senderId: actorId,
    senderName,
    senderRole,
    type,
    amount,
    text,
    createdAt: new Date(),
  } as any)

  if (type === 'accept') {
    const lastOtherOffer = [...negotiation.messages]
      .reverse()
      .find((m: any) => m.senderRole !== senderRole && (m.type === 'offer' || m.type === 'counter' || m.type === 'accept'))
    negotiation.agreedPrice = amount ? Number(amount) : (lastOtherOffer?.amount ?? null)
    negotiation.status = 'agreed'
  } else if (type === 'reject') {
    negotiation.status = 'rejected'
  }

  await negotiation.save()

  const isCustomer = senderRole === 'customer'
  const otherPartyId = isCustomer ? negotiation.providerId : negotiation.customerId
  const otherPartyEmail = isCustomer ? negotiation.providerEmail : negotiation.customerEmail
  const otherPartyName = isCustomer ? negotiation.providerName : negotiation.customerName

  const pushTitle =
    type === 'accept' ? `Price agreed on ${negotiation.serviceName}!` :
    type === 'reject' ? `Negotiation ended for ${negotiation.serviceName}` :
    `Counter-offer on ${negotiation.serviceName}`

  const pushBody =
    type === 'accept' ? `Both parties agreed on ${formatNaira(negotiation.agreedPrice || 0)}` :
    type === 'reject' ? `${senderName} has ended the negotiation` :
    `${senderName} offered ${formatNaira(Number(amount || 0))}`

  if (otherPartyId) {
    pushToUser(otherPartyId, {
      title: pushTitle,
      body: pushBody,
      url: isCustomer ? '/vendor/dashboard?tab=negotiations' : '/dashboard?tab=negotiations',
      tag: `negotiation-${negotiation._id}`,
    }).catch(() => {})
  }

  if (otherPartyEmail && type !== 'note') {
    emailService.sendEmail({
      to: otherPartyEmail,
      subject:
        type === 'accept' ? `Price agreed for "${negotiation.serviceName}"` :
        type === 'reject' ? `Negotiation ended for "${negotiation.serviceName}"` :
        `Counter-offer on "${negotiation.serviceName}"`,
      html: actionEmail({
        recipientName: otherPartyName,
        senderName,
        serviceName: negotiation.serviceName,
        type,
        amount: amount ? Number(amount) : negotiation.agreedPrice,
        text,
        isRecipientProvider: !isCustomer,
      }),
    }).catch(() => {})
  }

  if (otherPartyId) {
    const ref = negotiationRef(String(negotiation._id))
    const otherKind: 'customer' | 'provider' = isCustomer ? 'provider' : 'customer'

    if (type === 'counter' || type === 'offer') {
      const displayAmount = Number(amount || 0)
      notifyPartyWa({
        kind: otherKind,
        userId: otherPartyId,
        negotiationId: String(negotiation._id),
        freeTextBody: [
          `${otherKind === 'provider' ? 'New counter-offer' : 'Provider responded'}! Ref ${ref}`,
          `${negotiation.serviceName} — ${formatNairaWa(displayAmount)}`,
          '',
          `Reply "accept ${ref}" to accept, "counter ${ref} <amount>" to counter, or "decline ${ref}" to decline.`,
        ].join('\n'),
        template: {
          name: otherKind === 'provider' ? 'provider_booking_counter_received' : 'buyer_booking_counter_received',
          params: [ref, negotiation.serviceName, formatNairaWa(displayAmount)],
        },
      }).catch(() => {})
    } else if (type === 'accept' || type === 'reject') {
      // otherKind === 'customer' means a PROVIDER just accepted/rejected — only the
      // customer can book, so only they get the "book <ref>" nudge.
      const body = type === 'accept'
        ? `Ref ${ref} — price agreed at ${formatNairaWa(negotiation.agreedPrice || 0)}!${otherKind === 'customer' ? ` Reply "book ${ref}" to schedule.` : ' Waiting on the buyer to book.'}`
        : `Ref ${ref} (${negotiation.serviceName}) — the negotiation was declined and is now closed.`
      notifyPartyWa({
        kind: otherKind,
        userId: otherPartyId,
        negotiationId: String(negotiation._id),
        freeTextBody: body,
      }).catch(() => {})
    }
  }

  return { success: true, negotiation: negotiation.toObject() }
}
