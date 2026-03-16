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
          secure: process.env.NODE_ENV === 'production',
        })
        return new NextResponse(JSON.stringify(result), {
          status: 200,
          headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
        })
      }
      return NextResponse.json(result)
    } catch (mongoError: any) {
      const message = mongoError?.message || 'Authentication failed'
      console.log('[/api/auth/signin] Auth error:', message);

      const isDbConnectivityError =
        message.includes('querySrv ECONNREFUSED') ||
        message.includes('ENOTFOUND') ||
        message.includes('ECONNREFUSED') ||
        message.includes('MongoServerSelectionError') ||
        message.includes('MongooseServerSelectionError')

      return NextResponse.json({
        success: false,
        error: message
      }, { status: isDbConnectivityError ? 503 : 401 })
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Server error during authentication'
    }, { status: 500 })
  }
}