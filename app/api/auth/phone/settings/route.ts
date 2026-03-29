import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { isPhoneVerificationEnabledForEmail } from '@/lib/phone-verification-settings'

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const enabledForCurrentUser = await isPhoneVerificationEnabledForEmail(sessionUser.email)

    return NextResponse.json({
      success: true,
      enabledForCurrentUser,
    })
  } catch (error: any) {
    console.error('[auth/phone/settings][GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
