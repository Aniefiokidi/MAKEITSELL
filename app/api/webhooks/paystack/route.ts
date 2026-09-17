import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { applyProviderRefundOutcome } from '@/lib/after-sales'

// Paystack signs every webhook with HMAC-SHA512 of the raw body under the account's
// secret key, sent as x-paystack-signature. Verify against the raw text, before any
// JSON parsing — re-serialised JSON will not match.
function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = (process.env.PAYSTACK_SECRET_KEY || '').trim()
  if (!secret || !signature) return false
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected, 'utf8'), b = Buffer.from(signature, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

// Only refund events are acted on here. Charge confirmation is done by verifying the
// transaction at checkout, not by webhook, so charge.* events are acknowledged and
// ignored rather than treated as unknown.
const REFUND_EVENTS: Record<string, string> = {
  'refund.processed': 'processed',
  'refund.failed': 'failed',
  'refund.pending': 'pending',
  'refund.processing': 'processing',
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (!verifySignature(rawBody, request.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 })
  }

  let payload: any
  try { payload = JSON.parse(rawBody) } catch { return NextResponse.json({ success: false, error: 'Malformed payload' }, { status: 400 }) }

  const status = REFUND_EVENTS[String(payload?.event || '')]
  // Paystack retries anything that isn't a 2xx. Events we don't handle are acknowledged
  // so they stop coming; only signature failures and malformed bodies are refused.
  if (!status) return NextResponse.json({ success: true, ignored: payload?.event || 'unknown' })

  const refundId = Number(payload?.data?.id)
  if (!Number.isSafeInteger(refundId) || refundId <= 0) return NextResponse.json({ success: true, ignored: 'no refund id' })

  try {
    const outcome = await applyProviderRefundOutcome(refundId, status, {
      amountKobo: Number.isFinite(Number(payload?.data?.amount)) ? Number(payload.data.amount) : undefined,
      reason: payload?.data?.merchant_note || payload?.data?.reason || undefined,
    })
    return NextResponse.json({ success: true, ...outcome })
  } catch (error: any) {
    // A genuine failure to apply (e.g. amount mismatch) must not be silently
    // acknowledged: a non-2xx makes Paystack retry, and the case is left untouched
    // for the reconciler or an admin to look at.
    console.error('[paystack-webhook] refund outcome not applied', error)
    return NextResponse.json({ success: false, error: error?.message || 'Could not apply refund outcome' }, { status: 500 })
  }
}
