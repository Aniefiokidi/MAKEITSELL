import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/server-route-auth'
import connectToDatabase from '@/lib/mongodb'
import { VendorStreak } from '@/lib/models/VendorStreak'
import { User } from '@/lib/models/User'

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()

    const flagged = await VendorStreak.find({ needsTargetReview: true }).lean() as any[]
    const vendorIds = flagged.map((f) => f.vendorId).filter(Boolean)
    const vendors = vendorIds.length
      ? await User.find({ _id: { $in: vendorIds } }).select('name displayName email').lean()
      : []
    const vendorById = new Map(vendors.map((v: any) => [String(v._id), v]))

    const rows = flagged.map((f) => {
      const vendor = vendorById.get(String(f.vendorId)) as any
      return {
        vendorId: f.vendorId,
        vendorName: vendor?.name || vendor?.displayName || 'Unknown vendor',
        vendorEmail: vendor?.email || '',
        targetOrderCount: f.targetOrderCount,
        floorOrderCount: f.floorOrderCount,
        lowestProductPriceAtLock: f.lowestProductPriceAtLock,
        currentStreak: f.currentStreak,
        updatedAt: f.updatedAt,
      }
    })

    return NextResponse.json({ success: true, rows })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch streak flags', rows: [] },
      { status: 500 }
    )
  }
}

// Bumps the vendor's target up to match the current real floor (the actual fix — a
// stale target means their locked commitment no longer clears the GMV floor formula)
// and clears the flag. The monthly GMV backstop in evaluateMonthlyStreak still applies
// regardless, so this is about fairness/accuracy of the displayed target, not a safety
// gate on its own.
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const { vendorId, action } = await request.json()
    if (!vendorId) {
      return NextResponse.json({ success: false, error: 'vendorId is required' }, { status: 400 })
    }

    await connectToDatabase()
    const doc = await VendorStreak.findOne({ vendorId }).lean() as any
    if (!doc) {
      return NextResponse.json({ success: false, error: 'Streak record not found' }, { status: 404 })
    }

    if (action === 'fix-target') {
      await VendorStreak.updateOne(
        { vendorId },
        { $set: { targetOrderCount: doc.floorOrderCount, needsTargetReview: false, updatedAt: new Date() } }
      )
    } else if (action === 'dismiss') {
      await VendorStreak.updateOne(
        { vendorId },
        { $set: { needsTargetReview: false, updatedAt: new Date() } }
      )
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update streak flag' },
      { status: 500 }
    )
  }
}
