// Shared booking-payment initiation — the booking equivalent of lib/order-creation.ts's
// buildOrder for goods. Takes booking data the caller has already priced (package/add-on
// total, location pricing, stay-details nights×rooms — whichever applies; see
// app/api/database/bookings/route.ts, which still owns all of that) and turns it into a
// confirmed booking. Meant to be called from both the web booking route and the WhatsApp
// booking flow, so neither re-derives this math or forgets the double-booking check.
//
// Services are not monetized on the platform: no deposit, no booking fee, no Paystack
// charge, for either a fixed-price booking or a requiresQuote:true one once its quote is
// accepted (see initiatePaymentForQuotedBooking below). The full price is owed directly
// to the provider and settled entirely off-platform. `computeBookingDeposit` and the
// deposit-charging machinery below are left in place, just unused from this path, in case
// monetization comes back later — see chargeBookingDeposit's own comment.
import connectToDatabase from '@/lib/mongodb'
import { Booking } from '@/lib/models/Booking'
import { PriceNegotiation } from '@/lib/models/PriceNegotiation'
import { createBooking } from '@/lib/mongodb-operations'
import { findBookingSlotConflict } from '@/lib/booking-availability'
import { paystackService } from '@/lib/payment'
import { calculatePaystackCheckoutAmounts } from '@/lib/paystack-charges'
import { computeBookingDeposit } from '@/lib/booking-pricing'
import { handleBookingPaid } from '@/lib/booking-payment-confirmation'

// Phase S4 trust-gap fix: an `agreed` PriceNegotiation (lib/models/PriceNegotiation.ts —
// pre-booking price haggling on a requiresQuote:false service) previously had no
// server-side link to the booking it was meant to back — a client could submit any
// totalPrice it wanted, and the same agreed negotiation could back more than one booking,
// since nothing ever marked it consumed. Claims it atomically before creating anything;
// callers that pass `negotiationId` get the price FROM the negotiation, never from their
// own submitted totalPrice/finalPrice.
async function claimNegotiation(
  negotiationId: string,
  serviceId: string,
  customerId: string
): Promise<{ success: true; agreedPrice: number } | { success: false; error: string }> {
  const claimed: any = await PriceNegotiation.findOneAndUpdate(
    { _id: negotiationId, status: 'agreed', consumedByBookingId: null, serviceId, customerId },
    { $set: { consumedByBookingId: 'pending' } },
    { new: true }
  ).lean()

  if (!claimed) {
    return { success: false, error: 'This negotiated price is no longer valid — it may already be used, expired, or was never agreed.' }
  }

  const agreedPrice = Number(claimed.agreedPrice)
  if (!Number.isFinite(agreedPrice) || agreedPrice <= 0) {
    await releaseNegotiationClaim(negotiationId)
    return { success: false, error: 'The negotiated price on that offer is invalid.' }
  }

  return { success: true, agreedPrice }
}

async function releaseNegotiationClaim(negotiationId: string): Promise<void> {
  await PriceNegotiation.updateOne({ _id: negotiationId, consumedByBookingId: 'pending' }, { $set: { consumedByBookingId: null } })
}

async function finalizeNegotiationClaim(negotiationId: string, bookingId: string): Promise<void> {
  await PriceNegotiation.updateOne({ _id: negotiationId, consumedByBookingId: 'pending' }, { $set: { consumedByBookingId: bookingId } })
}

export { computeBookingDeposit } from '@/lib/booking-pricing'

export type InitiateBookingPaymentResult =
  | {
      success: true
      requiresPayment: true
      bookingId: string
      authorization_url: string
      reference: string
      depositAmount: number
      bookingFeeAmount: number
      balanceOwed: number
      payableAmount: number
    }
  | { success: true; requiresPayment: false; bookingId: string }
  | { success: false; error: string; status: number }

// Paystack-init tail — no longer called from either initiateBookingPayment or
// initiatePaymentForQuotedBooking below (services aren't monetized), left intact
// alongside computeBookingDeposit rather than deleted, in case that changes later.
async function chargeBookingDeposit(params: {
  bookingId: string
  customerEmail: string
  customerId: string
  serviceTitle: string
  providerId: string
  providerName: string
  depositAmount: number
  bookingFeeAmount: number
  amountDueNow: number
  callbackUrl?: string
}): Promise<{ success: true; authorization_url: string; reference: string; payableAmount: number } | { success: false; error: string }> {
  // Same gross-up goods checkout applies (lib/paystack-charges.ts) so Paystack's own
  // processing cut doesn't come out of Make It Sell's ₦1,000 — the customer sees it as
  // its own line item, same as at goods checkout, not folded silently into the deposit.
  const paystackAmounts = calculatePaystackCheckoutAmounts(params.amountDueNow)
  if (paystackAmounts.payableAmount <= 0) {
    return { success: false, error: 'Invalid deposit amount for payment initialization' }
  }

  const paymentResult = await paystackService.initializePayment({
    email: params.customerEmail,
    amount: paystackAmounts.payableAmount,
    orderId: params.bookingId,
    customerId: params.customerId,
    paymentType: 'booking',
    callbackUrl: params.callbackUrl,
    items: [
      {
        productId: 'booking-deposit',
        title: `Deposit — ${params.serviceTitle || 'Service booking'}`,
        quantity: 1,
        price: params.depositAmount,
        vendorId: params.providerId,
        vendorName: params.providerName,
      },
      {
        productId: 'booking-fee',
        title: 'Make It Sell booking fee',
        quantity: 1,
        price: params.bookingFeeAmount,
        vendorId: 'system',
        vendorName: 'Make It Sell',
      },
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
    authorization_url: paymentResult.authUrl,
    reference: paymentResult.data?.reference,
    payableAmount: paystackAmounts.payableAmount,
  }
}

// `bookingData` is the already-priced, already-validated booking document the caller is
// about to persist — same shape app/api/database/bookings/route.ts has always built,
// including `totalPrice`. `callbackUrl` lets callers (web vs bot) send Paystack's redirect
// to different places; web wiring passes /api/payments/booking-verify.
export async function initiateBookingPayment(
  bookingData: Record<string, any>,
  options: { callbackUrl?: string } = {}
): Promise<InitiateBookingPaymentResult> {
  await connectToDatabase()

  const { providerId, bookingDate, startTime, endTime } = bookingData
  if (!providerId || !bookingDate || !startTime || !endTime) {
    return { success: false, error: 'Missing required fields for booking validation', status: 400 }
  }

  const hasStayBooking = Boolean(bookingData?.stayDetails?.checkInDate)
  if (!hasStayBooking) {
    // Re-checked here (the caller already checked once) so no path into this shared
    // function — including a future bot caller — can skip it. See
    // lib/booking-availability.ts for why this narrows, but doesn't close, the
    // check-then-write race between the two checks.
    const conflict = await findBookingSlotConflict({ providerId, bookingDate, startTime, endTime })
    if (conflict) {
      return {
        success: false,
        error: 'This time slot is already booked. Please choose a different time.',
        status: 409,
      }
    }
  }

  const requiresQuote = Boolean(bookingData?.requiresQuote)

  if (requiresQuote) {
    // No total to deposit against yet — create the booking exactly as before, fee-free,
    // awaiting a quote. Unchanged from the pre-existing behavior other than no longer
    // charging the old flat wallet fee (removed platform-wide, not just for the fixed-
    // price path).
    const booking = await createBooking({
      ...bookingData,
      bookingFeeAmount: 0,
      bookingFeeStatus: 'waived',
      paymentStatus: 'pending',
      depositAmount: 0,
      balanceOwed: 0,
    })
    return { success: true, requiresPayment: false, bookingId: booking.id }
  }

  // Phase S4 Part B handoff: when a booking is created from an agreed pre-booking
  // negotiation, the price comes FROM the negotiation, not from whatever totalPrice the
  // caller sent — see claimNegotiation's header comment for why.
  const negotiationId = String(bookingData?.negotiationId || '').trim()
  let claimedAgreedPrice: number | null = null
  if (negotiationId) {
    const claim = await claimNegotiation(negotiationId, String(bookingData?.serviceId || ''), String(bookingData?.customerId || ''))
    if (!claim.success) {
      return { success: false, error: claim.error, status: 409 }
    }
    claimedAgreedPrice = claim.agreedPrice
  }

  const totalPrice = negotiationId ? Number(claimedAgreedPrice) : Number(bookingData?.totalPrice) || 0
  if (totalPrice <= 0) {
    if (negotiationId) await releaseNegotiationClaim(negotiationId)
    return { success: false, error: 'Invalid booking total', status: 400 }
  }

  // Created 'pending' first, then immediately claimed via handleBookingPaid below — not
  // because anything is being charged, but to reuse that function's atomic claim and its
  // confirmation side effects (customer/provider email + SMS, notifyWaBuyerBookingPaid)
  // rather than duplicating them here. The whole price is owed directly to the provider,
  // settled off-platform.
  const booking = await createBooking({
    ...bookingData,
    status: 'pending',
    paymentStatus: 'pending',
    // Explicit, not just spread from bookingData — when negotiationId is present these
    // MUST come from the claimed negotiation, not whatever the client submitted.
    totalPrice,
    finalPrice: totalPrice,
    depositAmount: 0,
    bookingFeeAmount: 0,
    bookingFeeStatus: 'waived',
    balanceOwed: totalPrice,
  })

  if (negotiationId) await finalizeNegotiationClaim(negotiationId, booking.id)

  await handleBookingPaid(booking.id, 'not_required', { note: 'Services are not monetized on the platform — confirmed without payment.' })

  return { success: true, requiresPayment: false, bookingId: booking.id }
}

// Phase S3: a requiresQuote:true booking already exists (created fee-free at request
// time by the branch above) and the provider has since sent a quote via their existing
// dashboard (app/api/database/bookings/[id]/route.ts's PATCH sets pricingStatus:'quoted'
// + finalPrice — unchanged by this task). The buyer accepting that quote is what confirms
// the booking at the quoted finalPrice — no charge, same as initiateBookingPayment above.
export async function initiatePaymentForQuotedBooking(
  bookingId: string,
  options: { callbackUrl?: string } = {}
): Promise<InitiateBookingPaymentResult> {
  await connectToDatabase()

  const booking: any = await Booking.findById(bookingId).lean()
  if (!booking) return { success: false, error: 'Booking not found', status: 404 }
  if (!booking.requiresQuote) return { success: false, error: 'This booking does not need a quote', status: 400 }
  if (booking.pricingStatus !== 'quoted') return { success: false, error: 'There is no active quote to accept for this booking', status: 409 }
  if (booking.quoteExpiresAt && new Date(booking.quoteExpiresAt).getTime() < Date.now()) {
    return { success: false, error: 'This quote has expired', status: 410 }
  }

  const finalPrice = Number(booking.finalPrice)
  if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
    return { success: false, error: 'Invalid quoted price', status: 400 }
  }

  // Accepting a quote confirms the booking directly — same no-charge, reuse-
  // handleBookingPaid approach as initiateBookingPayment above. Marked 'accepted'/
  // 'pending' first (matches the web PATCH route's own "accepted follows quoted" rule,
  // and keeps handleBookingPaid's claim guard — paymentStatus $ne 'paid' — meaningful)
  // immediately before claiming it as paid in the same call.
  await Booking.updateOne(
    { _id: bookingId },
    {
      $set: {
        totalPrice: finalPrice,
        pricingStatus: 'accepted',
        paymentStatus: 'pending',
        depositAmount: 0,
        bookingFeeAmount: 0,
        bookingFeeStatus: 'waived',
        balanceOwed: finalPrice,
      },
    }
  )

  await handleBookingPaid(bookingId, 'not_required', { note: 'Services are not monetized on the platform — confirmed without payment.' })

  return { success: true, requiresPayment: false, bookingId }
}
