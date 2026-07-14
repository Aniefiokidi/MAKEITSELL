import { NextRequest, NextResponse } from 'next/server'
import { serialize } from 'cookie'
import { signUp } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'

const isValidContactPhone = (phoneInput: string) => {
  const raw = String(phoneInput || '').trim()
  if (!raw) return false
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return false
  if (/^(\d)\1+$/.test(digits)) return false
  if (digits === '0000000000') return false
  return true
}

const VALID_REGIONS = new Set(['lagos', 'abuja'])
const VALID_VEHICLE_TYPES = new Set(['bike', 'keke', 'car', 'van'])

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(request, {
      key: 'riders-register',
      maxRequests: 6,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const { email, password, name, phone, region, vehicleType } = await request.json()

    const normalizedPhone = String(phone || '').trim()
    if (!normalizedPhone || !isValidContactPhone(normalizedPhone)) {
      return NextResponse.json({ success: false, error: 'Enter a valid phone number (10-15 digits)' }, { status: 400 })
    }

    const normalizedRegion = String(region || '').trim().toLowerCase()
    if (!VALID_REGIONS.has(normalizedRegion)) {
      return NextResponse.json({ success: false, error: 'Select a valid region (Lagos or Abuja)' }, { status: 400 })
    }

    const normalizedVehicleType = VALID_VEHICLE_TYPES.has(String(vehicleType || '').trim().toLowerCase())
      ? String(vehicleType).trim().toLowerCase()
      : 'bike'

    if (!name || String(name).trim().length < 2) {
      return NextResponse.json({ success: false, error: 'Enter your full name' }, { status: 400 })
    }

    const result = await signUp({
      email,
      password,
      name,
      phone: normalizedPhone,
      verificationChannel: 'email',
      role: 'rider',
      riderInfo: {
        region: normalizedRegion,
        vehicleType: normalizedVehicleType,
        isActive: true,
      },
    })

    if (result.success && result.sessionToken) {
      const cookie = serialize('sessionToken', result.sessionToken, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
      const safePayload = {
        ...result,
        sessionToken: undefined,
      }
      return new NextResponse(JSON.stringify(safePayload), {
        status: 200,
        headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
      })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    if (error?.message === 'VERIFICATION_EMAIL_SEND_FAILED') {
      return NextResponse.json({
        success: false,
        error: 'We created your account, but we could not deliver your verification code right now. Please try again from the verification page.',
        code: 'VERIFICATION_EMAIL_SEND_FAILED',
      }, { status: 502 })
    }

    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to create rider account',
    }, { status: 400 })
  }
}
