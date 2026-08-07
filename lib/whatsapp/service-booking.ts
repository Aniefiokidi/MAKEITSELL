// WhatsApp services booking conversation (Phase S2) — fixed-price (requiresQuote: false)
// services only. requiresQuote: true is explicitly out of scope here (S3's territory);
// see handleServiceReply below for where that's turned away.
//
// Money-path discipline, same rule lib/whatsapp/checkout.ts states for goods: this file
// NEVER computes what actually gets CHARGED — lib/booking-payment.ts's
// initiateBookingPayment (via lib/whatsapp/buyer-bookings.ts) owns the deposit/fee math
// and is the only path to an actual Paystack link. The price shown to the buyer while
// picking a package/add-ons here is the package/add-on price arithmetic itself (which
// package + which add-ons costs how much), the same "package price + add-on amounts"
// formula components/services/BookingModal.tsx uses for its own live total — not a
// competing computation of the deposit/fee split.
import { after } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { getServiceById } from '@/lib/mongodb-operations'
import { WhatsAppServiceMessageMap } from '@/lib/models/WhatsAppServiceMessageMap'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import { sendTextMessage } from '@/lib/whatsapp/client'
import { findBookingSlotConflict } from '@/lib/booking-availability'
import { expireStalePendingBookings } from '@/lib/booking-expiry'
import { createBookingForWaBuyer } from '@/lib/whatsapp/buyer-bookings'

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
    await trySendText(
      waId,
      `${service.title} needs a custom quote from the provider before it can be booked — that flow isn't available here yet. Reply "categories" to keep browsing other services in the meantime.`
    )
    return true
  }

  // normalizeServicePricing() (lib/mongodb-operations.ts) guarantees packageOptions is
  // never empty — at minimum a single fallback package synthesized from the flat price.
  const packages = (Array.isArray(service.packageOptions) ? service.packageOptions : []).filter((p: any) => p?.active !== false)
  const addOns = (Array.isArray(service.addOnOptions) ? service.addOnOptions : []).filter((a: any) => a?.active !== false)

  const draft: Record<string, any> = {
    serviceId: String(service.id || mapping.serviceId),
    providerId: service.providerId,
    providerName: service.providerName,
    serviceTitle: service.title,
    locationType: service.locationType,
    location: service.location,
    // Snapshotted so a vendor editing prices mid-conversation can't shift the total out
    // from under a buyer already partway through selecting.
    packageOptions: packages,
    addOnOptions: addOns,
  }

  if (packages.length > 1) {
    await saveState(waId, { stage: 'choosing_service_package', bookingDraft: draft })
    await sendPackagePrompt(waId, packages)
    return true
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
    return true
  }

  await saveState(waId, { stage: 'choosing_booking_slot', bookingDraft: { ...draft, selectedAddOns: [] } })
  await sendSlotPrompt(waId, draft.serviceTitle)
  return true
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

  const basePrice = Number(draft.selectedPackagePrice || 0)
  const addOnTotal = (Array.isArray(draft.selectedAddOns) ? draft.selectedAddOns : [])
    .reduce((sum: number, a: any) => sum + addOnAmount(a, basePrice), 0)
  const totalPrice = Math.max(0, Math.round(basePrice + addOnTotal))

  const nextDraft: Record<string, any> = { ...draft, bookingDate: bookingDate.toISOString(), startTime, endTime, duration, totalPrice }
  await saveState(waId, { stage: 'confirming_booking', bookingDraft: nextDraft })
  await sendConfirmationPrompt(waId, nextDraft)
}

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

async function sendConfirmationPrompt(waId: string, draft: Record<string, any>): Promise<void> {
  // Deposit/fee split itself is NOT computed here — this is just the total the booking
  // will be created with; lib/booking-payment.ts's initiateBookingPayment (via
  // createBookingForWaBuyer) is what actually runs computeBookingDeposit and is the
  // authoritative source of what gets charged. Importing the same pure helper here (it
  // has zero server-only deps, same reason components/services/BookingModal.tsx can) so
  // this preview can never drift from what's actually charged a moment later.
  const { computeBookingDeposit } = await import('@/lib/booking-pricing')
  const { depositAmount, bookingFeeAmount, balanceOwed, amountDueNow } = computeBookingDeposit(draft.totalPrice)

  const addOnNames = (Array.isArray(draft.selectedAddOns) ? draft.selectedAddOns : []).map((a: any) => a.name)
  const dateLabel = new Date(draft.bookingDate).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })

  await trySendText(
    waId,
    [
      `${draft.serviceTitle}`,
      `${draft.selectedPackageName} — ${dateLabel}, ${draft.startTime}`,
      addOnNames.length > 0 ? `Add-ons: ${addOnNames.join(', ')}` : null,
      `Total: ${formatNaira(draft.totalPrice)}`,
      '',
      `Pay now: ${formatNaira(amountDueNow)} (${formatNaira(depositAmount)} deposit + ${formatNaira(bookingFeeAmount)} booking fee)`,
      `Balance of ${formatNaira(balanceOwed)} is paid directly to the provider at the appointment.`,
      '',
      'Reply "confirm" to get your payment link, or "cancel" to stop.',
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
    },
  })

  if (!result.success) {
    await trySendText(waId, `Couldn't complete that booking: ${result.error}. Please pick a different time.`)
    await saveState(waId, { stage: 'choosing_booking_slot' })
    await sendSlotPrompt(waId, draft.serviceTitle)
    return
  }

  if (!result.requiresPayment) {
    // Shouldn't happen for requiresQuote: false, but handled rather than left dangling.
    await resetBookingState(waId)
    await trySendText(waId, 'Your booking request was submitted.')
    return
  }

  await saveState(waId, { stage: 'awaiting_booking_payment', pendingBookingId: result.bookingId })
  await trySendText(
    waId,
    `Tap the link below to pay ${formatNaira(result.payableAmount)} securely:\n\n${result.authorization_url}\n\nOnce payment is confirmed we'll message you here.`
  )
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
      const balance = Number(booking?.balanceOwed || 0)

      await trySendText(
        waId,
        `Booking confirmed! Ref ${ref}\n${booking?.serviceTitle || 'Service'} — ${dateLabel}${booking?.startTime ? `, ${booking.startTime}` : ''}\n\nBalance of ${formatNaira(balance)} is paid directly to the provider at the appointment.`
      )
    } catch (error) {
      console.error(`[whatsapp-service-booking] notifyWaBuyerBookingPaid failed for booking ${bookingId}:`, error)
    }
  })
}
