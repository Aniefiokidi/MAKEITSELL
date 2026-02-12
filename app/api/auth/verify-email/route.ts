import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'

export async function GET(request: NextRequest) {
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
    await user.save()

    console.log(`[verify-email] Email verified for user: ${user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully'
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

    // Send verification email
    const { emailService } = require('@/lib/email')
    const baseUrl = 'https://www.makeitsell.org';
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`
    
    const emailSent = await emailService.sendEmailVerification({
      email: user.email,
      name: user.name || user.displayName || 'User',
      verificationUrl
    })

    if (!emailSent) {
      return NextResponse.json({
        success: false,
        error: 'Failed to send verification email'
      }, { status: 500 })
    }

    console.log(`[verify-email] Verification email resent to: ${user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully'
    })

  } catch (error: any) {
    console.error('[verify-email] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}