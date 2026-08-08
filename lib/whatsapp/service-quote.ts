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
        `Reply "accept ${ref}" to pay, or "decline ${ref}" to close this request.`,
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
// Quote accept/decline — deliberately keyword-based ("accept REF"/"decline REF"), not a
// blocking stage. A quote can arrive hours or days after the request, by which point the
// buyer's current stage/mode could be anything (mid-goods-checkout, browsing something
// else entirely) — forcing a stage change on notification would hijack whatever they were
// doing. This works from any state instead, checked in lib/whatsapp/buyer.ts's main
// dispatch alongside the other mode-agnostic patterns (ORDER_STATUS_PATTERN etc).
// ---------------------------------------------------------------------------

const QUOTE_DECISION_PATTERN = /^(accept|decline)\s+([a-f0-9]{6,})$/i

export async function tryHandleQuoteDecision(waId: string, text: string): Promise<boolean> {
  const match = String(text || '').trim().match(QUOTE_DECISION_PATTERN)
  if (!match) return false

  const action = match[1].toLowerCase()
  const ref = match[2].toLowerCase()

  const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()
  if (!mapping?.customerId) {
    await trySendText(waId, "I can't find any requests for this number.")
    return true
  }

  await connectToDatabase()
  const candidates: any[] = await Booking.find({ customerId: mapping.customerId, pricingStatus: 'quoted' })
    .select('_id')
    .lean()
  const match_ = candidates.find((b) => String(b._id).slice(0, 8).toLowerCase() === ref)

  if (!match_) {
    await trySendText(waId, `Couldn't find an active quote with reference ${ref.toUpperCase()} — it may have already been handled or expired.`)
    return true
  }

  const bookingId = String(match_._id)

  if (action === 'decline') {
    await Booking.updateOne(
      { _id: bookingId, pricingStatus: 'quoted' },
      { $set: { status: 'cancelled', cancelledAt: new Date(), cancellationReason: 'Buyer declined the quote' } }
    )
    await trySendText(waId, 'Quote declined — that request is now closed.')
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
      },
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
