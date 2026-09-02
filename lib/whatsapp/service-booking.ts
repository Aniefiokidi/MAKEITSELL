// WhatsApp services booking conversation (Phase S2) — fixed-price (requiresQuote: false)
// services only. requiresQuote: true is explicitly out of scope here (S3's territory);
// see handleServiceReply below for where that's turned away.
//
// Services aren't monetized on the platform: nothing here is ever charged. The price shown
// to the buyer while picking a package/add-ons is just the package/add-on price arithmetic
// itself (which package + which add-ons costs how much), the same "package price + add-on
// amounts" formula components/services/BookingModal.tsx uses for its own live total — it's
// the full amount the buyer settles directly with the provider, not a platform charge.
import { after } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { getServiceById } from '@/lib/mongodb-operations'
import { WhatsAppServiceMessageMap } from '@/lib/models/WhatsAppServiceMessageMap'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp/client'
import { findBookingSlotConflict } from '@/lib/booking-availability'
import { expireStalePendingBookings } from '@/lib/booking-expiry'
import { createBookingForWaBuyer } from '@/lib/whatsapp/buyer-bookings'
import { startQuoteRequest } from '@/lib/whatsapp/service-quote'

// Same set of stages as goods' BLOCKING_CHECKOUT_STAGES in lib/whatsapp/checkout.ts, kept
// as its own disjoint set (see lib/models/WhatsAppBrowseState.ts's stage enum comment) so
// neither file's dispatch needs to know about the other's stage names.
export const SERVICE_BOOKING_BLOCKING_STAGES = new Set([
  'choosing_service_package',
  'choosing_service_addons',
  'choosing_booking_slot',
  'confirming_booking',
  'awaiting_booking_payment',
])

async function trySendText(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-service-booking] Text send failed for ${waId}:`, error)
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

function addOnAmount(addOn: any, basePackagePrice: number): number {
  if (addOn?.pricingType === 'percentage') {
    return Math.round((basePackagePrice * Number(addOn?.amount || 0)) / 100)
  }
  return Number(addOn?.amount || 0)
}

// ---------------------------------------------------------------------------
// Entry point: buyer replies to a service-result message (lib/whatsapp/service-results.ts)
// ---------------------------------------------------------------------------

export async function handleServiceReply(waId: string, contextMessageId: string, text: string): Promise<boolean> {
  await connectToDatabase()
  const mapping: any = await WhatsAppServiceMessageMap.findOne({ messageId: contextMessageId }).lean()
  if (!mapping?.serviceId) return false

  const service: any = await getServiceById(mapping.serviceId)
  if (!service || service.status !== 'active') {
    await trySendText(waId, "Sorry, that service isn't available anymore. Search again to see what's on offer.")
    return true
  }

  if (service.requiresQuote) {
    // Phase S3, Part A — lib/whatsapp/service-quote.ts.
    await startQuoteRequest(waId, service)
    return true
  }

  await beginPackageSelection(waId, service, { serviceId: String(service.id || mapping.serviceId) })
  return true
}

// Package/add-on-prompt entry, shared by handleServiceReply above (plain booking) and
// startBookingWithOverride below (Phase S4 Part B — booking from an agreed pre-booking
// negotiation). `extra` seeds the draft before the package/slot arithmetic runs; the only
// fields startBookingWithOverride adds are negotiationId/negotiatedTotalPrice, which
// handleSlotSelection and handleBookingConfirmation below both know to look for.
async function beginPackageSelection(waId: string, service: any, extra: Record<string, any> = {}): Promise<void> {
  // normalizeServicePricing() (lib/mongodb-operations.ts) guarantees packageOptions is
  // never empty — at minimum a single fallback package synthesized from the flat price.
  const packages = (Array.isArray(service.packageOptions) ? service.packageOptions : []).filter((p: any) => p?.active !== false)
  const addOns = (Array.isArray(service.addOnOptions) ? service.addOnOptions : []).filter((a: any) => a?.active !== false)

  const draft: Record<string, any> = {
    serviceId: String(service.id || service._id),
    providerId: service.providerId,
    providerName: service.providerName,
    serviceTitle: service.title,
    locationType: service.locationType,
    location: service.location,
    // Snapshotted so a vendor editing prices mid-conversation can't shift the total out
    // from under a buyer already partway through selecting.
    packageOptions: packages,
    addOnOptions: addOns,
    ...extra,
  }

  if (packages.length > 1) {
    await saveState(waId, { stage: 'choosing_service_package', bookingDraft: draft })
    await sendPackagePrompt(waId, packages)
    return
  }

  // Only one package (the common case — most services in this catalog have no explicit
  // packageOptions, just the synthesized fallback) — nothing to choose, skip straight past it.
  const onlyPackage = packages[0]
  draft.selectedPackageId = onlyPackage.id
  draft.selectedPackageName = onlyPackage.name
  draft.selectedPackagePrice = Number(onlyPackage.price || 0)
  draft.selectedPackageDuration = Number(onlyPackage.duration) || 60

  if (addOns.length > 0) {
    await saveState(waId, { stage: 'choosing_service_addons', bookingDraft: draft })
    await sendAddOnPrompt(waId, addOns, draft.selectedPackagePrice)
    return
  }

  await saveState(waId, { stage: 'choosing_booking_slot', bookingDraft: { ...draft, selectedAddOns: [] } })
  await sendSlotPrompt(waId, draft.serviceTitle)
}

// Phase S4 Part B — entry from lib/whatsapp/service-negotiation.ts's "book <ref>" once a
// pre-booking negotiation is agreed. Package/add-on selection still runs (a negotiation
// agrees a TOTAL price, not which package/add-ons make it up — same as
// components/services/BookingModal.tsx's overridePrice on web, which still shows the
// picker), but the total charged is the negotiated one, not the package+add-on arithmetic
// — see handleSlotSelection's negotiatedTotalPrice branch below.
export async function startBookingWithOverride(waId: string, service: any, negotiationId: string, negotiatedTotalPrice: number): Promise<void> {
  await beginPackageSelection(waId, service, { negotiationId, negotiatedTotalPrice })
}

// ---------------------------------------------------------------------------
// Package selection
// ---------------------------------------------------------------------------

async function sendPackagePrompt(waId: string, packages: any[]): Promise<void> {
  const lines = packages.map((p, i) => `${i + 1}. ${p.name} — ${formatNaira(p.price)}`)
  await trySendText(waId, `Which package?\n\n${lines.join('\n')}\n\nReply with the number.`)
}

async function handlePackageSelection(waId: string, text: string, draft: Record<string, any>): Promise<void> {
  const packages = Array.isArray(draft.packageOptions) ? draft.packageOptions : []
  const index = Number(String(text || '').trim())

  if (!Number.isInteger(index) || index < 1 || index > packages.length) {
    await trySendText(waId, `Please reply with a number from 1 to ${packages.length}.`)
    return
  }

  const selected = packages[index - 1]
  const nextDraft: Record<string, any> = {
    ...draft,
    selectedPackageId: selected.id,
    selectedPackageName: selected.name,
    selectedPackagePrice: Number(selected.price || 0),
    selectedPackageDuration: Number(selected.duration) || 60,
  }

  const addOns = Array.isArray(draft.addOnOptions) ? draft.addOnOptions : []
  if (addOns.length > 0) {
    await saveState(waId, { stage: 'choosing_service_addons', bookingDraft: nextDraft })
    await sendAddOnPrompt(waId, addOns, nextDraft.selectedPackagePrice)
    return
  }

  await saveState(waId, { stage: 'choosing_booking_slot', bookingDraft: { ...nextDraft, selectedAddOns: [] } })
  await sendSlotPrompt(waId, nextDraft.serviceTitle)
}

// ---------------------------------------------------------------------------
// Add-on selection
// ---------------------------------------------------------------------------

async function sendAddOnPrompt(waId: string, addOns: any[], basePackagePrice: number): Promise<void> {
  const lines = addOns.map((a, i) => `${i + 1}. ${a.name} — +${formatNaira(addOnAmount(a, basePackagePrice))}`)
  await trySendText(waId, `Any add-ons? (optional)\n\n${lines.join('\n')}\n\nReply with numbers separated by commas (e.g. "1,3"), or "none" to skip.`)
}

async function handleAddOnSelection(waId: string, text: string, draft: Record<string, any>): Promise<void> {
  const addOns = Array.isArray(draft.addOnOptions) ? draft.addOnOptions : []
  const trimmed = String(text || '').trim().toLowerCase()

  let selectedAddOns: any[] = []
  if (trimmed !== 'none' && trimmed !== 'skip' && trimmed !== '') {
    const indices = Array.from(new Set(trimmed.split(',').map((s) => Number(s.trim()))))
    const invalid = indices.some((i) => !Number.isInteger(i) || i < 1 || i > addOns.length)
    if (invalid) {
      await trySendText(waId, `Please reply with numbers from 1 to ${addOns.length}, separated by commas, or "none".`)
      return
    }
    selectedAddOns = indices.map((i) => {
      const addOn = addOns[i - 1]
      return {
        id: addOn.id,
        name: addOn.name,
        pricingType: addOn.pricingType || 'fixed',
        amount: Number(addOn.amount || 0),
      }
    })
  }

  const nextDraft: Record<string, any> = { ...draft, selectedAddOns }
  await saveState(waId, { stage: 'choosing_booking_slot', bookingDraft: nextDraft })
  await sendSlotPrompt(waId, draft.serviceTitle)
}

// ---------------------------------------------------------------------------
// Slot selection
// ---------------------------------------------------------------------------

const SLOT_PATTERN = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})$/

async function sendSlotPrompt(waId: string, serviceTitle: string): Promise<void> {
  await trySendText(waId, `What date and time would you like for ${serviceTitle}?\n\nReply like: 2026-08-20 14:00`)
}

function computeEndTime(startTime: string, durationMinutes: number): string {
  const [hour, minute] = startTime.split(':').map(Number)
  const endTotal = hour * 60 + minute + Math.max(1, durationMinutes)
  const endHour = Math.floor(endTotal / 60) % 24
  const endMinute = endTotal % 60
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
}

async function handleSlotSelection(waId: string, text: string, draft: Record<string, any>): Promise<void> {
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

  const duration = Number(draft.selectedPackageDuration) || 60
  const endTime = computeEndTime(startTime, duration)

  // On-demand cleanup (lib/booking-expiry.ts) — frees any of this provider's abandoned
  // pending-payment holds before checking, same call the web availability route makes,
  // so a slot someone abandoned mid-Paystack shows as free here too, not just on the web.
  await expireStalePendingBookings({ providerId: draft.providerId })

  const conflict = await findBookingSlotConflict({
    providerId: draft.providerId,
    bookingDate,
    startTime,
    endTime,
  })

  if (conflict) {
    await trySendText(
      waId,
      `That slot's taken (${conflict.startTime}–${conflict.endTime} is already booked). Please try a different time.`
    )
    return
  }

  // Phase S4 Part B: a booking started from an agreed pre-booking negotiation
  // (startBookingWithOverride) charges the negotiated total verbatim, not the
  // package+add-on arithmetic — package/add-ons are still picked for scheduling purposes,
  // but the price was already agreed. lib/booking-payment.ts's initiateBookingPayment
  // re-validates this against the negotiation server-side; nothing here is trusted blindly.
  const basePrice = Number(draft.selectedPackagePrice || 0)
  const addOnTotal = (Array.isArray(draft.selectedAddOns) ? draft.selectedAddOns : [])
    .reduce((sum: number, a: any) => sum + addOnAmount(a, basePrice), 0)
  const totalPrice = draft.negotiatedTotalPrice != null
    ? Math.max(0, Math.round(Number(draft.negotiatedTotalPrice)))
    : Math.max(0, Math.round(basePrice + addOnTotal))

  const nextDraft: Record<string, any> = { ...draft, bookingDate: bookingDate.toISOString(), startTime, endTime, duration, totalPrice }
  await saveState(waId, { stage: 'confirming_booking', bookingDraft: nextDraft })
  await sendConfirmationPrompt(waId, nextDraft)
}

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

async function sendConfirmationPrompt(waId: string, draft: Record<string, any>): Promise<void> {
  const addOnNames = (Array.isArray(draft.selectedAddOns) ? draft.selectedAddOns : []).map((a: any) => a.name)
  const dateLabel = new Date(draft.bookingDate).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })

  await trySendText(
    waId,
    [
      `${draft.serviceTitle}`,
      `${draft.selectedPackageName} — ${dateLabel}, ${draft.startTime}`,
      addOnNames.length > 0 ? `Add-ons: ${addOnNames.join(', ')}` : null,
      `${draft.negotiationId ? 'Negotiated total' : 'Total'}: ${formatNaira(draft.totalPrice)}`,
      '',
      'This is paid directly to the provider — nothing is charged through Make It Sell.',
      '',
      'Reply "confirm" to book this slot, or "cancel" to stop.',
    ].filter(Boolean).join('\n')
  )
}

async function handleBookingConfirmation(waId: string, text: string, draft: Record<string, any>): Promise<void> {
  const trimmed = String(text || '').trim().toLowerCase()

  if (trimmed === 'cancel') {
    await resetBookingState(waId)
    await trySendText(waId, 'Booking cancelled. Reply "categories" to keep browsing services.')
    return
  }

  if (trimmed !== 'confirm' && trimmed !== 'yes') {
    await sendConfirmationPrompt(waId, draft)
    return
  }

  const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()

  const result = await createBookingForWaBuyer({
    waId,
    name: mapping?.customerName,
    bookingData: {
      serviceId: draft.serviceId,
      providerId: draft.providerId,
      providerName: draft.providerName,
      serviceTitle: draft.serviceTitle,
      selectedPackageId: draft.selectedPackageId,
      selectedPackageName: draft.selectedPackageName,
      selectedAddOns: draft.selectedAddOns || [],
      bookingDate: draft.bookingDate,
      startTime: draft.startTime,
      endTime: draft.endTime,
      duration: draft.duration,
      totalPrice: draft.totalPrice,
      estimatedPrice: draft.totalPrice,
      finalPrice: draft.totalPrice,
      pricingStatus: 'accepted',
      requiresQuote: false,
      locationType: draft.locationType,
      location: draft.location,
      // Phase S4 Part B: when present, lib/booking-payment.ts's initiateBookingPayment
      // claims and validates this negotiation server-side and overwrites totalPrice/
      // finalPrice from its agreedPrice — the draft.totalPrice above is a preview only.
      negotiationId: draft.negotiationId,
    },
  })

  if (!result.success) {
    await trySendText(waId, `Couldn't complete that booking: ${result.error}. Please pick a different time.`)
    await saveState(waId, { stage: 'choosing_booking_slot' })
    await sendSlotPrompt(waId, draft.serviceTitle)
    return
  }

  // Services aren't monetized, so requiresPayment is always false here — the booking is
  // already confirmed at this point (initiateBookingPayment claims it as paid internally
  // via handleBookingPaid). That same claim fires notifyWaBuyerBookingPaid, which sends
  // the actual "Booking confirmed!" message a moment later — nothing further to send here,
  // just clear the conversation state synchronously too, in case that async notify lags.
  await resetBookingState(waId)
}

// ---------------------------------------------------------------------------
// Dispatcher + cancel — mirrors lib/whatsapp/checkout.ts's handleCheckoutStageMessage /
// handleCancelCommand shape exactly, for the disjoint SERVICE_BOOKING_BLOCKING_STAGES set.
// ---------------------------------------------------------------------------

async function resetBookingState(waId: string): Promise<void> {
  await saveState(waId, {
    stage: 'browsing',
    bookingDraft: {},
    pendingBookingId: null,
  })
}

export async function handleServiceBookingCancelCommand(waId: string, stage: string): Promise<boolean> {
  if (!SERVICE_BOOKING_BLOCKING_STAGES.has(stage)) return false
  await resetBookingState(waId)
  await trySendText(waId, 'Booking cancelled. Reply "categories" to keep browsing services.')
  return true
}

export async function handleServiceBookingStageMessage(waId: string, text: string, stage: string): Promise<void> {
  const state = await loadState(waId)
  const draft = state?.bookingDraft || {}

  switch (stage) {
    case 'choosing_service_package':
      await handlePackageSelection(waId, text, draft)
      return
    case 'choosing_service_addons':
      await handleAddOnSelection(waId, text, draft)
      return
    case 'choosing_booking_slot':
      await handleSlotSelection(waId, text, draft)
      return
    case 'confirming_booking':
      await handleBookingConfirmation(waId, text, draft)
      return
    case 'awaiting_booking_payment':
      await trySendText(waId, 'Your booking is awaiting payment — tap the link sent earlier. If you\'d like to start over, reply "cancel" first.')
      return
    default:
      return
  }
}

// ---------------------------------------------------------------------------
// Payment confirmation hook — called from lib/booking-payment-confirmation.ts's
// handleBookingPaid, once a booking is claimed as paid (mirrors
// lib/whatsapp/checkout.ts's notifyWaBuyerOrderPaid exactly, including the "not a
// WhatsApp buyer — nothing to do" no-op, so it's always safe to call unconditionally from
// handleBookingPaid regardless of whether the booking came from web or the bot).
// ---------------------------------------------------------------------------

export function notifyWaBuyerBookingPaid(customerId: string, bookingId: string, booking: any): void {
  after(async () => {
    try {
      await connectToDatabase()
      const mapping: any = await WhatsAppBuyer.findOne({ customerId }).lean()
      if (!mapping?.waId) return // not a WhatsApp buyer — nothing to do

      const waId = String(mapping.waId)

      // Clear booking conversation state regardless of send outcome below — the booking
      // is paid either way, and a buyer left stuck in 'awaiting_booking_payment' after
      // already paying would otherwise be unable to start browsing again cleanly.
      await resetBookingState(waId)

      const ref = String(bookingId || '').slice(0, 8).toUpperCase()
      const dateLabel = booking?.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' }) : ''
      const dateTimeLabel = `${dateLabel}${booking?.startTime ? `, ${booking.startTime}` : ''}`
      const balance = Number(booking?.balanceOwed || 0)
      const serviceTitle = booking?.serviceTitle || 'Service'

      // Prefers the buyer_booking_paid_confirmation template (delivers regardless of
      // Meta's 24h customer-service window) — a web-originated booking by a linked buyer
      // who hasn't messaged recently can easily land outside it. Falls back to free text
      // if the send fails for any reason (not yet approved, since rejected/renamed,
      // etc.), same pattern as lib/whatsapp/checkout.ts's notifyWaBuyerOrderPaid.
      try {
        await sendTemplateMessage(waId, 'buyer_booking_paid_confirmation', [ref, serviceTitle, dateTimeLabel, formatNaira(balance)])
      } catch (templateError) {
        console.log(`[whatsapp-service-booking] buyer_booking_paid_confirmation template send failed, falling back to free text — booking ${bookingId}:`, templateError)
        await trySendText(
          waId,
          `Booking confirmed! Ref ${ref}\n${serviceTitle} — ${dateTimeLabel}\n\nBalance of ${formatNaira(balance)} is paid directly to the provider at the appointment.`
        )
      }
    } catch (error) {
      console.error(`[whatsapp-service-booking] notifyWaBuyerBookingPaid failed for booking ${bookingId}:`, error)
    }
  })
}
