import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'

// Fired once when a `?ref=CODE` referral link is opened, before the visitor has even
// signed up — separate from the signup-time attribution which sets referredByVendorId.
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await enforceRateLimit(request, {
      key: 'referral-track-click',
      maxRequests: 20,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json().catch(() => ({}))
    const code = String(body?.code || '').trim().toUpperCase()
    if (!code) {
      return NextResponse.json({ success: false, error: 'code is required' }, { status: 400 })
    }

    await connectToDatabase()
    await User.updateOne({ referralCode: code }, { $inc: { referralClickCount: 1 } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to track click' }, { status: 500 })
  }
}
