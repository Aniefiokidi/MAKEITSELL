// Refunds back to the customer's original payment method, via Paystack's Refund API.
//
// Same conventions as paystack-transfer.ts: never throws, always resolves to a
// { success, ... } object, reads the secret at call time. Kept deliberately thin —
// every decision about *whether* and *how much* to refund lives in lib/after-sales.ts,
// which also owns the ledger; this file only talks to Paystack.
//
// Paystack refunds are asynchronous: POST /refund returns a refund in `pending` and
// the money actually moves later (bank-dependent, usually minutes, occasionally days).
// Callers must treat a successful initiate() as "requested", not "refunded", and
// confirm via the refund.processed webhook or fetchRefund().

interface InitiateRefundResponse {
  success: boolean
  refundId?: number
  status?: string
  message?: string
  raw?: any
}

interface FetchRefundResponse {
  success: boolean
  refundId?: number
  status?: string
  amountKobo?: number
  message?: string
  raw?: any
}

const PAYSTACK_BASE_URL = 'https://api.paystack.co'

const getPaystackSecret = () => {
  const key = (process.env.PAYSTACK_SECRET_KEY || '').trim()
  if (!key || !key.startsWith('sk_')) {
    throw new Error('PAYSTACK_SECRET_KEY missing or invalid')
  }
  return key
}

// A refund is only ever a partial slice of the original charge — one item, its tax
// share, possibly delivery — so the amount is always explicit, never "refund it all".
// Paystack rejects any refund that would push the transaction's refunded total past
// what was charged, which is a useful second line of defence behind our own ledger.
export async function initiateRefund(params: {
  transactionReference: string
  amountKobo: number
  merchantNote: string
  customerNote: string
}): Promise<InitiateRefundResponse> {
  try {
    const transactionReference = String(params.transactionReference || '').trim()
    if (!transactionReference) return { success: false, message: 'Order has no payment reference to refund against' }
    if (!Number.isSafeInteger(params.amountKobo) || params.amountKobo < 100) {
      return { success: false, message: 'Refund amount must be at least ₦1' }
    }

    const secret = getPaystackSecret()
    const response = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction: transactionReference,
        amount: params.amountKobo,
        currency: 'NGN',
        merchant_note: String(params.merchantNote || '').slice(0, 250),
        customer_note: String(params.customerNote || '').slice(0, 250),
      }),
    })

    const result = await response.json()
    if (result?.status && result?.data?.id) {
      return {
        success: true,
        refundId: Number(result.data.id),
        status: String(result.data.status || 'pending').toLowerCase(),
        raw: result,
      }
    }
    return { success: false, message: result?.message || 'Paystack did not accept the refund request', raw: result }
  } catch (error: any) {
    return { success: false, message: error?.message || 'Could not reach Paystack to request the refund' }
  }
}

// Polling counterpart to the refund.* webhooks, so a missed or delayed webhook can
// never strand a case in refund_pending.
export async function fetchRefund(refundId: number): Promise<FetchRefundResponse> {
  try {
    if (!Number.isSafeInteger(refundId) || refundId <= 0) return { success: false, message: 'Invalid refund id' }
    const secret = getPaystackSecret()
    const response = await fetch(`${PAYSTACK_BASE_URL}/refund/${refundId}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const result = await response.json()
    if (result?.status && result?.data?.id) {
      return {
        success: true,
        refundId: Number(result.data.id),
        status: String(result.data.status || '').toLowerCase(),
        amountKobo: Number(result.data.amount),
        raw: result,
      }
    }
    return { success: false, message: result?.message || 'Could not fetch refund status', raw: result }
  } catch (error: any) {
    return { success: false, message: error?.message || 'Could not reach Paystack to check the refund' }
  }
}

// Paystack's terminal states. Anything else ('pending', 'processing') means keep waiting.
export const REFUND_SETTLED_STATUSES = ['processed'] as const
export const REFUND_FAILED_STATUSES = ['failed'] as const
