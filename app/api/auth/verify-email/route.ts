import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { emailService } from '@/lib/email'
import { normalizeNigerianPhone, sendOtpSms } from '@/lib/sms'

function normalizeChannel(rawChannel: unknown): 'email' | 'sms' {
  const value = String(rawChannel || '').trim().toLowerCase()
  if (value === 'email') return 'email'
  if (value === 'phone') return 'sms'
  if (value === 'sms') return 'sms'
  return 'sms'
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
  if (explicit) return explicit.replace(/\/$/, '')

  const host = request.headers.get('host') || 'www.makeitsell.ng'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  return `${protocol}://${host}`
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
    const { email, code, channel, phoneNumber } = await request.json()

    if (!email || !code) {
      return NextResponse.json({
        success: false,
        error: 'Email and verification code are required'
      }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedCode = String(code).trim()
    const normalizedChannel = normalizeChannel(channel)

    if (!/^\d{6}$/.test(normalizedCode)) {
      return NextResponse.json({
        success: false,
        error: 'Verification code must be 6 digits'
      }, { status: 400 })
    }

    await connectToDatabase()

    const user = normalizedChannel === 'sms'
      ? await User.findOne({
          email: normalizedEmail,
          otp_code: normalizedCode,
          otp_expiry: { $gt: new Date() }
        })
      : await User.findOne({
          email: normalizedEmail,
          emailVerificationToken: normalizedCode,
          emailVerificationTokenExpiry: { $gt: new Date() }
        })

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired verification code'
      }, { status: 400 })
    }

    if (normalizedChannel === 'sms') {
      const normalizedPhone = phoneNumber ? normalizeNigerianPhone(phoneNumber) : null
      if (phoneNumber && !normalizedPhone) {
        return NextResponse.json({ success: false, error: 'Enter a valid phone number with country code.' }, { status: 400 })
      }

      ;(user as any).phone_verified = true
      ;(user as any).phone_number = normalizedPhone || (user as any).phone_number
      ;(user as any).otp_code = undefined
      ;(user as any).otp_expiry = undefined
      ;(user as any).otp_last_sent_at = undefined
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
    const { email, channel, phoneNumber } = await request.json()

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email is required'
      }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({ email })

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
    const normalizedChannel = normalizeChannel(channel)

    if (normalizedChannel === 'sms') {
      const normalizedPhone = normalizeNigerianPhone(phoneNumber || (user as any).phone_number || (user as any).phone || '')
      if (!normalizedPhone) {
        return NextResponse.json({ success: false, error: 'A valid phone number with country code is required for SMS OTP.' }, { status: 400 })
      }

      ;(user as any).phone_number = normalizedPhone
      ;(user as any).otp_code = verificationCode
      ;(user as any).otp_expiry = tokenExpiry
      ;(user as any).otp_last_sent_at = new Date()
      user.updatedAt = new Date()
      await user.save()

      const smsResult = await sendOtpSms(normalizedPhone, verificationCode)
      if (!smsResult.ok) {
        return NextResponse.json({ success: false, error: smsResult.errorMessage || 'Could not send OTP SMS right now.' }, { status: 502 })
      }

      return NextResponse.json({ success: true, message: 'OTP sent by SMS successfully' })
    }

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
      return NextResponse.json({
        success: false,
        error: 'Could not send verification email right now. Please try again in a minute.'
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