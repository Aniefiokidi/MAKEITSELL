
import { NextRequest, NextResponse } from 'next/server'
import { serialize } from 'cookie'
import { signUp } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'


export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(request, {
      key: 'auth-signup',
      maxRequests: 6,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const { email, password, name, role, vendorType, phone } = await request.json()

    const isValidVendorType = vendorType === "goods" || vendorType === "services" || vendorType === "both"
    if (role === "vendor" && !isValidVendorType) {
      return NextResponse.json({
        success: false,
        error: 'Please choose what you want to offer: goods, services, or both'
      }, { status: 400 })
    }
    
    const vendorInfo = role === "vendor" ? {
      businessName: name,
      businessType: vendorType
    } : undefined

    const result = await signUp({
      email,
      password,
      name,
      phone,
      role: role === "admin" ? "customer" : role,
      vendorInfo
    })

    if (result.success && result.sessionToken) {
      // Set HTTP-only cookie
      const cookie = serialize('sessionToken', result.sessionToken, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
      const safePayload = {
        ...result,
        sessionToken: undefined,
      }
      return new NextResponse(JSON.stringify(safePayload), {
        status: 200,
        headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json(result)
  } catch (error: any) {
    if (error?.message === 'VERIFICATION_EMAIL_SEND_FAILED') {
      return NextResponse.json({
        success: false,
        error: 'We created your account, but we could not deliver your verification code right now. Please try again from the verification page.',
        code: 'VERIFICATION_EMAIL_SEND_FAILED'
      }, { status: 502 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create account'
    }, { status: 400 })
  }
}