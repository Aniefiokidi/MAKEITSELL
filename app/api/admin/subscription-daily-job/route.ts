import { NextRequest, NextResponse } from 'next/server'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  return NextResponse.json({
    success: true,
    deprecated: true,
    message: 'Daily subscription management is disabled. Vendor accounts are free.'
  })
}

// Manual trigger endpoint (for testing)
export async function GET(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  return NextResponse.json({
    success: true,
    deprecated: true,
    message: 'Manual subscription management is disabled. Vendor accounts are free.'
  })
}