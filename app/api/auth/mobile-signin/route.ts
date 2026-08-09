import { NextRequest, NextResponse } from 'next/server'
import { signIn } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'

// Non-cookie counterpart to /api/auth/signin, for clients that can't rely on an
// httpOnly cookie jar (the mobile app). Reuses the exact same credential-checking
// logic (lib/auth signIn) — same password verification, same isEmailVerified gate — so
// there is no parallel/duplicated auth path to drift out of sync. The only difference
// from /api/auth/signin is that sessionToken is returned in the JSON body instead of
// being set (and stripped from the body) as a cookie, since a non-browser client has no
// cookie jar for an httpOnly cookie to land in.
//
// Rate-limited with the same limits as /api/auth/signin, tracked in its own bucket so
// mobile and web clients can't exhaust each other's allowance.
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await enforceRateLimit(request, {
      key: 'auth-mobile-signin',
      maxRequests: 10,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const { email, password } = await request.json()

    const result = await signIn({ email, password })

    if (result.success && result.sessionToken) {
      return NextResponse.json({
        success: true,
        user: result.user,
        sessionToken: result.sessionToken,
      })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    const message = error?.message || 'Authentication failed'

    const isDbConnectivityError =
      message.includes('querySrv ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('ECONNREFUSED') ||
      message.includes('MongoServerSelectionError') ||
      message.includes('MongooseServerSelectionError')

    return NextResponse.json(
      { success: false, error: message },
      { status: isDbConnectivityError ? 503 : 401 }
    )
  }
}
