import { NextResponse } from 'next/server'
import { xoroPayService } from '@/lib/xoro-pay'

let cachedBanks: any[] | null = null
let cachedAt: number | null = null
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour

export async function GET() {
  try {
    if (cachedBanks && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({ success: true, banks: cachedBanks })
    }

    const result = await xoroPayService.listBanks()
    const banks = Array.isArray(result.banks) ? result.banks : []

    if (!result.success || banks.length === 0) {
      console.error('[banks] Xoro error', result?.message, result?.raw)
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
