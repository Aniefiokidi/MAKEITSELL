
import { NextRequest, NextResponse } from 'next/server'
import { serialize } from 'cookie'
import { signUp } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}


const isValidContactPhone = (phoneInput: string) => {
  const raw = String(phoneInput || '').trim()
  if (!raw) return false
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return false
  if (/^(\d)\1+$/.test(digits)) return false
  if (digits === '0000000000') return false
  return true
}


export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(request, {
      key: 'auth-signup',
      maxRequests: 6,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const { email, password, name, role, vendorType, phone, verificationChannel, referralCode, referredByVendorId } = await request.json()
    const normalizedPhone = String(phone || '').trim()

    const isValidVendorType = vendorType === "goods" || vendorType === "services" || vendorType === "both"
    if (role === "vendor" && !isValidVendorType) {
      return NextResponse.json({
        success: false,
        error: 'Please choose what you want to offer: goods, services, or both'
      }, { status: 400 })
    }
    

    if (role === "vendor") {
      if (!normalizedPhone) {
        return NextResponse.json({ success: false, error: 'Phone number is required for vendor signup' }, { status: 400 })
      }
      if (!isValidContactPhone(normalizedPhone)) {
        return NextResponse.json({ success: false, error: 'Enter a valid vendor phone number (10-15 digits)' }, { status: 400 })
      }
    }
    const vendorInfo = role === "vendor" ? {
      businessName: name,
      businessType: vendorType
    } : undefined

    const result = await signUp({
      email,
      password,
      name,
      phone: normalizedPhone,
      verificationChannel,
      role: role === "admin" ? "customer" : role,
      vendorInfo
    })

    if (result.success) {
      // Apply referral attribution and generate referral code for vendors
      try {
        await connectToDatabase()
        const referralUpdates: Record<string, unknown> = {}

        if (role === 'vendor') {
          referralUpdates.referralCode = generateReferralCode()
        }

        if (referralCode && typeof referralCode === 'string' && referralCode.trim()) {
          const referringVendor = await User.findOne(
            { referralCode: referralCode.trim().toUpperCase() },
            { _id: 1 }
          ).lean() as any
          if (referringVendor) {
            referralUpdates.referredByVendorId = String(referringVendor._id)
          }
        } else if (referredByVendorId && typeof referredByVendorId === 'string' && referredByVendorId.trim()) {
          // Direct vendor ID from store-page visit — validate it's a real vendor
          const mongoose = (await import('mongoose')).default
          if (mongoose.Types.ObjectId.isValid(referredByVendorId.trim())) {
            const referringVendor = await User.findOne(
              { _id: referredByVendorId.trim(), role: 'vendor' },
              { _id: 1 }
            ).lean()
            if (referringVendor) {
              referralUpdates.referredByVendorId = referredByVendorId.trim()
            }
          }
        }

        if (Object.keys(referralUpdates).length > 0) {
          await User.updateOne(
            { email: (email as string).toLowerCase().trim() },
            { $set: { ...referralUpdates, updatedAt: new Date() } }
          )
        }
      } catch (refErr) {
        console.error('[signup] referral attribution failed:', refErr)
      }
    }

    if (result.success && result.sessionToken) {
      // Set HTTP-only cookie
      const cookie = serialize('sessionToken', result.sessionToken, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
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
        code: 'VERIFICATION_EMAIL_SEND_FAILED'
      }, { status: 502 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create account'
    }, { status: 400 })
  }
}