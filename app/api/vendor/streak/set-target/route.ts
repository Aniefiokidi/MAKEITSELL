import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import connectToDatabase from '@/lib/mongodb'
import { VendorStreak } from '@/lib/models/VendorStreak'
import { calculateStreakFloor, syncStreakFloor } from '@/lib/streak/calculateFloor'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'vendor') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const target = Number(body.targetOrderCount)
    if (!Number.isFinite(target) || target < 1) {
      return NextResponse.json({ success: false, error: 'Invalid target' }, { status: 400 })
    }

    const vendorId = String(user.id)
    await connectToDatabase()

    // If target already set, the floor is normally preserved — but re-sync it first
    // (ratchets up only) so a target change can't reuse a floor that's gone stale
    // against price drops since it was originally locked.
    let existing = await VendorStreak.findOne({ vendorId }).lean() as any
    let floorOrderCount: number
    let lowestProductPriceAtLock: number
    let isDefaultFloor: boolean
    let floorLockedAt: Date

    if (existing?.hasSetTarget) {
      await syncStreakFloor(vendorId)
      existing = await VendorStreak.findOne({ vendorId }).lean() as any
      floorOrderCount = existing.floorOrderCount
      lowestProductPriceAtLock = existing.lowestProductPriceAtLock
      isDefaultFloor = existing.isDefaultFloor
      floorLockedAt = existing.floorLockedAt
    } else {
      const floor = await calculateStreakFloor(vendorId)
      floorOrderCount = floor.floorOrderCount
      lowestProductPriceAtLock = floor.lowestPrice
      isDefaultFloor = floor.isDefaultFloor
      floorLockedAt = new Date()
    }

    if (target < floorOrderCount) {
      return NextResponse.json({
        success: false,
        error: `Your minimum target is ${floorOrderCount} orders based on your lowest-priced product.`,
        floorOrderCount,
      }, { status: 400 })
    }

    const doc = await VendorStreak.findOneAndUpdate(
      { vendorId },
      {
        $set: {
          vendorId,
          targetOrderCount: target,
          floorOrderCount,
          floorLockedAt,
          lowestProductPriceAtLock,
          isDefaultFloor,
          hasSetTarget: true,
        },
        $setOnInsert: {
          currentStreak: 0,
          longestStreak: 0,
          monthlyRecords: [],
          streakPrizesPaid: [],
        },
      },
      { upsert: true, new: true }
    ).lean()

    return NextResponse.json({ success: true, doc })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Unknown error' }, { status: 500 })
  }
}
