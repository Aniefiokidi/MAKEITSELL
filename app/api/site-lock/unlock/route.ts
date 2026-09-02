import { NextRequest, NextResponse } from 'next/server'
import { serialize } from 'cookie'
import { enforceRateLimit } from '@/lib/rate-limit'
import { SITE_LOCK_COOKIE, computeUnlockToken, isSiteLockEnabled } from '@/lib/site-lock'

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: 'site-lock-unlock',
    maxRequests: 10,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  if (!isSiteLockEnabled()) {
    return NextResponse.json({ success: true })
  }

  const { password } = await request.json().catch(() => ({ password: '' }))
  const correctPassword = process.env.SITE_LOCK_PASSWORD || ''

  if (!password || password !== correctPassword) {
    return NextResponse.json({ success: false, error: 'Incorrect password.' }, { status: 401 })
  }

  const token = await computeUnlockToken(correctPassword)
  const cookie = serialize(SITE_LOCK_COOKIE, token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return new NextResponse(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
  })
}
