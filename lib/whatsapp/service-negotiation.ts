// WhatsApp exposure of the pre-booking PriceNegotiation system (Phase S4 Part B) — for
// requiresQuote: false services only. requiresQuote: true services keep using the
// Booking-backed quote/counter flow in lib/whatsapp/service-quote.ts (Phase S4 Part A)
// instead; see tryHandleServiceOfferReply below for where a quote-required service is
// turned away, same shape as service-booking.ts turning quote-required services away from
// the fixed-price booking flow.
//
// All create/act business logic (and the additive WhatsApp fan-out for WEB-originated
// negotiations) lives in lib/negotiation-service.ts, shared with
// app/api/services/negotiate/*'s routes — this file is just the WhatsApp command surface
// on top of it, mirroring service-quote.ts's ref-based, mode/stage-agnostic command shape.
import connectToDatabase from '@/lib/mongodb'
import { getServiceById, getUserById } from '@/lib/mongodb-operations'
import { WhatsAppServiceMessageMap } from '@/lib/models/WhatsAppServiceMessageMap'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { PriceNegotiation } from '@/lib/models/PriceNegotiation'
import { sendTextMessage } from '@/lib/whatsapp/client'
import { findOrCreateBuyerForWaId, placeholderEmailForWaId } from '@/lib/whatsapp/buyer-identity'
import { createNegotiation, applyNegotiationAction, negotiationRef } from '@/lib/negotiation-service'
import { startBookingWithOverride } from '@/lib/whatsapp/service-booking'

async function trySendText(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-service-negotiation] Text send failed for ${waId}:`, error)
  }
}

function formatNaira(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}

// A party may act (counter/accept/decline) only on the OTHER side's current message —
// never their own still-pending one. Mirrors service-quote.ts's quoteLastOfferBy guard,
// derived here from the message log instead of a dedicated turn field, since
// PriceNegotiation already keeps that full history.
function canAct(negotiation: any, role: 'customer' | 'provider'): boolean {
  const messages = Array.isArray(negotiation?.messages) ? negotiation.messages : []
  const last = messages[messages.length - 1]
  return last?.senderRole !== role
}

const NEGOTIATION_OFFER_PATTERN = /^offer\s+([\d,]+(?:\.\d+)?)$/i
const NEGOTIATION_COUNTER_PATTERN = /^counter\s+([a-f0-9]{6,})\s+([\d,]+(?:\.\d+)?)$/i
const NEGOTIATION_DECISION_PATTERN = /^(accept|decline)\s+([a-f0-9]{6,})$/i
const BOOK_AGREED_PATTERN = /^book\s+([a-f0-9]{6,})$/i

// ---------------------------------------------------------------------------
// Entry point — buyer replies "offer <amount>" to a service-result message
// (lib/whatsapp/service-results.ts). Wired in lib/whatsapp/buyer.ts's contextMessageId
// block, before handleServiceReply, so a non-"offer" reply is unaffected.
// ---------------------------------------------------------------------------

export async function tryHandleServiceOfferReply(waId: string, contextMessageId: string, text: string): Promise<boolean> {
  const match = String(text || '').trim().match(NEGOTIATION_OFFER_PATTERN)
  if (!match) return false

  await connectToDatabase()
  const mapping: any = await WhatsAppServiceMessageMap.findOne({ messageId: contextMessageId }).lean()
  if (!mapping?.serviceId) return false // not a reply to a service card — let handleServiceReply's own lookup try it

  const service: any = await getServiceById(mapping.serviceId)
  if (!service || service.status !== 'active') {
    await trySendText(waId, "Sorry, that service isn't available anymore. Search again to see what's on offer.")
    return true
  }

  if (service.requiresQuote) {
    await trySendText(
      waId,
      `${service.title} needs a quote first — reply to it with a message describing the job to request one. Once the provider sends a price you can negotiate it from there.`
    )
    return true
  }

  const amount = Number(match[1].replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) {
    await trySendText(waId, 'That amount doesn\'t look right. Reply like: offer 15000')
    return true
  }

  const { customerId } = await findOrCreateBuyerForWaId(waId)
  const buyerUser: any = await getUserById(customerId)
  const customerName = buyerUser?.name || buyerUser?.displayName || 'WhatsApp Buyer'
  const customerEmail = buyerUser?.email || placeholderEmailForWaId(waId)

  const result = await createNegotiation({
    serviceId: String(service.id || mapping.serviceId),
    customerId,
    customerName,
    customerEmail,
    amount,
  })

  if (!result.success) {
    if (result.negotiation) {
      const ref = negotiationRef(String(result.negotiation._id))
      await trySendText(waId, `You already have an open offer on this service (ref ${ref}). Reply "counter ${ref} <amount>" or "decline ${ref}" first.`)
      return true
    }
    await trySendText(waId, `Couldn't send that offer: ${result.error}`)
    return true
  }

  const ref = negotiationRef(String(result.negotiation._id))
  await trySendText(waId, `Offer sent — ${ref} for ${formatNaira(amount)}. We'll let you know when the provider responds.`)
  return true
}

// ---------------------------------------------------------------------------
// Buyer-side counter/accept/decline — dispatched from lib/whatsapp/buyer.ts right after
// Phase S4 Part A's Booking-based checks (tryHandleQuoteDecision, tryHandleQuoteCounter),
// which fall through (return false) rather than error when a ref isn't one of the buyer's
// quoted bookings. This function is the last stop for that ref, so — unlike Part A's
// functions — it owns the final "couldn't find anything with that reference" message.
// ---------------------------------------------------------------------------

export async function tryHandleNegotiationReply(waId: string, text: string): Promise<boolean> {
  const trimmed = String(text || '').trim()

  const counterMatch = trimmed.match(NEGOTIATION_COUNTER_PATTERN)
  const decisionMatch = !counterMatch ? trimmed.match(NEGOTIATION_DECISION_PATTERN) : null
  if (!counterMatch && !decisionMatch) return false

  const ref = (counterMatch ? counterMatch[1] : decisionMatch![2]).toLowerCase()

  const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()
  if (!mapping?.customerId) {
    await trySendText(waId, `Couldn't find an active offer or quote with reference ${ref.toUpperCase()} — it may have already been handled or expired.`)
    return true
  }

  await connectToDatabase()
  const candidates: any[] = await PriceNegotiation.find({ customerId: mapping.customerId, status: 'open' })
    .select('_id messages')
    .lean()
  const negotiation = candidates.find((n) => negotiationRef(String(n._id)).toLowerCase() === ref)

  if (!negotiation) {
    await trySendText(waId, `Couldn't find an active offer or quote with reference ${ref.toUpperCase()} — it may have already been handled or expired.`)
    return true
  }

  if (!canAct(negotiation, 'customer')) {
    await trySendText(waId, `You already responded on ${ref.toUpperCase()} — waiting on the provider.`)
    return true
  }

  const negotiationId = String(negotiation._id)

  if (counterMatch) {
    const amount = Number(counterMatch[2].replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) {
      await trySendText(waId, `That amount doesn't look right. Reply like: counter ${ref.toUpperCase()} 15000`)
      return true
    }
    const result = await applyNegotiationAction({ negotiationId, actorId: mapping.customerId, actorName: mapping.customerName, type: 'counter', amount, text: '' })
    if (!result.success) {
      await trySendText(waId, `Couldn't send that counter: ${result.error}`)
      return true
    }
    await trySendText(waId, `Counter sent — ${ref.toUpperCase()} at ${formatNaira(amount)}. We'll let you know when the provider responds.`)
    return true
  }

  const action = decisionMatch![1].toLowerCase() as 'accept' | 'decline'
  const type = action === 'accept' ? 'accept' : 'reject'
  const lastOtherOffer = [...(negotiation.messages || [])]
    .reverse()
    .find((m: any) => m.senderRole !== 'customer' && (m.type === 'offer' || m.type === 'counter'))

  const result = await applyNegotiationAction({
    negotiationId,
    actorId: mapping.customerId,
    actorName: mapping.customerName,
    type,
    amount: type === 'accept' ? Number(lastOtherOffer?.amount || 0) : null,
    text: '',
  })

  if (!result.success) {
    await trySendText(waId, `Couldn't ${action} that offer: ${result.error}`)
    return true
  }

  if (type === 'reject') {
    await trySendText(waId, `Offer declined — ${ref.toUpperCase()} is now closed.`)
    return true
  }

  await trySendText(waId, `Offer accepted — ${ref.toUpperCase()} at ${formatNaira(result.negotiation.agreedPrice || 0)}. Reply "book ${ref.toUpperCase()}" to schedule.`)
  return true
}

// ---------------------------------------------------------------------------
// Provider-side counter/accept/decline — dispatched from lib/whatsapp/commands.ts right
// after Phase S4 Part A's tryHandleProviderNegotiationCommand. Unlike the buyer-side
// function above, a not-found ref here just falls through to the existing generic vendor
// help menu (commands.ts's sendHelpMenu) rather than a dedicated message — same as any
// other unrecognized vendor command today.
// ---------------------------------------------------------------------------

export async function tryHandleProviderOfferCommand(waId: string, vendorId: string, text: string): Promise<boolean> {
  const trimmed = String(text || '').trim()

  const counterMatch = trimmed.match(NEGOTIATION_COUNTER_PATTERN)
  const decisionMatch = !counterMatch ? trimmed.match(NEGOTIATION_DECISION_PATTERN) : null
  if (!counterMatch && !decisionMatch) return false

  const ref = (counterMatch ? counterMatch[1] : decisionMatch![2]).toLowerCase()

  await connectToDatabase()
  const candidates: any[] = await PriceNegotiation.find({ providerId: vendorId, status: 'open' })
    .select('_id messages providerName')
    .lean()
  const negotiation = candidates.find((n) => negotiationRef(String(n._id)).toLowerCase() === ref)
  if (!negotiation) return false

  if (!canAct(negotiation, 'provider')) {
    await trySendText(waId, `You already responded on ${ref.toUpperCase()} — waiting on the buyer.`)
    return true
  }

  const negotiationId = String(negotiation._id)

  if (counterMatch) {
    const amount = Number(counterMatch[2].replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) {
      await trySendText(waId, `That amount doesn't look right. Reply like: counter ${ref.toUpperCase()} 15000`)
      return true
    }
    const result = await applyNegotiationAction({ negotiationId, actorId: vendorId, actorName: negotiation.providerName, type: 'counter', amount, text: '' })
    if (!result.success) {
      await trySendText(waId, `Couldn't send that counter: ${result.error}`)
      return true
    }
    await trySendText(waId, `Counter sent — ${ref.toUpperCase()} at ${formatNaira(amount)}. The buyer will be notified.`)
    return true
  }

  const action = decisionMatch![1].toLowerCase() as 'accept' | 'decline'
  const type = action === 'accept' ? 'accept' : 'reject'
  const lastOtherOffer = [...(negotiation.messages || [])]
    .reverse()
    .find((m: any) => m.senderRole !== 'provider' && (m.type === 'offer' || m.type === 'counter'))

  const result = await applyNegotiationAction({
    negotiationId,
    actorId: vendorId,
    actorName: negotiation.providerName,
    type,
    amount: type === 'accept' ? Number(lastOtherOffer?.amount || 0) : null,
    text: '',
  })

  if (!result.success) {
    await trySendText(waId, `Couldn't ${action} that offer: ${result.error}`)
    return true
  }

  if (type === 'reject') {
    await trySendText(waId, `Offer declined — ${ref.toUpperCase()} is now closed.`)
    return true
  }

  await trySendText(waId, `Offer accepted — ${ref.toUpperCase()} at ${formatNaira(result.negotiation.agreedPrice || 0)}. We've asked the buyer to book.`)
  return true
}

// ---------------------------------------------------------------------------
// "book <ref>" — hands an agreed negotiation off into the existing S2 package/slot flow
// (lib/whatsapp/service-booking.ts's startBookingWithOverride), same trust-gap-closed path
// the web BookingModal now uses (lib/booking-payment.ts's initiateBookingPayment claims and
// validates the negotiation server-side — the price here is never trusted from the client).
// ---------------------------------------------------------------------------

export async function tryHandleBookAgreedCommand(waId: string, text: string): Promise<boolean> {
  const match = String(text || '').trim().match(BOOK_AGREED_PATTERN)
  if (!match) return false

  const ref = match[1].toLowerCase()

  const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()
  if (!mapping?.customerId) return false

  await connectToDatabase()
  const candidates: any[] = await PriceNegotiation.find({ customerId: mapping.customerId, status: 'agreed', consumedByBookingId: null })
    .select('_id serviceId agreedPrice')
    .lean()
  const negotiation = candidates.find((n) => negotiationRef(String(n._id)).toLowerCase() === ref)

  if (!negotiation) {
    await trySendText(waId, `Couldn't find an agreed offer with reference ${ref.toUpperCase()} ready to book — it may already be booked or is no longer valid.`)
    return true
  }

  const service: any = await getServiceById(String(negotiation.serviceId))
  if (!service || service.status !== 'active') {
    await trySendText(waId, "Sorry, that service isn't available anymore.")
    return true
  }

  await startBookingWithOverride(waId, service, String(negotiation._id), Number(negotiation.agreedPrice || 0))
  return true
}
