import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'

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

    // Mark email as verified
    user.isEmailVerified = true
    user.emailVerificationToken = undefined
    user.emailVerificationTokenExpiry = undefined
    user.updatedAt = new Date()

    // Generate new session token
    const crypto = require('crypto')
    const sessionToken = crypto.randomBytes(32).toString('hex')
    user.sessionToken = sessionToken
    await user.save()

    console.log(`[verify-email] Email verified for user: ${user.email}`)

    // Set session cookie
    const { serialize } = require('cookie')
    const cookie = serialize('sessionToken', sessionToken, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
      secure: true,
    })

    return new NextResponse(JSON.stringify({
      success: true,
      message: 'Email verified successfully',
      redirectUrl: '/stores'
    }), {
      status: 200,
      headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('[verify-email] Error:', error)
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

    // Generate new verification token
    const crypto = require('crypto')
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    user.emailVerificationToken = verificationToken
    user.emailVerificationTokenExpiry = tokenExpiry
    user.updatedAt = new Date()
    await user.save()

    // Send verification code email (code-based)
    const { emailService } = require('@/lib/email')
    const emailSent = await emailService.sendEmailVerificationCode({
      email: user.email,
      name: user.name || user.displayName || 'User',
      code: verificationToken
    })

    if (!emailSent) {
      return NextResponse.json({
        success: false,
        error: 'Failed to send verification code email'
      }, { status: 500 })
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