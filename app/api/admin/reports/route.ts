import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, getAllOrders } from '@/lib/mongodb-operations'

const MONTHLY_VENDOR_FEE = 2500
const VAT_RATE = 0.075 // Adjust if your VAT rate differs

function monthsActive(start: Date, end: Date): number {
  const s = new Date(start)
  const e = new Date(end)
  const years = e.getFullYear() - s.getFullYear()
  const months = e.getMonth() - s.getMonth()
  const total = years * 12 + months
  return Math.max(total + 1, 1) // count the starting month
}

export async function GET(_req: NextRequest) {
  try {
    const [users, orders] = await Promise.all([
      getAllUsers(),
      getAllOrders(),
    ])

    const vendorUsers = users.filter((u: any) => u.role === 'vendor')
    const vendorCount = vendorUsers.length

    // Current monthly recurring revenue from vendor fee
    const monthlyVendorFee = vendorCount * MONTHLY_VENDOR_FEE

    // Lifetime vendor fee revenue (based on months active since createdAt)
    const now = new Date()
    const lifetimeVendorFee = vendorUsers.reduce((sum: number, v: any) => {
      const createdAt = v.createdAt ? new Date(v.createdAt) : now
      const months = monthsActive(createdAt, now)
      return sum + months * MONTHLY_VENDOR_FEE
    }, 0)

    // Order revenue and VAT
    const totalOrderRevenue = orders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0)
    const totalVAT = orders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0) * VAT_RATE, 0)

    return NextResponse.json({
      success: true,
      data: {
        vendorCount,
        monthlyVendorFee,
        lifetimeVendorFee,
        totalOrderRevenue,
        totalVAT,
        vatRate: VAT_RATE,
        monthlyVendorFeeRate: MONTHLY_VENDOR_FEE,
      }
    })
  } catch (error: any) {
    console.error('[admin/reports] Error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Unknown error' }, { status: 500 })
  }
}
