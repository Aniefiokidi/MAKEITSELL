import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      deprecated: true,
      message: 'Vendor subscriptions are no longer required. Vendor accounts are free.'
    },
    { status: 410 }
  )
}

// GET endpoint to redirect to payment
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  return NextResponse.redirect(`${appUrl}/vendor/dashboard?message=vendor_accounts_are_free`)
}