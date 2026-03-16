import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/server-route-auth'

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  return NextResponse.json(
    {
      success: false,
      deprecated: true,
      message: 'Subscription administration is deprecated. Vendor accounts are free.'
    },
    { status: 410 }
  )
}