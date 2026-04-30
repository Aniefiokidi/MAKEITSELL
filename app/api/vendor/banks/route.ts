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
  const key = String(process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || '').trim()
  return key && key.startsWith('sk_') ? key : ''
}

const fetchPaystackBanks = async () => {
  const secret = getPaystackSecret()
  if (!secret) {
    return { success: false, banks: [] as Array<{ name: string; code: string }>, message: 'Paystack secret key unavailable' }
  }

  const byCode = new Map<string, { name: string; code: string }>()
  let page = 1
  let pageCount = 1

  // Fetch all available pages from Paystack so we return the complete bank list.
  do {
    const response = await fetch(`${PAYSTACK_BASE_URL}/bank?country=nigeria&currency=NGN&perPage=100&page=${page}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => ({}))
    const banksOnPage = Array.isArray(payload?.data)
      ? payload.data
          .map((bank: any) => ({
            name: String(bank?.name || '').trim(),
            code: String(bank?.code || '').trim(),
          }))
          .filter((bank: { name: string; code: string }) => bank.name && bank.code)
      : []

    banksOnPage.forEach((bank: { name: string; code: string }) => {
      if (!byCode.has(bank.code)) byCode.set(bank.code, bank)
    })

    const responsePageCount = Number(payload?.meta?.pageCount || payload?.meta?.page_count || 1)
    pageCount = Number.isFinite(responsePageCount) && responsePageCount > 0 ? responsePageCount : 1

    if (!response.ok || !payload?.status) {
      break
    }
    page += 1
  } while (page <= pageCount)

  const banks = Array.from(byCode.values()).sort((a, b) => a.name.localeCompare(b.name))

  return {
    success: banks.length > 0,
    banks,
    message: banks.length > 0 ? 'Banks retrieved' : 'Failed to fetch banks from Paystack',
  }
}

export async function GET(request: NextRequest) {
  try {
    const forceRefresh = new URL(request.url).searchParams.get('refresh') === '1'
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

    if (!forceRefresh && cachedBanks && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({ success: true, banks: cachedBanks, source: 'cache', count: cachedBanks.length })
    }

    const fallbackResult = await fetchPaystackBanks()
    let banks = Array.isArray(fallbackResult.banks) ? fallbackResult.banks : []
    const paystackLooksComplete = fallbackResult.success && banks.length >= 25
    if (!paystackLooksComplete) {
      // Do not cache fallback-only data; this prevents stale short lists from persisting.
      banks = FALLBACK_BANKS
      return NextResponse.json({
        success: true,
        banks,
        source: 'fallback',
        count: banks.length,
        warning: 'Full Paystack bank list unavailable. Check PAYSTACK_SECRET_KEY in deployed env.',
      })
    }

    cachedBanks = banks
    cachedAt = Date.now()

    return NextResponse.json({ success: true, banks, source: 'paystack', count: banks.length })
  } catch (error: any) {
    console.error('[banks] unexpected', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch banks' }, { status: 500 })
  }
}
