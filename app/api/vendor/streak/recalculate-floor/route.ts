import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { VendorStreak } from '@/lib/models/VendorStreak'
import { calculateStreakFloor } from '@/lib/streak/calculateFloor'

// Internal route — called after a vendor creates their first product when isDefaultFloor is true.
// Not exposed in vendor UI; called directly from the product creation route.
export async function POST(request: NextRequest) {
  try {
    const { vendorId } = await request.json()
    if (!vendorId) return NextResponse.json({ success: false, error: 'Missing vendorId' }, { status: 400 })

    await connectToDatabase()

    const doc = await VendorStreak.findOne({ vendorId }).lean() as any
    if (!doc || !doc.isDefaultFloor) {
      return NextResponse.json({ success: true, skipped: true })
    }

    const floor = await calculateStreakFloor(vendorId)
    if (floor.isDefaultFloor) {
      return NextResponse.json({ success: true, skipped: true, reason: 'still no active products' })
    }

    // If vendor already set a target below the new real floor, flag for admin review
    const needsTargetReview = doc.hasSetTarget && doc.targetOrderCount < floor.floorOrderCount

    await VendorStreak.updateOne(
      { vendorId },
      {
        $set: {
          floorOrderCount: floor.floorOrderCount,
          lowestProductPriceAtLock: floor.lowestPrice,
          isDefaultFloor: false,
          ...(needsTargetReview ? { needsTargetReview: true } : {}),
          updatedAt: new Date(),
        },
      }
    )

    return NextResponse.json({ success: true, updated: true, newFloor: floor.floorOrderCount, needsTargetReview })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Unknown error' }, { status: 500 })
  }
}
