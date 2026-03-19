import { NextResponse } from 'next/server'

let cachedBanks: any[] | null = null
let cachedAt: number | null = null
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour

const PAYSTACK_BASE_URL = 'https://api.paystack.co'

const getPaystackSecret = () => {
  const key = String(process.env.PAYSTACK_SECRET_KEY || '').trim()
  if (!key || !key.startsWith('sk_')) {
    throw new Error('PAYSTACK_SECRET_KEY missing or invalid')
  }
  return key
}

export async function GET() {
  try {
    if (cachedBanks && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({ success: true, banks: cachedBanks })
    }

    const secret = getPaystackSecret()
    const response = await fetch(`${PAYSTACK_BASE_URL}/bank?country=nigeria&currency=NGN`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      cache: 'no-store',
    })

    const result = await response.json()
    const rawBanks = Array.isArray(result?.data) ? result.data : []
    const banks = rawBanks
      .map((bank: any) => ({
        name: String(bank?.name || '').trim(),
        code: String(bank?.code || '').trim(),
      }))
      .filter((bank: { name: string; code: string }) => bank.name && bank.code)

    if (!response.ok || !result?.status || banks.length === 0) {
      console.error('[banks] Paystack error', result?.message, result)
      return NextResponse.json({ success: false, error: result?.message || 'Failed to fetch banks' }, { status: 502 })
    }

    cachedBanks = banks
    cachedAt = Date.now()

    return NextResponse.json({ success: true, banks })
  } catch (error: any) {
    console.error('[banks] unexpected', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch banks' }, { status: 500 })
  }
}
