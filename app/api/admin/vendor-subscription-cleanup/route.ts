import { NextRequest, NextResponse } from 'next/server'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  return NextResponse.json({
    success: true,
    deprecated: true,
    message: 'Vendor subscription cleanup is disabled. Vendor accounts are free.'
  })
}
