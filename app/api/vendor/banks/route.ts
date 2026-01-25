import { NextResponse } from 'next/server'

const PAYSTACK_BANKS_URL = 'https://api.paystack.co/bank?country=nigeria&use_cursor=false'
let cachedBanks: any[] | null = null
let cachedAt: number | null = null
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour

export async function GET() {
  try {
    if (cachedBanks && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({ success: true, banks: cachedBanks })
    }

    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) {
      return NextResponse.json({ success: false, error: 'PAYSTACK_SECRET_KEY missing' }, { status: 500 })
    }

    const res = await fetch(PAYSTACK_BANKS_URL, {
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[banks] Paystack error', res.status, text)
      return NextResponse.json({ success: false, error: 'Failed to fetch banks' }, { status: 502 })
    }

    const data = await res.json()
    const banks = Array.isArray(data?.data) ? data.data.map((b: any) => ({ name: b.name, code: b.code })) : []
    cachedBanks = banks
    cachedAt = Date.now()

    return NextResponse.json({ success: true, banks })
  } catch (error: any) {
    console.error('[banks] unexpected', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch banks' }, { status: 500 })
  }
}
