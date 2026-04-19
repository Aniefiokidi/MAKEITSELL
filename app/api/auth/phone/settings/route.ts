import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      enabledForCurrentUser: false,
      reason: 'Phone verification is disabled. Email verification is used for all accounts.',
    })
  } catch (error: any) {
    console.error('[auth/phone/settings][GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
