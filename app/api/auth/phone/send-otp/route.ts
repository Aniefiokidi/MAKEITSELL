import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { normalizeNigerianPhone, sendOtpSms } from '@/lib/sms'

const RESEND_COOLDOWN_SECONDS = 60
const OTP_EXPIRY_MINUTES = 5
const ATTEMPT_RESET_HOURS = 4

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(request, {
      key: 'auth-phone-send-otp',
      maxRequests: 6,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const body = await request.json()
    const user = await User.findById(sessionUser.id)
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const phoneInput =
      body?.phoneNumber ||
      (user as any)?.phone_number ||
      (user as any)?.phone ||
      (user as any)?.phoneNumber ||
      (user as any)?.vendorInfo?.phone ||
      (user as any)?.vendorInfo?.phone_number
    const normalizedPhone = normalizeNigerianPhone(phoneInput)

    if (!normalizedPhone) {
      return NextResponse.json({ success: false, error: 'Enter a valid phone number with country code.' }, { status: 400 })
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

    const lastSentAt = (user as any).otp_last_sent_at ? new Date((user as any).otp_last_sent_at) : null
    if (lastSentAt) {
      const elapsedSeconds = Math.floor((Date.now() - lastSentAt.getTime()) / 1000)
      if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
        return NextResponse.json(
          {
            success: false,
            error: 'Please wait before requesting another OTP.',
            retryAfter: RESEND_COOLDOWN_SECONDS - elapsedSeconds,
          },
          { status: 429 }
        )
      }
    }

    const otpCode = generateOtpCode()
    const smsResult = await sendOtpSms(normalizedPhone, otpCode)

    if (!smsResult.ok) {
      const rawMessage = String(smsResult.errorMessage || '')
      const friendlyMessage = rawMessage.toLowerCase().includes('applicationsenderid not found')
        ? 'Termii sender name is not approved. Update TERMII_SENDER to a valid registered sender ID in your Termii dashboard.'
        : rawMessage || 'Failed to send OTP SMS.'

      console.error('[phone/send-otp] Termii error:', smsResult.payload || rawMessage)
      return NextResponse.json(
        { success: false, error: friendlyMessage },
        { status: 502 }
      )
    }

    ;(user as any).phone_number = normalizedPhone
    ;(user as any).phone = (user as any).phone || normalizedPhone
    ;(user as any).otp_code = otpCode
    ;(user as any).otp_expiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
    ;(user as any).otp_last_sent_at = now
    if (!(user as any).otp_attempts_reset_at) {
      ;(user as any).otp_attempts_reset_at = new Date(Date.now() + ATTEMPT_RESET_HOURS * 60 * 60 * 1000)
    }
    ;(user as any).updatedAt = now

    await user.save()

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully.',
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
      resendInSeconds: RESEND_COOLDOWN_SECONDS,
    })
  } catch (error: any) {
    console.error('[phone/send-otp] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
