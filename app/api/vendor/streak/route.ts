import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import connectToDatabase from '@/lib/mongodb'
import { VendorStreak } from '@/lib/models/VendorStreak'
import { calculateStreakFloor } from '@/lib/streak/calculateFloor'

export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'vendor' && user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const vendorId = String(user.id)
    await connectToDatabase()

    const doc = await VendorStreak.findOne({ vendorId }).lean() as any
    if (!doc) {
      const floor = await calculateStreakFloor(vendorId)
      return NextResponse.json({
        success: true,
        hasSetTarget: false,
        floorOrderCount: floor.floorOrderCount,
        lowestPrice: floor.lowestPrice,
        isDefaultFloor: floor.isDefaultFloor,
      })
    }

    return NextResponse.json({ success: true, ...doc })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Unknown error' }, { status: 500 })
  }
}
