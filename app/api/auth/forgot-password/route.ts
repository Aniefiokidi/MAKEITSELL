import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import mongoose from 'mongoose'
import crypto from 'crypto'

// User schema (same as in auth.ts)
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  passwordHash: String,
  name: String,
  role: { type: String, default: 'customer' },
  vendorInfo: Object,
  sessionToken: String,
  resetToken: String,
  resetTokenExpiry: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

const User = mongoose.models.User || mongoose.model('User', userSchema)

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()

    const body = await request.json()
    const { email, resetToken, newPassword } = body

    // Case 1: Request password reset
    if (email && !resetToken) {
      const user = await User.findOne({ email })
      if (!user) {
        // Don't reveal if email exists or not
        return NextResponse.json(
          {
            success: true,
            message: 'If an account exists, you will receive password reset instructions',
          },
          { status: 200 }
        )
      }

      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex')
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      user.resetToken = token
      user.resetTokenExpiry = tokenExpiry
      await user.save()

      // In production, you would send this via email
      console.log(`[forgot-password] Reset token for ${email}: ${token}`)

      return NextResponse.json(
        {
          success: true,
          message: 'Reset instructions sent to email',
          // For development/testing, return token (remove in production)
          token: process.env.NODE_ENV === 'development' ? token : undefined,
        },
        { status: 200 }
      )
    }

    // Case 2: Reset password with token
    if (email && resetToken && newPassword) {
      const user = await User.findOne({ email })
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }

      // Verify reset token
      if (user.resetToken !== resetToken || !user.resetTokenExpiry) {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired reset token' },
          { status: 400 }
        )
      }

      if (new Date() > user.resetTokenExpiry) {
        return NextResponse.json(
          { success: false, error: 'Reset token has expired' },
          { status: 400 }
        )
      }

      // Update password
      function hashPassword(password: string) {
        return crypto.createHash('sha256').update(password).digest('hex')
      }

      user.passwordHash = hashPassword(newPassword)
      user.resetToken = undefined
      user.resetTokenExpiry = undefined
      user.sessionToken = crypto.randomBytes(32).toString('hex')
      await user.save()

      console.log(`[forgot-password] Password reset for user: ${email}`)

      return NextResponse.json(
        {
          success: true,
          message: 'Password reset successfully',
          sessionToken: user.sessionToken,
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[forgot-password] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
