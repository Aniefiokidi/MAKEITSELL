import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { MonthlyChampion } from '@/lib/models/MonthlyChampion'

const SETTLED_STATUSES = [
  'confirmed', 'processing', 'shipped', 'out_for_delivery',
  'delivered', 'received', 'completed',
]

export async function GET(_request: NextRequest) {
  try {
    await connectToDatabase()

    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    // Last month for fallback and champion badge
    const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth()
    const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const lastMonthStart = new Date(lastYear, lastMonth - 1, 1)
    const lastMonthEnd = new Date(lastYear, lastMonth, 1)

    // Last month champion (for badge)
    const lastChampion = await MonthlyChampion.findOne({ month: lastMonth, year: lastYear })
      .select('vendorId')
      .lean() as any

    const lastChampionVendorId = String(lastChampion?.vendorId || '')

    // Try current month first
    let orders = await Order.find({
      status: { $in: SETTLED_STATUSES },
      createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd },
    })
      .select('vendors')
      .lean() as any[]

    let isLastMonth = false

    // If no current-month sales yet, fall back to last month
    if (orders.length === 0) {
      orders = await Order.find({
        status: { $in: SETTLED_STATUSES },
        createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd },
      })
        .select('vendors')
        .lean() as any[]
      isLastMonth = true
    }

    // Aggregate GMV per vendor
    const gmvMap: Record<string, number> = {}
    for (const order of orders) {
      for (const v of Array.isArray(order.vendors) ? order.vendors : []) {
        const vid = String(v.vendorId || '').trim()
        if (!vid) continue
        gmvMap[vid] = (gmvMap[vid] || 0) + Number(v.total || 0)
      }
    }

    const sorted = Object.entries(gmvMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)

    if (sorted.length === 0) {
      return NextResponse.json(
        { success: true, data: [], isLastMonth: false },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
      )
    }

    const vendorIds = sorted.map(([id]) => id)
    const vendors = await User.find({ _id: { $in: vendorIds } })
      .select('vendorInfo name displayName')
      .lean() as any[]

    const vendorMap: Record<string, any> = {}
    for (const v of vendors) {
      vendorMap[String(v._id)] = v
    }

    const data = sorted.map(([vendorId], index) => {
      const user = vendorMap[vendorId]
      const storeName = String(
        user?.vendorInfo?.businessName || user?.name || user?.displayName || 'Store'
      ).trim()
      const category = String(user?.vendorInfo?.businessType || 'general').trim()

      return {
        rank: index + 1,
        storeName,
        category,
        vendorId,
        isLastChampion: vendorId === lastChampionVendorId,
      }
    })

    return NextResponse.json(
      { success: true, data, isLastMonth },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  } catch (error: any) {
    console.error('[leaderboard] failed:', error)
    return NextResponse.json(
      { success: false, data: [], isLastMonth: false },
      { status: 500 }
    )
  }
}
