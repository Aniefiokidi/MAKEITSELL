import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  return NextResponse.redirect(`${appUrl}/signup?message=vendor_signup_is_free`)
}

// POST endpoint for webhook handling
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    deprecated: true,
    message: 'Vendor signup subscription webhook is deprecated because vendor signup is free.'
  })
}