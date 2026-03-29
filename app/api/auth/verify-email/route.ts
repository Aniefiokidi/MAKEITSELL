import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { emailService } from '@/lib/email'

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

  const host = request.headers.get('host') || 'www.makeitsell.org'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  return `${protocol}://${host}`
}

export async function GET(request: NextRequest) {
    // Redirect any Vercel domain to www.makeitsell.org
    const host = request.headers.get('host') || '';
    if (host.endsWith('.vercel.app')) {
      const { searchParams } = new URL(request.url);
      const token = searchParams.get('token');
      const redirectUrl = `https://www.makeitsell.org/verify-email?token=${token || ''}`;
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
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json({
        success: false,
        error: 'Email and verification code are required'
      }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedCode = String(code).trim()

    if (!/^\d{6}$/.test(normalizedCode)) {
      return NextResponse.json({
        success: false,
        error: 'Verification code must be 6 digits'
      }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({
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
    const { email } = await request.json()

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

    user.emailVerificationToken = verificationCode
    user.emailVerificationTokenExpiry = tokenExpiry
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