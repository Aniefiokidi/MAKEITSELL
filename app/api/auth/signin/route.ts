import { NextRequest, NextResponse } from 'next/server'
import { serialize } from 'cookie'
import { signIn } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    // Try MongoDB authentication
    try {
      console.log('[/api/auth/signin] Signing in user:', email);
      const result = await signIn({ email, password })
      console.log('[/api/auth/signin] signIn result:', result.success ? 'SUCCESS' : 'FAILED');
      if (result.success && result.sessionToken) {
        // Set HTTP-only cookie
        const cookie = serialize('sessionToken', result.sessionToken, {
          httpOnly: true,
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          sameSite: 'lax',
          secure: false, // Always false in dev, true in prod
        })
        console.log('[/api/auth/signin] Setting cookie with sessionToken');
        return new NextResponse(JSON.stringify(result), {
          status: 200,
          headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
        })
      }
      return NextResponse.json(result)
    } catch (mongoError: any) {
      console.log('[/api/auth/signin] Auth error:', mongoError.message);
      return NextResponse.json({
        success: false,
        error: mongoError.message || 'Authentication failed'
      }, { status: 401 })
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Server error during authentication'
    }, { status: 500 })
  }
}