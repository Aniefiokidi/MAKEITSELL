import { NextRequest, NextResponse } from 'next/server'
import { serialize } from 'cookie'
import crypto from 'crypto'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { hashPassword } from '@/lib/password'
import { validatePassword } from '@/lib/password-policy'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/request-security'
import { PLACEHOLDER_BUYER_NAME } from '@/lib/whatsapp/buyer-identity'

function maskPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length <= 4) return digits
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
}

// GET ?token=... — validates a claim link and returns just enough context for the web
// form to display (masked phone, an existing name if a real one was ever collected during
// checkout). No auth required: the token itself is the credential, same trust model as a
// password-reset link.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || ''
  if (!token) {
    return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 })
  }

  await connectToDatabase()
  const mapping: any = await WhatsAppBuyer.findOne({ claimToken: token, claimTokenExpiresAt: { $gt: new Date() } }).lean()
  if (!mapping) {
    return NextResponse.json({ success: false, error: 'This link is invalid or has expired.' }, { status: 400 })
  }

  const user: any = await User.findById(mapping.customerId).select('name phone isPlaceholderAccount').lean()
  if (!user?.isPlaceholderAccount) {
    return NextResponse.json({ success: false, error: 'This account has already been set up.' }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    maskedPhone: maskPhone(user.phone),
    name: user.name && user.name !== PLACEHOLDER_BUYER_NAME ? user.name : '',
  })
}

export async function POST(request: NextRequest) {
  try {
    const originCheck = enforceSameOrigin(request)
    if (originCheck) return originCheck

    const rateLimitResponse = await enforceRateLimit(request, {
      key: 'auth-claim-account',
      maxRequests: 6,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const token = String(body?.token || '').trim()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const name = String(body?.name || '').trim()

    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 })
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'A valid email is required' }, { status: 400 })
    }

    const passwordCheck = await validatePassword(password)
    if (!passwordCheck.valid) {
      return NextResponse.json({ success: false, error: passwordCheck.error }, { status: 400 })
    }

    await connectToDatabase()

    const mapping: any = await WhatsAppBuyer.findOne({ claimToken: token, claimTokenExpiresAt: { $gt: new Date() } })
    if (!mapping) {
      return NextResponse.json({ success: false, error: 'This link is invalid or has expired.' }, { status: 400 })
    }

    const user: any = await User.findById(mapping.customerId)
    if (!user?.isPlaceholderAccount) {
      return NextResponse.json({ success: false, error: 'This account has already been set up.' }, { status: 400 })
    }

    const emailTaken = await User.findOne({ email, _id: { $ne: user._id } }).select('_id').lean()
    if (emailTaken) {
      return NextResponse.json(
        { success: false, error: 'That email is already registered — log in instead, or use a different email.' },
        { status: 409 }
      )
    }

    const newSessionToken = crypto.randomBytes(32).toString('hex')

    user.email = email
    user.passwordHash = hashPassword(password)
    if (name) {
      user.name = name
      user.displayName = name
    }
    // Reaching this point already proves ownership of a real, verified channel
    // (WhatsApp) — no separate email-OTP step, confirmed decision.
    user.isPlaceholderAccount = false
    user.isEmailVerified = true
    user.sessionToken = newSessionToken
    user.updatedAt = new Date()

    try {
      await user.save()
    } catch (saveError: any) {
      if (saveError?.code === 11000) {
        return NextResponse.json(
          { success: false, error: 'That email is already registered — log in instead, or use a different email.' },
          { status: 409 }
        )
      }
      throw saveError
    }

    // Single-use: clear the token now that it's been consumed.
    mapping.claimToken = null
    mapping.claimTokenExpiresAt = null
    mapping.updatedAt = new Date()
    await mapping.save()

    const sessionCookie = serialize('sessionToken', newSessionToken, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    return new NextResponse(
      JSON.stringify({
        success: true,
        message: 'Account set up successfully',
        // Also returned in the body for clients with no cookie jar (the mobile app),
        // same dual-delivery app/api/auth/complete-setup-password/route.ts already uses.
        sessionToken: newSessionToken,
        user: {
          id: String(user._id),
          email: user.email,
          name: user.name,
          role: user.role,
        },
      }),
      { status: 200, headers: { 'Set-Cookie': sessionCookie, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[auth/claim-account] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to set up account' }, { status: 500 })
  }
}
