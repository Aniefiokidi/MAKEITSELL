import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import crypto from 'crypto'
import { User } from '@/lib/models/User'
import { hashPassword } from '@/lib/password'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(request, {
      key: 'auth-reset-password',
      maxRequests: 6,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    await connectToDatabase()

    const { email, resetToken, newPassword } = await request.json()

    if (!email || !resetToken || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Email, reset token and new password required' },
        { status: 400 }
      )
    }

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.resetToken || !user.resetTokenExpiry) {
      return NextResponse.json(
        { success: false, error: 'No password reset request found' },
        { status: 400 }
      )
    }

    if (new Date() > user.resetTokenExpiry) {
      return NextResponse.json(
        { success: false, error: 'Reset token has expired' },
        { status: 400 }
      )
    }

    if (user.resetToken !== String(resetToken)) {
      return NextResponse.json(
        { success: false, error: 'Invalid reset token' },
        { status: 400 }
      )
    }

    const passwordHash = hashPassword(newPassword)
    user.passwordHash = passwordHash
    user.resetToken = undefined
    user.resetTokenExpiry = undefined
    user.sessionToken = crypto.randomBytes(32).toString('hex')
    await user.save()

    console.log(`[auth/reset-password] Reset password for user: ${email}`)

    return NextResponse.json(
      {
        success: true,
        message: 'Password reset successfully',
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[auth/reset-password] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
