import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import connectToDatabase from '@/lib/mongodb'
import { VendorStreak } from '@/lib/models/VendorStreak'
import { Order } from '@/lib/models/Order'

const SETTLED_STATUSES = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'received', 'completed']
const PRIZES: Record<number, number> = { 3: 15000, 6: 40000, 12: 150000 }

function getNextMilestone(streak: number): { monthsToGo: number; milestone: number; prize: number } | null {
  for (const m of [3, 6, 12]) {
    if (streak < m) return { monthsToGo: m - streak, milestone: m, prize: PRIZES[m] }
  }
  return null
}

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

    const streakDoc = await VendorStreak.findOne({ vendorId }).lean() as any
    if (!streakDoc?.hasSetTarget) {
      return NextResponse.json({ success: true, hasSetTarget: false })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const orderCount = await Order.countDocuments({
      'vendors.vendorId': vendorId,
      createdAt: { $gte: startOfMonth, $lt: endOfMonth },
      status: { $in: SETTLED_STATUSES },
    })

    const targetOrderCount = streakDoc.targetOrderCount
    const ordersRemaining = Math.max(0, targetOrderCount - orderCount)
    const currentStreak = streakDoc.currentStreak
    const nextMilestone = getNextMilestone(currentStreak)

    return NextResponse.json({
      success: true,
      hasSetTarget: true,
      targetOrderCount,
      actualOrderCountThisMonth: orderCount,
      ordersRemaining,
      currentStreak,
      longestStreak: streakDoc.longestStreak,
      nextMilestone,
      floorOrderCount: streakDoc.floorOrderCount,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Unknown error' }, { status: 500 })
  }
}
