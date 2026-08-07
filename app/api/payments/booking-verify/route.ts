// Browser-redirect confirmation path for booking deposit payments — the booking
// equivalent of app/api/payments/verify/route.ts, kept as its own route rather than
// sharing that one (same precedent as vendor-subscription/callback and
// vendor-subscription-signup/callback being their own routes rather than folded into the
// order verify flow). Passed as initializePayment's callbackUrl in lib/booking-payment.ts.
//
// Unlike verify.ts, this doesn't need elaborate multi-candidate reference/orderId
// resolution — every booking payment this app ever creates goes through
// lib/booking-payment.ts, which always sets metadata.orderId to the booking id and
// metadata.type to 'booking', so there's exactly one place to look.
import { NextRequest, NextResponse } from 'next/server'
import { paystackService } from '@/lib/payment'
import { handleBookingPaid } from '@/lib/booking-payment-confirmation'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

export async function GET(request: NextRequest) {
  const appBaseUrl = getCanonicalAppBaseUrl(new URL(request.url).origin)

  try {
    const { searchParams } = new URL(request.url)
    const reference = searchParams.get('reference')

    if (!reference) {
      const errorUrl = new URL('/appointments', appBaseUrl)
      errorUrl.searchParams.set('error', 'missing_reference')
      return NextResponse.redirect(errorUrl.toString())
    }

    const verificationResult = await paystackService.verifyPayment(reference)
    if (!verificationResult.success) {
      const errorUrl = new URL('/appointments', appBaseUrl)
      errorUrl.searchParams.set('error', 'payment_failed')
      return NextResponse.redirect(errorUrl.toString())
    }

    const paymentData = verificationResult.data || {}
    const bookingId = String(paymentData?.metadata?.orderId || paymentData?.metadata?.orderID || '').trim()

    if (!bookingId) {
      const errorUrl = new URL('/appointments', appBaseUrl)
      errorUrl.searchParams.set('error', 'missing_booking_reference')
      return NextResponse.redirect(errorUrl.toString())
    }

    await handleBookingPaid(bookingId, reference, paymentData)

    const redirectUrl = new URL('/booking-confirmation', appBaseUrl)
    redirectUrl.searchParams.set('bookingId', bookingId)
    return NextResponse.redirect(redirectUrl.toString())
  } catch (error) {
    console.error('Booking payment verification error:', error)
    const errorUrl = new URL('/appointments', appBaseUrl)
    errorUrl.searchParams.set('error', 'verification_failed')
    return NextResponse.redirect(errorUrl.toString())
  }
}
