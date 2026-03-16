import { NextRequest, NextResponse } from 'next/server'

// Get or create the vendor subscription plan
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      deprecated: true,
      message: 'Vendor subscription plans are deprecated. Vendor registration is free.'
    },
    { status: 410 }
  )
}

// Create a new vendor subscription plan (one-time setup)
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      deprecated: true,
      message: 'Vendor subscription plans are deprecated. Vendor registration is free.'
    },
    { status: 410 }
  )
}
