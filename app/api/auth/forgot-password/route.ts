import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import mongoose from 'mongoose'
import crypto from 'crypto'
import { emailService } from '@/lib/email'

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

      console.log(`[forgot-password] Generating NEW token for: ${email}`)
      console.log(`[forgot-password] Old token: ${user.resetToken || 'none'}`)
      console.log(`[forgot-password] Old expiry: ${user.resetTokenExpiry || 'none'}`)

      // Generate NEW reset token (always fresh)
      const token = crypto.randomBytes(32).toString('hex')
      const tokenExpiry = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

      // Clear old token and set new one
      user.resetToken = token
      user.resetTokenExpiry = tokenExpiry
      user.updatedAt = new Date()
      await user.save()

      console.log(`[forgot-password] NEW token generated: ${token}`)
      console.log(`[forgot-password] NEW expiry: ${tokenExpiry}`)
      console.log(`[forgot-password] Token saved to database`)

      // Send password reset email
      try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.makeitsell.org'
        const resetUrl = `${baseUrl}/forgot-password?token=${token}&email=${encodeURIComponent(email)}`
        
        // Ensure emailService has the method before calling
        if (typeof emailService.sendPasswordResetEmail === 'function') {
          const emailSent = await emailService.sendPasswordResetEmail({
            email: user.email,
            name: user.name || 'User',
            resetUrl: resetUrl,
            resetToken: token
          })
          
          if (emailSent) {
            console.log(`[forgot-password] Password reset email sent successfully to: ${email}`)
          } else {
            console.error(`[forgot-password] Failed to send password reset email to: ${email}`)
          }
        } else {
          console.error(`[forgot-password] sendPasswordResetEmail method not found on emailService`)
          console.log(`[forgot-password] Available methods:`, Object.getOwnPropertyNames(Object.getPrototypeOf(emailService)))
        }
      } catch (emailError) {
        console.error(`[forgot-password] Email service error:`, emailError)
        // Don't fail the request if email fails - user can still use token in development
      }

      console.log(`[forgot-password] Reset token for ${email}: ${token}`)

      return NextResponse.json(
        {
          success: true,
          message: process.env.NODE_ENV === 'production' 
            ? 'If an account exists, you will receive password reset instructions'
            : 'Password reset email sent! Check your inbox.',
          // For development/testing, return token (remove in production)
          token: process.env.NODE_ENV === 'development' ? token : undefined,
        },
        { status: 200 }
      )
    }

    // Case 2: Reset password with token
    if (email && resetToken && newPassword) {
      console.log(`[forgot-password] Reset attempt for email: ${email}`)
      console.log(`[forgot-password] Token received (length ${resetToken.length}): ${resetToken}`)
      
      const user = await User.findOne({ email })
      if (!user) {
        console.log(`[forgot-password] User not found: ${email}`)
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }

      console.log(`[forgot-password] User found: ${email}`)
      console.log(`[forgot-password] Stored token (length ${user.resetToken?.length || 0}): ${user.resetToken}`)
      console.log(`[forgot-password] Token expiry: ${user.resetTokenExpiry}`)
      console.log(`[forgot-password] Current time: ${new Date()}`)
      console.log(`[forgot-password] Tokens match: ${user.resetToken === resetToken}`)

      // Verify reset token exists
      if (!user.resetToken || !user.resetTokenExpiry) {
        console.log(`[forgot-password] No reset token found for user`)
        return NextResponse.json(
          { success: false, error: 'No password reset request found. Please request a new reset link.' },
          { status: 400 }
        )
      }

      // Check if token has expired first
      if (new Date() > user.resetTokenExpiry) {
        console.log(`[forgot-password] Token expired`)
        return NextResponse.json(
          { success: false, error: 'Reset token has expired. Please request a new reset link.' },
          { status: 400 }
        )
      }

      // Verify reset token matches (case-sensitive)
      if (user.resetToken !== resetToken) {
        console.log(`[forgot-password] Token mismatch`)
        return NextResponse.json(
          { success: false, error: 'Invalid reset token. Please check the link in your email or request a new one.' },
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
