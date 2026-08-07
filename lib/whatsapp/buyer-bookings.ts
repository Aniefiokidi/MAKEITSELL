// Service-role booking creation for the WhatsApp bot — the booking counterpart to
// lib/whatsapp/buyer-orders.ts. Same trust model: not an HTTP route, only reachable from
// trusted server code already past the webhook's HMAC signature verification (see that
// file's header comment for the full explanation — identical here, not repeated).
import { initiateBookingPayment, initiatePaymentForQuotedBooking, type InitiateBookingPaymentResult } from '@/lib/booking-payment'
import { findOrCreateBuyerForWaId, placeholderEmailForWaId } from '@/lib/whatsapp/buyer-identity'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

export type CreateBookingForWaBuyerInput = {
  waId: string
  name?: string
  bookingData: Record<string, any>
}

// Deliberately thin: initiateBookingPayment (lib/booking-payment.ts) already owns the
// slot-conflict check, deposit/fee math, booking creation, and Paystack init — this only
// resolves the passwordless buyer identity into customerId/customerEmail/customerName and
// points Paystack's browser-redirect callback at the same booking-verify route the web
// flow uses (a WhatsApp buyer completes payment on Paystack's own page, same as web; the
// actual "you're booked" message back in the chat comes from
// notifyWaBuyerBookingPaid, called from handleBookingPaid once payment is confirmed, not
// from this redirect).
export async function createBookingForWaBuyer(input: CreateBookingForWaBuyerInput): Promise<InitiateBookingPaymentResult> {
  const { waId, name, bookingData } = input
  const { customerId } = await findOrCreateBuyerForWaId(waId, name)

  const appBaseUrl = getCanonicalAppBaseUrl()

  return initiateBookingPayment(
    {
      ...bookingData,
      customerId,
      customerName: bookingData.customerName || name || 'WhatsApp Buyer',
      customerEmail: String(bookingData.customerEmail || '').trim() || placeholderEmailForWaId(waId),
      customerPhone: bookingData.customerPhone || waId,
    },
    { callbackUrl: `${appBaseUrl}/api/payments/booking-verify` }
  )
}

// Phase S3: buyer accepting a quote the provider sent from their dashboard
// (lib/whatsapp/service-quote.ts's "accept <ref>" handling). No identity resolution
// needed here — the booking (and its customerId) already exists from when the buyer
// originally submitted the request — so this is a straight pass-through, kept as its own
// function only so callback-URL wiring lives in one place alongside createBookingForWaBuyer.
export async function acceptQuoteForWaBuyer(bookingId: string): Promise<InitiateBookingPaymentResult> {
  const appBaseUrl = getCanonicalAppBaseUrl()
  return initiatePaymentForQuotedBooking(bookingId, { callbackUrl: `${appBaseUrl}/api/payments/booking-verify` })
}
