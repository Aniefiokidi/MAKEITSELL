import { NextRequest, NextResponse } from 'next/server'
import { syncStreakFloor } from '@/lib/streak/calculateFloor'
import { requireAdminAccess } from '@/lib/server-route-auth'

// Manual/admin trigger for the same ratchet-up-only floor sync that now also runs
// automatically after product create/edit/bulk-update (see lib/streak/calculateFloor.ts).
// Kept as a standalone endpoint for ad-hoc re-checks; not required for normal operation.
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const { vendorId } = await request.json()
    if (!vendorId) return NextResponse.json({ success: false, error: 'Missing vendorId' }, { status: 400 })

    const result = await syncStreakFloor(String(vendorId))
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Unknown error' }, { status: 500 })
  }
}
