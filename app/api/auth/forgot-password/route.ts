import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import crypto from 'crypto'
import { emailService } from '@/lib/email'
import { User } from '@/lib/models/User'
import { hashPassword } from '@/lib/password'
import { enforceRateLimit } from '@/lib/rate-limit'
import { normalizeNigerianPhone, sendCustomSms } from '@/lib/sms'

function generateResetCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

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
    const { email, resetCode, resetToken, newPassword } = body
    const codeInput = String(resetCode ?? resetToken ?? '').trim()

    // Case 1: Request password reset code
    if (email && !codeInput) {
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

      console.log(`[forgot-password] Generating password reset OTP for: ${email}`)

      const token = generateResetCode()
      const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000)

      // Clear old token and set new one
      user.resetToken = token
      user.resetTokenExpiry = tokenExpiry
      user.updatedAt = new Date()
      await user.save()

      console.log(`[forgot-password] OTP saved to database`)

      let emailSent = false
      let smsSent = false

      // Send password reset email
      try {
        // Ensure emailService has the method before calling
        if (typeof emailService.sendPasswordResetEmail === 'function') {
          emailSent = await emailService.sendPasswordResetEmail({
            email: user.email,
            name: user.name || 'User',
            resetCode: token
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
      }

      if (!emailSent) {
        const normalizedPhone = normalizeNigerianPhone(String((user as any).phone_number || (user as any).phone || ''))

        if (normalizedPhone) {
          try {
            const sms = await sendCustomSms({
              phoneNumber: normalizedPhone,
              message: `Your Make It Sell password reset code is ${token}. Expires in 10 minutes.`,
            })

            if (sms.ok) {
              smsSent = true
              console.log(`[forgot-password] Password reset code sent via SMS to: ${normalizedPhone}`)
            } else {
              console.error(`[forgot-password] SMS fallback failed for ${email}:`, sms.errorMessage)
            }
          } catch (smsError) {
            console.error(`[forgot-password] SMS fallback error for ${email}:`, smsError)
          }
        }

        if (!smsSent) {
          return NextResponse.json(
            {
              success: false,
              error: 'Could not send reset code right now. Please try again shortly.',
              details: emailService.getLastDeliveryError() || undefined,
            },
            { status: 502 }
          )
        }
      }

      return NextResponse.json(
        {
          success: true,
          channel: emailSent ? 'email' : 'sms',
          message: emailSent
            ? 'If an account exists, you will receive a password reset code'
            : 'If an account exists, you will receive a password reset code by SMS',
        },
        { status: 200 }
      )
    }

    // Case 2: Reset password with OTP code
    if (email && codeInput && newPassword) {
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

      // Verify reset code exists
      if (!user.resetToken || !user.resetTokenExpiry) {
        console.log(`[forgot-password] No reset token found for user`)
        return NextResponse.json(
          { success: false, error: 'No password reset request found. Please request a new code.' },
          { status: 400 }
        )
      }

      // Check if code has expired first
      if (new Date() > user.resetTokenExpiry) {
        console.log(`[forgot-password] Token expired`)
        return NextResponse.json(
          { success: false, error: 'Reset code has expired. Please request a new code.' },
          { status: 400 }
        )
      }

      // Verify reset code matches.
      if (user.resetToken !== codeInput) {
        console.log(`[forgot-password] Token mismatch`)
        return NextResponse.json(
          { success: false, error: 'Invalid reset code. Please check the code in your email or request a new one.' },
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
