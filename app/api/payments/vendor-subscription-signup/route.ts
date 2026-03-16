import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      deprecated: true,
      message: 'Vendor signup no longer requires a subscription payment. Please complete free signup directly.'
    },
    { status: 410 }
  )
}