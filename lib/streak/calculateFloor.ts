import connectToDatabase from '@/lib/mongodb'
import { Product } from '@/lib/models/Product'
import { VendorStreak } from '@/lib/models/VendorStreak'

const PLATFORM_AVERAGE_PRICE = 8500
const DEFAULT_FLOOR = 26
const MINIMUM_FLOOR = 4
export const GMV_FLOOR = 220000

export async function calculateStreakFloor(vendorId: string): Promise<{
  floorOrderCount: number
  lowestPrice: number
  isDefaultFloor: boolean
}> {
  await connectToDatabase()

  const products = await Product.find({ vendorId, status: 'active' })
    .select('price')
    .lean() as any[]

  if (!products.length) {
    return { floorOrderCount: DEFAULT_FLOOR, lowestPrice: PLATFORM_AVERAGE_PRICE, isDefaultFloor: true }
  }

  const prices = products.map((p: any) => Number(p.price || 0)).filter(p => p > 0)
  if (!prices.length) {
    return { floorOrderCount: DEFAULT_FLOOR, lowestPrice: PLATFORM_AVERAGE_PRICE, isDefaultFloor: true }
  }

  const lowestPrice = Math.min(...prices)
  const rawFloor = Math.ceil(GMV_FLOOR / lowestPrice)
  const floorOrderCount = Math.max(rawFloor, MINIMUM_FLOOR)

  return { floorOrderCount, lowestPrice, isDefaultFloor: false }
}

// Re-syncs a vendor's locked streak floor against their current catalog. Call this after
// any product mutation that could lower their lowest active price (create, price edit,
// bulk price update, reactivating a cheap product, etc.) — without it, a vendor could set
// their target while a pricier item was their cheapest, then drop prices afterward and
// keep the easier locked floor forever, since set-target only computes the floor once.
//
// Ratchets UP only, never down: a price increase (or deleting/deactivating a cheap
// product) never makes an already-locked floor easier. That would let a vendor
// game the floor in the other direction — lock in cheap, then briefly go pricey to
// "bank" a lower floor for later — by round-tripping their prices.
export async function syncStreakFloor(vendorId: string): Promise<{
  updated: boolean
  floorOrderCount?: number
  needsTargetReview?: boolean
}> {
  await connectToDatabase()

  const streakDoc = await VendorStreak.findOne({ vendorId }).lean() as any
  // No streak doc yet, or target never set — nothing locked in to protect. The vendor's
  // first set-target call will compute a fresh, accurate floor on its own.
  if (!streakDoc) return { updated: false }

  const floor = await calculateStreakFloor(vendorId)
  // No active products (or none priced) right now — leave whatever floor is on file;
  // a momentary empty catalog shouldn't erase an already-locked protective floor.
  if (floor.isDefaultFloor) return { updated: false }

  const currentFloor = Number(streakDoc.floorOrderCount || 0)
  const newFloor = Math.max(currentFloor, floor.floorOrderCount)

  if (newFloor === currentFloor && !streakDoc.isDefaultFloor) return { updated: false }

  // Their already-locked target no longer clears the real floor — surfaced for admin
  // visibility; doesn't retroactively change their target (there's no vendor-facing
  // "change target" flow), but evaluateMonthlyStreak's GMV floor check still applies
  // regardless, so this can't be used to under-pay the real GMV requirement.
  const needsTargetReview = Boolean(streakDoc.hasSetTarget) && Number(streakDoc.targetOrderCount || 0) < newFloor

  await VendorStreak.updateOne(
    { vendorId },
    {
      $set: {
        floorOrderCount: newFloor,
        lowestProductPriceAtLock: floor.lowestPrice,
        isDefaultFloor: false,
        ...(needsTargetReview ? { needsTargetReview: true } : {}),
        updatedAt: new Date(),
      },
    }
  )

  return { updated: true, floorOrderCount: newFloor, needsTargetReview }
}
