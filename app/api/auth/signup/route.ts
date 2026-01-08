
import { NextRequest, NextResponse } from 'next/server'
import { serialize } from 'cookie'
import { signUp } from '@/lib/auth'


export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role, vendorType } = await request.json()
    
    const vendorInfo = role === "vendor" ? {
      businessName: name,
      businessType: vendorType || "both"
    } : undefined

    const result = await signUp({
      email,
      password,
      name,
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
      return new NextResponse(JSON.stringify(result), {
        status: 200,
        headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create account'
    }, { status: 400 })
  }
}