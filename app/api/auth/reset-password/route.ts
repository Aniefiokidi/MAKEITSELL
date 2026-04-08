import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import crypto from 'crypto'
import { User } from '@/lib/models/User'
import { hashPassword } from '@/lib/password'
import { enforceRateLimit } from '@/lib/rate-limit'

function normalizeEmail(input: unknown): string {
  return String(input || '').trim().toLowerCase()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(request, {
      key: 'auth-reset-password',
      maxRequests: 6,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    await connectToDatabase()

    const { email, resetCode, resetToken, newPassword } = await request.json()
    const normalizedEmail = normalizeEmail(email)
    const codeInput = String(resetCode ?? resetToken ?? '').trim()

    if (!normalizedEmail || !codeInput || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Email, reset code and new password required' },
        { status: 400 }
      )
    }

    // Find user
    const user = await User.findOne({ email: { $regex: `^${escapeRegExp(normalizedEmail)}$`, $options: 'i' } })
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
        { success: false, error: 'Reset code has expired' },
        { status: 400 }
      )
    }

    if (user.resetToken !== codeInput) {
      return NextResponse.json(
        { success: false, error: 'Invalid reset code' },
        { status: 400 }
      )
    }

    const passwordHash = hashPassword(newPassword)
    user.passwordHash = passwordHash
    user.resetToken = undefined
    user.resetTokenExpiry = undefined
    user.sessionToken = crypto.randomBytes(32).toString('hex')
    await user.save()

    console.log(`[auth/reset-password] Reset password for user: ${normalizedEmail}`)

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
