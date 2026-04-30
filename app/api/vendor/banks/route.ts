import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { enforceRateLimit } from '@/lib/rate-limit'

let cachedBanks: any[] | null = null
let cachedAt: number | null = null
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour
const PAYSTACK_BASE_URL = 'https://api.paystack.co'
const FALLBACK_BANKS: Array<{ name: string; code: string }> = [
  { name: 'Access Bank', code: '044' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'GTBank', code: '058' },
  { name: 'United Bank For Africa', code: '033' },
  { name: 'Zenith Bank', code: '057' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'FCMB', code: '214' },
  { name: 'Wema Bank', code: '035' },
  { name: 'OPay', code: '999992' },
]

const getPaystackSecret = () => {
  const key = String(process.env.PAYSTACK_SECRET_KEY || '').trim()
  return key && key.startsWith('sk_') ? key : ''
}

const fetchPaystackBanks = async () => {
  const secret = getPaystackSecret()
  if (!secret) {
    return { success: false, banks: [] as Array<{ name: string; code: string }>, message: 'Paystack secret key unavailable' }
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/bank?country=nigeria&currency=NGN`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => ({}))
  const banks = Array.isArray(payload?.data)
    ? payload.data
        .map((bank: any) => ({
          name: String(bank?.name || '').trim(),
          code: String(bank?.code || '').trim(),
        }))
        .filter((bank: { name: string; code: string }) => bank.name && bank.code)
    : []

  return {
    success: response.ok && Boolean(payload?.status) && banks.length > 0,
    banks,
    message: payload?.message || 'Failed to fetch banks from fallback provider',
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(request, {
      key: 'vendor-banks-list',
      maxRequests: 40,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (cachedBanks && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({ success: true, banks: cachedBanks })
    }

    const fallbackResult = await fetchPaystackBanks()
    let banks = Array.isArray(fallbackResult.banks) ? fallbackResult.banks : []
    if (!fallbackResult.success || banks.length === 0) {
      banks = FALLBACK_BANKS
    }

    cachedBanks = banks
    cachedAt = Date.now()

    return NextResponse.json({ success: true, banks })
  } catch (error: any) {
    console.error('[banks] unexpected', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch banks' }, { status: 500 })
  }
}
