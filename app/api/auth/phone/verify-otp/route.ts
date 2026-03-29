import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { isPhoneVerificationEnabledForEmail } from '@/lib/phone-verification-settings'

const ATTEMPT_RESET_HOURS = 4

function normalizeNigerianPhone(input: string): string | null {
  const raw = String(input || '').trim()
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')

  if (digits.startsWith('0') && digits.length === 11) {
    return `+234${digits.slice(1)}`
  }

  if (digits.startsWith('234') && digits.length === 13) {
    return `+${digits}`
  }

  if (raw.startsWith('+234') && digits.length === 13) {
    return `+${digits}`
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(request, {
      key: 'auth-phone-verify-otp',
      maxRequests: 10,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const enabledForUser = await isPhoneVerificationEnabledForEmail(sessionUser.email)
    if (!enabledForUser) {
      return NextResponse.json({ success: false, error: 'Phone verification is not enabled for this account yet.' }, { status: 403 })
    }

    const body = await request.json()
    const otpCode = String(body?.otp || '').trim()
    const normalizedPhone = body?.phoneNumber ? normalizeNigerianPhone(body.phoneNumber) : null

    if (!/^\d{6}$/.test(otpCode)) {
      return NextResponse.json({ success: false, error: 'OTP must be exactly 6 digits.' }, { status: 400 })
    }

    if (body?.phoneNumber && !normalizedPhone) {
      return NextResponse.json({ success: false, error: 'Enter a valid Nigerian phone number.' }, { status: 400 })
    }

    const user = await User.findById(sessionUser.id)
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const now = new Date()

    if ((user as any).otp_attempts_reset_at && now > new Date((user as any).otp_attempts_reset_at)) {
      ;(user as any).otp_attempts = 0
      ;(user as any).otp_attempts_reset_at = undefined
    }

    if (((user as any).otp_attempts || 0) >= 3 && (user as any).otp_attempts_reset_at) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many verification attempts. Try again later.',
          blockedUntil: new Date((user as any).otp_attempts_reset_at).toISOString(),
        },
        { status: 429 }
      )
    }

    const savedOtp = String((user as any).otp_code || '')
    const otpExpiry = (user as any).otp_expiry ? new Date((user as any).otp_expiry) : null

    if (!savedOtp || !otpExpiry) {
      return NextResponse.json(
        { success: false, error: 'No OTP found. Please request a new one.' },
        { status: 400 }
      )
    }

    if (now > otpExpiry) {
      ;(user as any).otp_code = undefined
      ;(user as any).otp_expiry = undefined
      ;(user as any).updatedAt = now
      await user.save()

      return NextResponse.json(
        { success: false, error: 'OTP has expired. Please request a new code.' },
        { status: 400 }
      )
    }

    if (savedOtp !== otpCode) {
      const currentAttempts = (user as any).otp_attempts || 0
      ;(user as any).otp_attempts = currentAttempts + 1
      ;(user as any).otp_attempts_reset_at = (user as any).otp_attempts_reset_at || new Date(Date.now() + ATTEMPT_RESET_HOURS * 60 * 60 * 1000)
      ;(user as any).updatedAt = now
      await user.save()

      if ((user as any).otp_attempts >= 3) {
        return NextResponse.json(
          {
            success: false,
            error: 'Maximum verification attempts reached. Try again after 4 hours.',
            blockedUntil: new Date((user as any).otp_attempts_reset_at).toISOString(),
          },
          { status: 429 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid OTP code.',
          attemptsLeft: Math.max(0, 3 - (user as any).otp_attempts),
        },
        { status: 400 }
      )
    }

    ;(user as any).phone_verified = true
    ;(user as any).phone_number = normalizedPhone || (user as any).phone_number
    ;(user as any).phone = (user as any).phone || (normalizedPhone || (user as any).phone_number)
    ;(user as any).otp_code = undefined
    ;(user as any).otp_expiry = undefined
    ;(user as any).otp_last_sent_at = undefined
    ;(user as any).otp_attempts = 0
    ;(user as any).otp_attempts_reset_at = undefined
    ;(user as any).updatedAt = now

    await user.save()

    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully.',
      phoneNumber: (user as any).phone_number,
    })
  } catch (error: any) {
    console.error('[phone/verify-otp] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
