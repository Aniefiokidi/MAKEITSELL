// Shared booking-payment initiation — the booking equivalent of lib/order-creation.ts's
// buildOrder for goods. Takes booking data the caller has already priced (package/add-on
// total, location pricing, stay-details nights×rooms — whichever applies; see
// app/api/database/bookings/route.ts, which still owns all of that), and turns it into a
// pending booking + a Paystack deposit charge. Meant to be called from both the web
// booking route and (later) the WhatsApp booking flow, so neither re-derives this math or
// forgets the double-booking check.
//
// Replaces the old flat ₦500 wallet-debit booking fee entirely. New model: customer pays
// a 10% deposit of the service total PLUS a flat ₦1,000 Make It Sell booking fee, via
// Paystack, at booking time. The remaining 90% is owed to the provider and settled
// offline — never charged through this platform. Only applies to requiresQuote:false
// bookings; a requiresQuote:true booking has no known total yet, so there's nothing to
// charge a deposit against — it's created the same way it always was, fee-free, awaiting
// a quote (Phase S3's territory, not this one).
import connectToDatabase from '@/lib/mongodb'
import { Booking } from '@/lib/models/Booking'
import { createBooking } from '@/lib/mongodb-operations'
import { findBookingSlotConflict } from '@/lib/booking-availability'
import { paystackService } from '@/lib/payment'
import { calculatePaystackCheckoutAmounts } from '@/lib/paystack-charges'
import { computeBookingDeposit } from '@/lib/booking-pricing'

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

// Paystack-init tail, shared by the brand-new-booking path below and
// initiatePaymentForQuotedBooking (Phase S3) — same deposit charge either way, the only
// difference is whether a booking is being created or already exists. Callers own what
// happens to the booking record if this fails (initiateBookingPayment deletes a
// just-created one; initiatePaymentForQuotedBooking reverts the quote back to pending
// acceptance instead, since there's a real quote history worth keeping either way).
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

  const totalPrice = Number(bookingData?.totalPrice) || 0
  if (totalPrice <= 0) {
    return { success: false, error: 'Invalid booking total', status: 400 }
  }

  const { depositAmount, bookingFeeAmount, balanceOwed, amountDueNow } = computeBookingDeposit(totalPrice)

  // Created immediately, before payment — this is what actually holds the slot: the
  // conflict check above (and the one still in the booking route) only excludes
  // status: 'cancelled', so this pending booking blocks anyone else's overlap check the
  // moment it exists, exactly like a fully-paid one would. The flip side, not solved
  // here: if the customer never completes payment, this booking — and the slot it's
  // holding — never expires on its own. Needs a cleanup job (cancel stale
  // paymentStatus: 'pending' bookings after some window) before this ships to real
  // traffic; out of scope for this task.
  const booking = await createBooking({
    ...bookingData,
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: 'paystack',
    depositAmount,
    bookingFeeAmount,
    bookingFeeStatus: 'pending',
    balanceOwed,
  })

  const charge = await chargeBookingDeposit({
    bookingId: booking.id,
    customerEmail: String(bookingData?.customerEmail || ''),
    customerId: String(bookingData?.customerId || ''),
    serviceTitle: String(bookingData?.serviceTitle || ''),
    providerId: String(bookingData?.providerId || ''),
    providerName: String(bookingData?.providerName || ''),
    depositAmount,
    bookingFeeAmount,
    amountDueNow,
    callbackUrl: options.callbackUrl,
  })

  if (!charge.success) {
    // Payment couldn't be initialized — don't leave a phantom pending booking holding
    // the slot for something the customer was never actually sent a payment link for.
    await Booking.deleteOne({ _id: booking.id })
    return { success: false, error: charge.error, status: 400 }
  }

  return {
    success: true,
    requiresPayment: true,
    bookingId: booking.id,
    authorization_url: charge.authorization_url,
    reference: charge.reference,
    depositAmount,
    bookingFeeAmount,
    balanceOwed,
    payableAmount: charge.payableAmount,
  }
}

// Phase S3: a requiresQuote:true booking already exists (created fee-free at request
// time by the branch above) and the provider has since sent a quote via their existing
// dashboard (app/api/database/bookings/[id]/route.ts's PATCH sets pricingStatus:'quoted'
// + finalPrice — unchanged by this task). The buyer accepting that quote is what turns
// the quoted finalPrice into the SAME 10%-deposit-plus-fee charge a fixed-price booking
// gets — same computeBookingDeposit, same chargeBookingDeposit, no separate math.
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

  const { depositAmount, bookingFeeAmount, balanceOwed, amountDueNow } = computeBookingDeposit(finalPrice)

  // Marks acceptance before charging — matches the web PATCH route's own rule ("cannot
  // accept quote without a final quoted price" implies accepted follows quoted), and
  // means a buyer re-sending "accept" while Paystack is mid-init just re-triggers a
  // payment attempt against the same already-accepted total rather than re-deriving it.
  await Booking.updateOne(
    { _id: bookingId },
    {
      $set: {
        totalPrice: finalPrice,
        pricingStatus: 'accepted',
        paymentMethod: 'paystack',
        paymentStatus: 'pending',
        depositAmount,
        bookingFeeAmount,
        bookingFeeStatus: 'pending',
        balanceOwed,
      },
    }
  )

  const charge = await chargeBookingDeposit({
    bookingId,
    customerEmail: booking.customerEmail,
    customerId: booking.customerId,
    serviceTitle: booking.serviceTitle,
    providerId: booking.providerId,
    providerName: booking.providerName,
    depositAmount,
    bookingFeeAmount,
    amountDueNow,
    callbackUrl: options.callbackUrl,
  })

  if (!charge.success) {
    // Unlike a brand-new booking, there's real quote history here worth keeping — revert
    // the acceptance rather than delete anything, so the buyer can just try "accept" again.
    await Booking.updateOne(
      { _id: bookingId },
      { $set: { pricingStatus: 'quoted', paymentStatus: 'pending' }, $unset: { depositAmount: '', bookingFeeAmount: '', balanceOwed: '' } }
    )
    return { success: false, error: charge.error, status: 400 }
  }

  return {
    success: true,
    requiresPayment: true,
    bookingId,
    authorization_url: charge.authorization_url,
    reference: charge.reference,
    depositAmount,
    bookingFeeAmount,
    balanceOwed,
    payableAmount: charge.payableAmount,
  }
}
