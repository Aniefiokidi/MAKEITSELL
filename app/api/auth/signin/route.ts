import { NextRequest, NextResponse } from 'next/server'
import { serialize } from 'cookie'
import { signIn as mongoSignIn } from '@/lib/mongodb-auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    // Try MongoDB authentication
    try {
      const result = await mongoSignIn(email, password)
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