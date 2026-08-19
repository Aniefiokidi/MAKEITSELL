// WhatsApp quote-request conversation (Phase S3, Parts A & B) — for requiresQuote: true
// services. Buyer describes the job (with optional photos), the request lands as an
// ordinary fee-free booking via the SAME initiateBookingPayment path S1/S2 already use
// (lib/booking-payment.ts), so it shows up in the provider's existing dashboard
// (app/vendor/bookings/page.tsx) exactly like a web-submitted request. The provider can
// quote from that dashboard (Part A, unchanged) OR from their own WhatsApp (Part B,
// handleProviderQuoteCommand below, dispatched from lib/whatsapp/commands.ts) — both set
// the exact same pricingStatus/finalPrice/quoteSentAt fields, so quote-delivery
// (notifyWaBuyerQuoteReceived) and quote-acceptance (initiatePaymentForQuotedBooking,
// lib/booking-payment.ts) already work identically regardless of which path quoted it.
import { after } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { getServiceById } from '@/lib/mongodb-operations'
import { Booking } from '@/lib/models/Booking'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { WhatsAppLink } from '@/lib/models/WhatsAppLink'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp/client'
import { downloadWhatsAppMedia } from '@/lib/whatsapp/media'
import { uploadBufferToCloudinary } from '@/lib/cloudinary-server-upload'
import { findBookingSlotConflict } from '@/lib/booking-availability'
import { expireStalePendingBookings } from '@/lib/booking-expiry'
import { createBookingForWaBuyer, acceptQuoteForWaBuyer } from '@/lib/whatsapp/buyer-bookings'

export const QUOTE_BLOCKING_STAGES = new Set([
  'collecting_quote_description',
  'collecting_quote_location',
  'choosing_quote_slot',
  'collecting_quote_photos',
])

const MAX_REQUEST_PHOTOS = 5

async function trySendText(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-service-quote] Text send failed for ${waId}:`, error)
  }
}

async function loadState(waId: string): Promise<any> {
  await connectToDatabase()
  return WhatsAppBrowseState.findOne({ waId }).lean()
}

async function saveState(waId: string, patch: Record<string, any>): Promise<void> {
  await connectToDatabase()
  await WhatsAppBrowseState.findOneAndUpdate(
    { waId },
    { $set: { ...patch, updatedAt: new Date() } },
    { upsert: true }
  )
}

function formatNaira(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}

function shortRef(bookingId: string): string {
  return String(bookingId || '').slice(0, 8).toUpperCase()
}

// ---------------------------------------------------------------------------
// Entry point — called from handleServiceReply (lib/whatsapp/service-booking.ts) when the
// selected service has requiresQuote: true, replacing the old S1/S2-era placeholder.
// ---------------------------------------------------------------------------

export async function startQuoteRequest(waId: string, service: any): Promise<void> {
  const draft = {
    serviceId: String(service.id || service._id),
    providerId: service.providerId,
    providerName: service.providerName,
    serviceTitle: service.title,
    locationType: service.locationType,
    location: service.location,
    // Booking.totalPrice is schema-required even for a requiresQuote booking — the web
    // flow (app/api/database/bookings/route.ts) satisfies this the same way, using the
    // service's flat price as a starting estimate before any real quote exists. Not shown
    // to the buyer as a commitment; finalPrice from the provider's actual quote is what
    // initiatePaymentForQuotedBooking (lib/booking-payment.ts) charges against.
    estimatedPrice: Number(service.price) || 0,
    requestPhotos: [] as string[],
  }
  await saveState(waId, { stage: 'collecting_quote_description', bookingDraft: draft })
  await trySendText(waId, `Let's get you a quote for ${service.title}. First, describe what you need.`)
}

async function handleDescriptionReply(waId: string, text: string, draft: Record<string, any>): Promise<void> {
  const trimmed = String(text || '').trim()
  if (!trimmed) {
    await trySendText(waId, 'Please describe what you need — a sentence or two is fine.')
    return
  }
  const nextDraft: Record<string, any> = { ...draft, notes: trimmed.slice(0, 2000) }
  await saveState(waId, { stage: 'collecting_quote_location', bookingDraft: nextDraft })
  await trySendText(waId, 'Where do you need this? (e.g. "Lekki, Lagos")')
}

async function handleLocationReply(waId: string, text: string, draft: Record<string, any>): Promise<void> {
  const trimmed = String(text || '').trim()
  if (!trimmed) {
    await trySendText(waId, 'Please share a location, even a rough one.')
    return
  }
  const nextDraft: Record<string, any> = { ...draft, customerLocation: trimmed.slice(0, 500) }
  await saveState(waId, { stage: 'choosing_quote_slot', bookingDraft: nextDraft })
  await trySendText(waId, 'What date and time works for you? (Your best estimate is fine — the provider may adjust it.)\n\nReply like: 2026-08-20 14:00')
}

// Same format/validation as service-booking.ts's SLOT_PATTERN/computeEndTime — not
// imported from there to avoid coupling the two conversation files together over a ~10-
// line regex; both independently rely on findBookingSlotConflict (lib/booking-
// availability.ts) as the actual source of truth, which IS shared.
const SLOT_PATTERN = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})$/
const DEFAULT_QUOTE_DURATION_MINUTES = 60

function computeEndTime(startTime: string, durationMinutes: number): string {
  const [hour, minute] = startTime.split(':').map(Number)
  const endTotal = hour * 60 + minute + Math.max(1, durationMinutes)
  const endHour = Math.floor(endTotal / 60) % 24
  const endMinute = endTotal % 60
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
}

async function handleSlotReply(waId: string, text: string, draft: Record<string, any>): Promise<void> {
  const match = String(text || '').trim().match(SLOT_PATTERN)
  if (!match) {
    await trySendText(waId, 'Please send both a date and time, like: 2026-08-20 14:00')
    return
  }

  const [, dateStr, startTime] = match
  const bookingDate = new Date(dateStr)
  if (Number.isNaN(bookingDate.getTime()) || bookingDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    await trySendText(waId, "That date doesn't look right — please send a valid upcoming date, like: 2026-08-20 14:00")
    return
  }

  const [hourPart] = startTime.split(':').map(Number)
  if (!Number.isInteger(hourPart) || hourPart > 23) {
    await trySendText(waId, 'Please send a valid time in 24h format, like: 14:00')
    return
  }

  const endTime = computeEndTime(startTime, DEFAULT_QUOTE_DURATION_MINUTES)

  // Same on-demand cleanup as the fixed-price flow (lib/booking-expiry.ts) — a quote
  // request holds its slot the same way a paid booking does (see the module comment on
  // requestPhotos in lib/models/Booking.ts's neighboring fields), so this matters here too.
  await expireStalePendingBookings({ providerId: draft.providerId })

  const conflict = await findBookingSlotConflict({ providerId: draft.providerId, bookingDate, startTime, endTime })
  if (conflict) {
    await trySendText(waId, `That slot's taken (${conflict.startTime}–${conflict.endTime} is already booked). Please suggest a different time.`)
    return
  }

  const nextDraft: Record<string, any> = { ...draft, bookingDate: bookingDate.toISOString(), startTime, endTime, duration: DEFAULT_QUOTE_DURATION_MINUTES }
  await saveState(waId, { stage: 'collecting_quote_photos', bookingDraft: nextDraft })
  await trySendText(waId, 'Send photos of the job if you have any — up to 5. Reply "done" when finished, or "skip" if you have none.')
}

// Tells a linked provider a new quote request is waiting, with enough context to quote
// without opening the dashboard, and the exact command to do it from WhatsApp (Part B).
// No-ops silently if the provider hasn't linked WhatsApp — the request still shows up in
// their dashboard exactly as before, nothing regresses for an unlinked provider.
async function notifyProviderNewQuoteRequest(providerId: string, bookingId: string, draft: Record<string, any>): Promise<void> {
  try {
    await connectToDatabase()
    const link: any = await WhatsAppLink.findOne({ vendorId: providerId, status: 'linked' }).lean()
    const waId = String(link?.waId || '').trim()
    if (!waId) return

    const ref = shortRef(bookingId)
    const photoCount = Array.isArray(draft.requestPhotos) ? draft.requestPhotos.length : 0
    const lines = [
      `New quote request! Ref ${ref}`,
      `${draft.serviceTitle || 'Service'}`,
      '',
      `Job: ${draft.notes || 'No description given'}`,
      `Location: ${draft.customerLocation || 'Not specified'}`,
    ]
    if (photoCount > 0) lines.push(`${photoCount} photo(s) attached — view in your dashboard.`)
    lines.push('', `Reply "quote ${ref} <amount>" to send a price, e.g. "quote ${ref} 20000".`)

    await trySendText(waId, lines.join('\n'))
  } catch (error) {
    console.error(`[whatsapp-service-quote] notifyProviderNewQuoteRequest failed for booking ${bookingId}:`, error)
  }
}

async function submitQuoteRequest(waId: string, draft: Record<string, any>): Promise<void> {
  const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()

  const result = await createBookingForWaBuyer({
    waId,
    name: mapping?.customerName,
    bookingData: {
      serviceId: draft.serviceId,
      providerId: draft.providerId,
      providerName: draft.providerName,
      serviceTitle: draft.serviceTitle,
      notes: draft.notes,
      customerLocation: draft.customerLocation,
      requestPhotos: Array.isArray(draft.requestPhotos) ? draft.requestPhotos : [],
      bookingDate: draft.bookingDate,
      startTime: draft.startTime,
      endTime: draft.endTime,
      duration: draft.duration,
      requiresQuote: true,
      pricingStatus: 'estimated',
      estimatedPrice: draft.estimatedPrice,
      totalPrice: draft.estimatedPrice,
      locationType: draft.locationType,
      location: draft.location,
    },
  })

  await saveState(waId, { stage: 'browsing', bookingDraft: {} })

  if (!result.success) {
    await trySendText(waId, `Couldn't submit that request: ${result.error}. Please try again — reply to the service to restart.`)
    return
  }

  await trySendText(
    waId,
    `Request sent! Ref ${shortRef(result.bookingId)}. The provider will review it and send a quote — we'll message you here as soon as it's ready.`
  )

  await notifyProviderNewQuoteRequest(String(draft.providerId || ''), String(result.bookingId), draft)
}

async function handlePhotoReply(waId: string, text: string, draft: Record<string, any>): Promise<void> {
  const trimmed = String(text || '').trim().toLowerCase()
  if (trimmed === 'done' || trimmed === 'skip' || trimmed === 'none') {
    await submitQuoteRequest(waId, draft)
    return
  }
  await trySendText(waId, `Send a photo, or reply "done" to submit your request${Array.isArray(draft.requestPhotos) && draft.requestPhotos.length > 0 ? ` (${draft.requestPhotos.length} photo(s) attached so far)` : ''}.`)
}

// Called from lib/whatsapp/commands.ts's handleInboundImageMessage when the sender is
// mid-quote-request — routed there instead of goods' photo product-search, since a photo
// sent while describing a job is a request attachment, not a "find me this product" query.
export async function handleQuoteRequestPhoto(waId: string, mediaId: string, draft: Record<string, any>): Promise<void> {
  const existing = Array.isArray(draft.requestPhotos) ? draft.requestPhotos : []
  if (existing.length >= MAX_REQUEST_PHOTOS) {
    await trySendText(waId, `That's the max of ${MAX_REQUEST_PHOTOS} photos — reply "done" to submit your request.`)
    return
  }

  const media = await downloadWhatsAppMedia(mediaId)
  if (!media) {
    await trySendText(waId, "Couldn't download that photo — please try sending it again, or reply \"done\" to submit without it.")
    return
  }

  const url = await uploadBufferToCloudinary(media.buffer, media.mimeType)
  if (!url) {
    await trySendText(waId, "Couldn't save that photo — please try again, or reply \"done\" to submit without it.")
    return
  }

  const nextPhotos = [...existing, url]
  const nextDraft: Record<string, any> = { ...draft, requestPhotos: nextPhotos }
  await saveState(waId, { bookingDraft: nextDraft })
  await trySendText(waId, `Photo added (${nextPhotos.length}/${MAX_REQUEST_PHOTOS}). Send another, or reply "done" to submit.`)
}

// ---------------------------------------------------------------------------
// Dispatcher + cancel — same shape as service-booking.ts's equivalents, for the disjoint
// QUOTE_BLOCKING_STAGES set.
// ---------------------------------------------------------------------------

async function resetQuoteState(waId: string): Promise<void> {
  await saveState(waId, { stage: 'browsing', bookingDraft: {} })
}

export async function handleQuoteCancelCommand(waId: string, stage: string): Promise<boolean> {
  if (!QUOTE_BLOCKING_STAGES.has(stage)) return false
  await resetQuoteState(waId)
  await trySendText(waId, 'Quote request cancelled. Reply "categories" to keep browsing services.')
  return true
}

export async function handleQuoteStageMessage(waId: string, text: string, stage: string): Promise<void> {
  const state = await loadState(waId)
  const draft = state?.bookingDraft || {}

  switch (stage) {
    case 'collecting_quote_description':
      await handleDescriptionReply(waId, text, draft)
      return
    case 'collecting_quote_location':
      await handleLocationReply(waId, text, draft)
      return
    case 'choosing_quote_slot':
      await handleSlotReply(waId, text, draft)
      return
    case 'collecting_quote_photos':
      await handlePhotoReply(waId, text, draft)
      return
    default:
      return
  }
}

// ---------------------------------------------------------------------------
// Quote delivery — called from app/api/database/bookings/[id]/route.ts's PATCH handler
// the moment a provider sends a quote from their dashboard (pricingStatus -> 'quoted'),
// exactly the same "detect the transition, fire a notification" shape that route already
// uses for the confirmed-status SMS block just above where this is called from.
// ---------------------------------------------------------------------------

export function notifyWaBuyerQuoteReceived(customerId: string, bookingId: string, booking: any): void {
  after(async () => {
    try {
      await connectToDatabase()
      const mapping: any = await WhatsAppBuyer.findOne({ customerId }).lean()
      if (!mapping?.waId) return // not a WhatsApp buyer — nothing to do

      const waId = String(mapping.waId)
      const finalPrice = Number(booking?.finalPrice || 0)
      const { computeBookingDeposit } = await import('@/lib/booking-pricing')
      const { depositAmount, bookingFeeAmount, balanceOwed, amountDueNow } = computeBookingDeposit(finalPrice)
      const ref = shortRef(bookingId)
      const serviceTitle = booking?.serviceTitle || 'Service'
      const payNowLabel = `${formatNaira(amountDueNow)} (${formatNaira(depositAmount)} deposit + ${formatNaira(bookingFeeAmount)} booking fee)`

      const freeTextBody = [
        `Your quote is ready! Ref ${ref}`,
        `${serviceTitle} — ${formatNaira(finalPrice)}`,
        '',
        `Pay now: ${payNowLabel}`,
        `Balance of ${formatNaira(balanceOwed)} is paid directly to the provider.`,
        '',
        `Reply "accept ${ref}" to pay, "counter ${ref} <amount>" to negotiate, or "decline ${ref}" to close this request.`,
      ].join('\n')

      // Highest-risk send in the buyer-facing set to fire outside Meta's 24h window — a
      // provider can quote hours or days after the buyer's last message, unlike the paid
      // confirmation above which follows close behind the buyer's own payment action.
      // Same template-first/free-text-fallback pattern as the rest of this file's sends.
      try {
        await sendTemplateMessage(waId, 'buyer_booking_quote_received', [ref, serviceTitle, formatNaira(finalPrice), payNowLabel, formatNaira(balanceOwed)])
      } catch (templateError) {
        console.log(`[whatsapp-service-quote] buyer_booking_quote_received template send failed, falling back to free text — booking ${bookingId}:`, templateError)
        await trySendText(waId, freeTextBody)
      }
    } catch (error) {
      console.error(`[whatsapp-service-quote] notifyWaBuyerQuoteReceived failed for booking ${bookingId}:`, error)
    }
  })
}

// ---------------------------------------------------------------------------
// Quote accept/decline/counter — deliberately keyword-based ("accept REF"/"decline
// REF"/"counter REF AMOUNT"), not a blocking stage. A quote can arrive hours or days after
// the request, by which point the buyer's current stage/mode could be anything (mid-goods-
// checkout, browsing something else entirely) — forcing a stage change on notification
// would hijack whatever they were doing. This works from any state instead, checked in
// lib/whatsapp/buyer.ts's main dispatch alongside the other mode-agnostic patterns
// (ORDER_STATUS_PATTERN etc).
//
// Phase S4 Part A: every function below that resolves a ref against the buyer's own
// bookings returns `false` (not a "couldn't find" message) when the ref doesn't match any
// of THEIR quoted bookings — this lets the ref fall through to
// lib/whatsapp/service-negotiation.ts's PriceNegotiation lookup (Phase S4 Part B), which
// owns the final "couldn't find anything with that reference" message. Once a ref DOES
// resolve to one of the buyer's bookings, this file owns the whole response from then on
// (including turn/round-limit rejections) — it never falls through past that point.
// ---------------------------------------------------------------------------

const QUOTE_DECISION_PATTERN = /^(accept|decline)\s+([a-f0-9]{6,})$/i
const QUOTE_COUNTER_PATTERN = /^counter\s+([a-f0-9]{6,})\s+([\d,]+(?:\.\d+)?)$/i
const MAX_QUOTE_NEGOTIATION_ROUNDS = 3

export async function tryHandleQuoteDecision(waId: string, text: string): Promise<boolean> {
  const match = String(text || '').trim().match(QUOTE_DECISION_PATTERN)
  if (!match) return false

  const action = match[1].toLowerCase()
  const ref = match[2].toLowerCase()

  const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()
  if (!mapping?.customerId) return false

  await connectToDatabase()
  const candidates: any[] = await Booking.find({ customerId: mapping.customerId, pricingStatus: 'quoted' })
    .select('_id quoteLastOfferBy providerId serviceTitle')
    .lean()
  const match_ = candidates.find((b) => String(b._id).slice(0, 8).toLowerCase() === ref)

  if (!match_) return false

  // A buyer can only accept/decline the OTHER side's current number, never their own
  // still-pending counter. Undefined quoteLastOfferBy predates any negotiation and always
  // means "provider's offer", so this only ever blocks the buyer's own counter.
  if (match_.quoteLastOfferBy === 'buyer') {
    await trySendText(waId, `You already sent a counter for ${ref.toUpperCase()} — waiting on the provider's response.`)
    return true
  }

  const bookingId = String(match_._id)

  if (action === 'decline') {
    const updated: any = await Booking.findOneAndUpdate(
      { _id: bookingId, pricingStatus: 'quoted' },
      { $set: { status: 'cancelled', cancelledAt: new Date(), cancellationReason: 'Buyer declined the quote' } },
      { new: true }
    ).lean()
    await trySendText(waId, 'Quote declined — that request is now closed.')
    if (updated) notifyProviderQuoteClosed(String(updated.providerId || match_.providerId || ''), bookingId, updated)
    return true
  }

  const result = await acceptQuoteForWaBuyer(bookingId)
  if (!result.success) {
    await trySendText(waId, `Couldn't accept that quote: ${result.error}`)
    return true
  }
  if (!result.requiresPayment) {
    await trySendText(waId, 'Quote accepted.')
    return true
  }

  await trySendText(
    waId,
    `Tap the link below to pay ${formatNaira(result.payableAmount)} securely:\n\n${result.authorization_url}\n\nOnce payment is confirmed we'll message you here.`
  )
  return true
}

// Buyer-side counter, symmetric to tryHandleProviderNegotiationCommand's counter branch
// below. Only reachable while pricingStatus:'quoted' and it's the buyer's turn
// (quoteLastOfferBy !== 'buyer'), capped at MAX_QUOTE_NEGOTIATION_ROUNDS total counters
// (either direction combined) before forcing an accept/decline.
export async function tryHandleQuoteCounter(waId: string, text: string): Promise<boolean> {
  const match = String(text || '').trim().match(QUOTE_COUNTER_PATTERN)
  if (!match) return false

  const ref = match[1].toLowerCase()
  const amount = Number(match[2].replace(/,/g, ''))

  const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()
  if (!mapping?.customerId) return false

  await connectToDatabase()
  const candidates: any[] = await Booking.find({ customerId: mapping.customerId, pricingStatus: 'quoted' })
    .select('_id quoteLastOfferBy quoteNegotiationRound serviceId serviceTitle providerId')
    .lean()
  const match_ = candidates.find((b) => String(b._id).slice(0, 8).toLowerCase() === ref)
  if (!match_) return false

  if (!Number.isFinite(amount) || amount <= 0) {
    await trySendText(waId, `That amount doesn't look right. Reply like: counter ${ref.toUpperCase()} 15000`)
    return true
  }

  if (match_.quoteLastOfferBy === 'buyer') {
    await trySendText(waId, `You already sent a counter for ${ref.toUpperCase()} — waiting on the provider's response.`)
    return true
  }

  const round = Number(match_.quoteNegotiationRound) || 0
  if (round >= MAX_QUOTE_NEGOTIATION_ROUNDS) {
    await trySendText(waId, `You've reached the limit of ${MAX_QUOTE_NEGOTIATION_ROUNDS} counters for ${ref.toUpperCase()}. Reply "accept ${ref.toUpperCase()}" or "decline ${ref.toUpperCase()}" to close it out.`)
    return true
  }

  const bookingId = String(match_._id)
  const service = await getServiceById(String(match_.serviceId || ''))
  const quoteSlaHours = Number((service as any)?.quoteSlaHours) > 0 ? Number((service as any)?.quoteSlaHours) : 24

  // Atomic guard mirrors tryHandleProviderQuoteCommand's — only applies if it's still the
  // buyer's turn at write time, so a near-simultaneous provider counter can't be clobbered.
  const updatedBooking: any = await Booking.findOneAndUpdate(
    { _id: bookingId, customerId: mapping.customerId, pricingStatus: 'quoted', quoteLastOfferBy: { $ne: 'buyer' } },
    {
      $set: {
        finalPrice: amount,
        totalPrice: amount,
        quoteLastOfferBy: 'buyer',
        quoteExpiresAt: new Date(Date.now() + quoteSlaHours * 60 * 60 * 1000),
      },
      $inc: { quoteNegotiationRound: 1 },
      $push: { quoteNegotiationHistory: { by: 'buyer', amount, at: new Date() } },
    },
    { new: true }
  ).lean()

  if (!updatedBooking) {
    await trySendText(waId, `Couldn't send that counter — the status just changed. Check the latest update and try again.`)
    return true
  }

  await trySendText(waId, `Counter sent — ${ref.toUpperCase()} at ${formatNaira(amount)}. We'll let you know when the provider responds.`)
  notifyProviderCounterReceived(String(match_.providerId || ''), bookingId, updatedBooking)
  return true
}

// Free-text-only (no template) — a decline is a terminal, low-urgency state, matching the
// existing precedent that S3's decline branch never needed a template either. Additive fix
// to already-shipped S3 behavior: previously the provider was never told a buyer declined
// at all; a negotiation (unlike a one-shot quote) needs both sides to know it ended.
function notifyProviderQuoteClosed(providerId: string, bookingId: string, booking: any): void {
  after(async () => {
    try {
      await connectToDatabase()
      const link: any = await WhatsAppLink.findOne({ vendorId: providerId, status: 'linked' }).lean()
      const waId = String(link?.waId || '').trim()
      if (!waId) return
      const ref = shortRef(bookingId)
      const serviceTitle = booking?.serviceTitle || 'Service'
      await trySendText(waId, `Ref ${ref} (${serviceTitle}) — the buyer declined and this request is now closed.`)
    } catch (error) {
      console.error(`[whatsapp-service-quote] notifyProviderQuoteClosed failed for booking ${bookingId}:`, error)
    }
  })
}

function notifyWaBuyerQuoteClosed(customerId: string, bookingId: string, booking: any): void {
  after(async () => {
    try {
      await connectToDatabase()
      const mapping: any = await WhatsAppBuyer.findOne({ customerId }).lean()
      if (!mapping?.waId) return
      const ref = shortRef(bookingId)
      const serviceTitle = booking?.serviceTitle || 'Service'
      await trySendText(String(mapping.waId), `Ref ${ref} (${serviceTitle}) — the provider declined your counter and this request is now closed.`)
    } catch (error) {
      console.error(`[whatsapp-service-quote] notifyWaBuyerQuoteClosed failed for booking ${bookingId}:`, error)
    }
  })
}

// Highest-risk sends in this pair to fire outside Meta's 24h window (same reasoning as
// notifyWaBuyerQuoteReceived above) — template-first, free-text fallback.
function notifyProviderCounterReceived(providerId: string, bookingId: string, booking: any): void {
  after(async () => {
    try {
      await connectToDatabase()
      const link: any = await WhatsAppLink.findOne({ vendorId: providerId, status: 'linked' }).lean()
      const waId = String(link?.waId || '').trim()
      if (!waId) return

      const ref = shortRef(bookingId)
      const amount = Number(booking?.finalPrice || 0)
      const serviceTitle = booking?.serviceTitle || 'Service'
      const freeTextBody = [
        `New counter-offer! Ref ${ref}`,
        `${serviceTitle} — buyer offered ${formatNaira(amount)}`,
        '',
        `Reply "counter ${ref} <amount>" to counter back, "accept ${ref}" to accept, or "decline ${ref}" to close it.`,
      ].join('\n')

      try {
        await sendTemplateMessage(waId, 'provider_booking_counter_received', [ref, serviceTitle, formatNaira(amount)])
      } catch (templateError) {
        console.log(`[whatsapp-service-quote] provider_booking_counter_received template send failed, falling back to free text — booking ${bookingId}:`, templateError)
        await trySendText(waId, freeTextBody)
      }
    } catch (error) {
      console.error(`[whatsapp-service-quote] notifyProviderCounterReceived failed for booking ${bookingId}:`, error)
    }
  })
}

function notifyWaBuyerCounterReceived(customerId: string, bookingId: string, booking: any): void {
  after(async () => {
    try {
      await connectToDatabase()
      const mapping: any = await WhatsAppBuyer.findOne({ customerId }).lean()
      if (!mapping?.waId) return

      const waId = String(mapping.waId)
      const ref = shortRef(bookingId)
      const amount = Number(booking?.finalPrice || 0)
      const serviceTitle = booking?.serviceTitle || 'Service'
      const freeTextBody = [
        `Provider countered! Ref ${ref}`,
        `${serviceTitle} — new price ${formatNaira(amount)}`,
        '',
        `Reply "accept ${ref}" to pay, "counter ${ref} <amount>" to counter back, or "decline ${ref}" to close it.`,
      ].join('\n')

      try {
        await sendTemplateMessage(waId, 'buyer_booking_counter_received', [ref, serviceTitle, formatNaira(amount)])
      } catch (templateError) {
        console.log(`[whatsapp-service-quote] buyer_booking_counter_received template send failed, falling back to free text — booking ${bookingId}:`, templateError)
        await trySendText(waId, freeTextBody)
      }
    } catch (error) {
      console.error(`[whatsapp-service-quote] notifyWaBuyerCounterReceived failed for booking ${bookingId}:`, error)
    }
  })
}

// ---------------------------------------------------------------------------
// Phase S4 Part A — provider-side counter/accept/decline, dispatched from
// lib/whatsapp/commands.ts right after tryHandleProviderQuoteCommand (the INITIAL quote —
// this handles every round after that). Same identity model as tryHandleProviderQuoteCommand:
// vendorId is resolved upstream via resolveLinkedVendor and is the only source of provider
// identity trusted here.
// ---------------------------------------------------------------------------

export async function tryHandleProviderNegotiationCommand(waId: string, vendorId: string, text: string): Promise<boolean> {
  const trimmed = String(text || '').trim()

  const counterMatch = trimmed.match(QUOTE_COUNTER_PATTERN)
  if (counterMatch) {
    return handleProviderCounter(waId, vendorId, counterMatch[1].toLowerCase(), counterMatch[2])
  }

  const decisionMatch = trimmed.match(QUOTE_DECISION_PATTERN)
  if (decisionMatch) {
    return handleProviderDecision(waId, vendorId, decisionMatch[1].toLowerCase() as 'accept' | 'decline', decisionMatch[2].toLowerCase())
  }

  return false
}

async function handleProviderCounter(waId: string, vendorId: string, ref: string, rawAmount: string): Promise<boolean> {
  await connectToDatabase()
  const candidates: any[] = await Booking.find({ providerId: vendorId, requiresQuote: true, pricingStatus: 'quoted' })
    .select('_id quoteLastOfferBy quoteNegotiationRound serviceId serviceTitle customerId')
    .lean()
  const match_ = candidates.find((b) => String(b._id).slice(0, 8).toLowerCase() === ref)
  if (!match_) return false

  const amount = Number(rawAmount.replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) {
    await trySendText(waId, `That amount doesn't look right. Reply like: counter ${ref.toUpperCase()} 15000`)
    return true
  }

  if (match_.quoteLastOfferBy !== 'buyer') {
    await trySendText(waId, `You're waiting on the buyer's response for ${ref.toUpperCase()} — nothing to counter yet.`)
    return true
  }

  const round = Number(match_.quoteNegotiationRound) || 0
  if (round >= MAX_QUOTE_NEGOTIATION_ROUNDS) {
    await trySendText(waId, `You've reached the limit of ${MAX_QUOTE_NEGOTIATION_ROUNDS} counters for ${ref.toUpperCase()}. Reply "accept ${ref.toUpperCase()}" or "decline ${ref.toUpperCase()}" to close it out.`)
    return true
  }

  const bookingId = String(match_._id)
  const service = await getServiceById(String(match_.serviceId || ''))
  const quoteSlaHours = Number((service as any)?.quoteSlaHours) > 0 ? Number((service as any)?.quoteSlaHours) : 24

  const updatedBooking: any = await Booking.findOneAndUpdate(
    { _id: bookingId, providerId: vendorId, pricingStatus: 'quoted', quoteLastOfferBy: 'buyer' },
    {
      $set: {
        finalPrice: amount,
        totalPrice: amount,
        quoteLastOfferBy: 'provider',
        quoteExpiresAt: new Date(Date.now() + quoteSlaHours * 60 * 60 * 1000),
      },
      $inc: { quoteNegotiationRound: 1 },
      $push: { quoteNegotiationHistory: { by: 'provider', amount, at: new Date() } },
    },
    { new: true }
  ).lean()

  if (!updatedBooking) {
    await trySendText(waId, `Couldn't send that counter — the status just changed. Check the latest update and try again.`)
    return true
  }

  await trySendText(waId, `Counter sent — ${ref.toUpperCase()} at ${formatNaira(amount)}. The buyer will be notified.`)
  notifyWaBuyerCounterReceived(String(updatedBooking.customerId || ''), bookingId, updatedBooking)
  return true
}

async function handleProviderDecision(waId: string, vendorId: string, action: 'accept' | 'decline', ref: string): Promise<boolean> {
  await connectToDatabase()
  const candidates: any[] = await Booking.find({ providerId: vendorId, requiresQuote: true, pricingStatus: 'quoted' })
    .select('_id quoteLastOfferBy serviceTitle customerId finalPrice')
    .lean()
  const match_ = candidates.find((b) => String(b._id).slice(0, 8).toLowerCase() === ref)
  if (!match_) return false

  if (match_.quoteLastOfferBy !== 'buyer') {
    await trySendText(waId, `There's no buyer counter waiting on ${ref.toUpperCase()} right now.`)
    return true
  }

  const bookingId = String(match_._id)

  if (action === 'decline') {
    await Booking.updateOne(
      { _id: bookingId, pricingStatus: 'quoted' },
      { $set: { status: 'cancelled', cancelledAt: new Date(), cancellationReason: 'Provider declined the counter-offer' } }
    )
    await trySendText(waId, `Ref ${ref.toUpperCase()} closed — the buyer's counter was declined.`)
    notifyWaBuyerQuoteClosed(String(match_.customerId || ''), bookingId, match_)
    return true
  }

  // Provider accepting the buyer's counter: flip the offer back to 'provider' and re-send
  // the same quote-received notice the buyer already knows how to act on — reuses the
  // existing accept-and-pay path (tryHandleQuoteDecision above) with zero new payment logic.
  const updated: any = await Booking.findOneAndUpdate(
    { _id: bookingId, providerId: vendorId, pricingStatus: 'quoted', quoteLastOfferBy: 'buyer' },
    { $set: { quoteLastOfferBy: 'provider' } },
    { new: true }
  ).lean()

  if (!updated) {
    await trySendText(waId, `Couldn't accept that counter — the status just changed. Check the latest update and try again.`)
    return true
  }

  await trySendText(waId, `Counter accepted — ${ref.toUpperCase()} at ${formatNaira(Number(match_.finalPrice || 0))}. We've asked the buyer to confirm and pay.`)
  notifyWaBuyerQuoteReceived(String(updated.customerId || ''), bookingId, updated)
  return true
}

// ---------------------------------------------------------------------------
// Phase S3, Part B — a provider quoting from their OWN WhatsApp: "quote <ref> <amount>".
// Dispatched from lib/whatsapp/commands.ts's vendor-command branch, which has already
// resolved `vendorId` via resolveLinkedVendor before calling this — that resolved value
// is the ONLY source of provider identity used below (SECURITY: the ref alone is never
// trusted to authorize anything; every query here filters by providerId first, exactly
// mirroring tryHandleQuoteDecision's customerId-first filtering above, so a provider can
// never even discover another provider's booking, let alone quote it).
//
// Sets the exact same pricingStatus/finalPrice/totalPrice/quoteSentAt/quoteExpiresAt
// fields app/api/database/bookings/[id]/route.ts's PATCH sets for a dashboard quote, via
// an atomic guarded update (guard: pricingStatus still 'estimated') so a double-send race
// can't quote the same request twice. notifyWaBuyerQuoteReceived fires the same way
// either path sets those fields — no new delivery code needed.
// ---------------------------------------------------------------------------

const PROVIDER_QUOTE_PATTERN = /^quote\s+([a-f0-9]{6,})\s+([\d,]+(?:\.\d+)?)$/i

export async function tryHandleProviderQuoteCommand(waId: string, vendorId: string, text: string): Promise<boolean> {
  const match = String(text || '').trim().match(PROVIDER_QUOTE_PATTERN)
  if (!match) return false

  const ref = match[1].toLowerCase()
  const amount = Number(match[2].replace(/,/g, ''))

  if (!Number.isFinite(amount) || amount <= 0) {
    await trySendText(waId, `That amount doesn't look right. Reply like: quote ${ref.toUpperCase()} 20000`)
    return true
  }

  await connectToDatabase()
  // Filtered by providerId FIRST — a ref matching some other provider's booking simply
  // never appears in `candidates`, so it can't be distinguished from a ref that doesn't
  // exist at all (same non-leaking shape as tryHandleQuoteDecision above).
  const candidates: any[] = await Booking.find({ providerId: vendorId, requiresQuote: true })
    .select('_id status pricingStatus serviceId')
    .lean()
  const match_ = candidates.find((b) => String(b._id).slice(0, 8).toLowerCase() === ref)

  if (!match_) {
    await trySendText(waId, `Couldn't find a quote request with reference ${ref.toUpperCase()} for your account.`)
    return true
  }

  if (match_.status === 'cancelled') {
    await trySendText(waId, `Request ${ref.toUpperCase()} was cancelled — nothing to quote.`)
    return true
  }

  if (match_.pricingStatus !== 'estimated') {
    await trySendText(waId, `Request ${ref.toUpperCase()} already has a quote (status: ${match_.pricingStatus}).`)
    return true
  }

  const bookingId = String(match_._id)
  const service = await getServiceById(String(match_.serviceId || ''))
  const quoteSlaHours = Number((service as any)?.quoteSlaHours) > 0 ? Number((service as any)?.quoteSlaHours) : 24

  // Atomic guard on pricingStatus: 'estimated' — if two "quote" messages for the same
  // ref land close together (retry, double-tap), only the first actually applies.
  const updatedBooking: any = await Booking.findOneAndUpdate(
    { _id: bookingId, providerId: vendorId, pricingStatus: 'estimated' },
    {
      $set: {
        pricingStatus: 'quoted',
        finalPrice: amount,
        totalPrice: amount,
        quoteSentAt: new Date(),
        quoteExpiresAt: new Date(Date.now() + quoteSlaHours * 60 * 60 * 1000),
        quoteLastOfferBy: 'provider',
        quoteNegotiationRound: 0,
      },
      $push: { quoteNegotiationHistory: { by: 'provider', amount, at: new Date() } },
    },
    { new: true }
  ).lean()

  if (!updatedBooking) {
    await trySendText(waId, `Request ${ref.toUpperCase()} was already quoted just now.`)
    return true
  }

  notifyWaBuyerQuoteReceived(String(updatedBooking.customerId || ''), bookingId, updatedBooking)
  await trySendText(waId, `Quote sent — ${ref.toUpperCase()} for ${formatNaira(amount)}. The buyer will be notified.`)
  return true
}
