import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { AdminSetting } from '@/lib/models/AdminSetting'
import { requireAdminAccess } from '@/lib/server-route-auth'
import {
  PHONE_VERIFICATION_SETTINGS_KEY,
  getPhoneVerificationTestEmail,
  sanitizePhoneVerificationSettings,
} from '@/lib/phone-verification-settings'

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()

    const existing = await AdminSetting.findOne({ key: PHONE_VERIFICATION_SETTINGS_KEY }).lean()
    const settings = sanitizePhoneVerificationSettings(existing?.value)

    return NextResponse.json({
      success: true,
      settings,
      testEmail: getPhoneVerificationTestEmail(),
    })
  } catch (error: any) {
    console.error('[admin/phone-verification-settings][GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const settings = sanitizePhoneVerificationSettings(body)

    await connectToDatabase()

    await AdminSetting.findOneAndUpdate(
      { key: PHONE_VERIFICATION_SETTINGS_KEY },
      {
        key: PHONE_VERIFICATION_SETTINGS_KEY,
        value: settings,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    return NextResponse.json({
      success: true,
      settings,
      testEmail: getPhoneVerificationTestEmail(),
    })
  } catch (error: any) {
    console.error('[admin/phone-verification-settings][POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save settings' }, { status: 500 })
  }
}
