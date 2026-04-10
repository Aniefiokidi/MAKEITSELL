import { NextRequest, NextResponse } from 'next/server'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

export async function GET(request: NextRequest) {
  const appUrl = getCanonicalAppBaseUrl(new URL(request.url).origin)
  return NextResponse.redirect(`${appUrl}/vendor/dashboard?message=vendor_accounts_are_free`)
}

// POST endpoint for webhook handling
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    deprecated: true,
    message: 'Vendor subscription webhook is deprecated because vendor accounts are free.'
  })
}