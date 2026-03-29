import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import crypto from 'crypto'
import { emailService } from '@/lib/email'
import { User } from '@/lib/models/User'
import { hashPassword } from '@/lib/password'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(request, {
      key: 'auth-forgot-password',
      maxRequests: 6,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

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

      console.log(`[forgot-password] Generating password reset token for: ${email}`)

      // Generate NEW reset token (always fresh)
      const token = crypto.randomBytes(32).toString('hex')
      const tokenExpiry = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

      // Clear old token and set new one
      user.resetToken = token
      user.resetTokenExpiry = tokenExpiry
      user.updatedAt = new Date()
      await user.save()

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
      
      const user = await User.findOne({ email })
      if (!user) {
        console.log(`[forgot-password] User not found: ${email}`)
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }

      console.log(`[forgot-password] User found: ${email}`)

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
