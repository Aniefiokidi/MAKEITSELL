import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { emailService } from '@/lib/email'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

function normalizeChannel(rawChannel: unknown): 'email' {
  const value = String(rawChannel || '').trim().toLowerCase()
  if (value === 'email') return 'email'
  return 'email'
}

  function normalizeEmail(input: unknown): string {
    return String(input || '').trim().toLowerCase()
  }

  function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function buildSessionCookie(sessionToken: string) {
  const { serialize } = require('cookie')
  return serialize('sessionToken', sessionToken, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

async function finalizeVerifiedUser(user: any) {
  user.isEmailVerified = true
  user.emailVerificationToken = undefined
  user.emailVerificationTokenExpiry = undefined
  user.verificationEmailRetryPending = false
  user.verificationEmailRetryCount = 0
  user.verificationEmailNextRetryAt = undefined
  user.verificationEmailLastError = undefined
  user.updatedAt = new Date()

  const crypto = require('crypto')
  const sessionToken = crypto.randomBytes(32).toString('hex')
  user.sessionToken = sessionToken
  await user.save()

  console.log(`[verify-email] Email verified for user: ${user.email}`)

  return new NextResponse(JSON.stringify({
    success: true,
    message: 'Email verified successfully',
    redirectUrl: '/stores'
  }), {
    status: 200,
    headers: { 'Set-Cookie': buildSessionCookie(sessionToken), 'Content-Type': 'application/json' },
  })
}

function getVerificationBaseUrl(request: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (explicit) return getCanonicalAppBaseUrl(explicit)

  const host = request.headers.get('host') || 'www.makeitsell.ng'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  return getCanonicalAppBaseUrl(`${protocol}://${host}`)
}

export async function GET(request: NextRequest) {
    // Redirect any Vercel domain to www.makeitsell.ng
    const host = request.headers.get('host') || '';
    if (host.endsWith('.vercel.app')) {
      const { searchParams } = new URL(request.url);
      const token = searchParams.get('token');
      const redirectUrl = `https://www.makeitsell.ng/verify-email?token=${token || ''}`;
      return NextResponse.redirect(redirectUrl, 308);
    }
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Verification token is required'
      }, { status: 400 })
    }

    await connectToDatabase()

    // Find user with the verification token
    const user = await User.findOne({ 
      emailVerificationToken: token,
      emailVerificationTokenExpiry: { $gt: new Date() }
    })

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired verification token'
      }, { status: 400 })
    }

    return await finalizeVerifiedUser(user)

  } catch (error: any) {
    console.error('[verify-email] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Verify OTP code
export async function PUT(request: NextRequest) {
  try {
    const { email, code, channel } = await request.json()
    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail || !code) {
      return NextResponse.json({
        success: false,
        error: 'Email and verification code are required'
      }, { status: 400 })
    }

    const normalizedCode = String(code).trim()
    normalizeChannel(channel)

    if (!/^\d{6}$/.test(normalizedCode)) {
      return NextResponse.json({
        success: false,
        error: 'Verification code must be 6 digits'
      }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({
      email: { $regex: `^${escapeRegExp(normalizedEmail)}$`, $options: 'i' },
      emailVerificationToken: normalizedCode,
      emailVerificationTokenExpiry: { $gt: new Date() }
    })

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired verification code'
      }, { status: 400 })
    }

    return await finalizeVerifiedUser(user)
  } catch (error: any) {
    console.error('[verify-email][PUT] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Resend verification email
export async function POST(request: NextRequest) {
  try {
    const { email, channel } = await request.json()
    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail) {
      return NextResponse.json({
        success: false,
        error: 'Email is required'
      }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({ email: { $regex: `^${escapeRegExp(normalizedEmail)}$`, $options: 'i' } })

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    if (user.isEmailVerified) {
      return NextResponse.json({
        success: false,
        error: 'Email is already verified'
      }, { status: 400 })
    }

    const verificationCode = generateVerificationCode()
    const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000)
    normalizeChannel(channel)

    user.emailVerificationToken = verificationCode
    user.emailVerificationTokenExpiry = tokenExpiry
    user.verificationEmailLastAttemptAt = new Date()
    user.updatedAt = new Date()
    await user.save()

    // Await send so request reports real delivery status.
    const sent = await emailService.sendEmailVerification({
      email: user.email,
      name: user.name || user.displayName || 'User',
      verificationCode,
    })

    if (!sent) {
      const deliveryError = emailService.getLastDeliveryError() || 'Unknown delivery provider error'
      console.error('[verify-email] Email delivery failed:', {
        email: user.email,
        deliveryError,
      })

      return NextResponse.json({
        success: false,
        error: 'Could not send verification email right now. Please try again in a minute.',
        details: deliveryError,
      }, { status: 502 })
    }

    user.verificationEmailRetryPending = false
    user.verificationEmailRetryCount = 0
    user.verificationEmailNextRetryAt = undefined
    user.verificationEmailLastError = undefined
    user.verificationEmailLastAttemptAt = new Date()
    user.updatedAt = new Date()
    await user.save()

    console.log(`[verify-email] Verification code resent to: ${user.email}`)
    return NextResponse.json({
      success: true,
      message: 'Verification code sent successfully'
    })

  } catch (error: any) {
    console.error('[verify-email] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}