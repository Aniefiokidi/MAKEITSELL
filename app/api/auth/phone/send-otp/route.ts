import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { isPhoneVerificationEnabledForEmail } from '@/lib/phone-verification-settings'

const RESEND_COOLDOWN_SECONDS = 60
const OTP_EXPIRY_MINUTES = 5
const ATTEMPT_RESET_HOURS = 4

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

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

    const enabledForUser = await isPhoneVerificationEnabledForEmail(sessionUser.email)
    if (!enabledForUser) {
      return NextResponse.json({ success: false, error: 'Phone verification is not enabled for this account yet.' }, { status: 403 })
    }

    const body = await request.json()
    const normalizedPhone = normalizeNigerianPhone(body?.phoneNumber)

    if (!normalizedPhone) {
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

    const termiiApiKey = String(process.env.TERMII_API_KEY || '').trim()
    const termiiBaseUrl = String(process.env.TERMII_BASE_URL || 'https://api.ng.termii.com').replace(/\/$/, '')
    const termiiFrom = String(process.env.TERMII_SENDER || 'MakeItSell').trim()

    if (!termiiApiKey) {
      return NextResponse.json(
        { success: false, error: 'TERMII_API_KEY is not configured on the server.' },
        { status: 500 }
      )
    }

    const otpCode = generateOtpCode()

    const termiiResponse = await fetch(`${termiiBaseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: normalizedPhone,
        from: termiiFrom,
        sms: `Your Make It Sell OTP is ${otpCode}`,
        type: 'plain',
        channel: 'generic',
        api_key: termiiApiKey,
      }),
    })

    const termiiResult = await termiiResponse.json().catch(() => ({}))

    if (!termiiResponse.ok) {
      console.error('[phone/send-otp] Termii error:', termiiResult)
      return NextResponse.json(
        { success: false, error: termiiResult?.message || 'Failed to send OTP SMS.' },
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
