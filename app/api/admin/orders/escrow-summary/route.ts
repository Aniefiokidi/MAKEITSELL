import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { requireAdminAccess } from '@/lib/server-route-auth'

const NINETY_SIX_HOURS_MS = 96 * 60 * 60 * 1000

// Base filter: in escrow, not actively disputed, not already terminal
const activeEscrowFilter = {
  paymentStatus: 'escrow',
  status: { $nin: ['cancelled', 'refunded', 'completed', 'received'] },
  disputeRaisedAt: { $exists: false },
  $or: [
    { disputeStatus: { $exists: false } },
    { disputeStatus: null },
    { disputeStatus: { $nin: ['active'] } },
  ],
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()

    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)

    const autoRefundCutoff = new Date(Date.now() - NINETY_SIX_HOURS_MS)

    const [
      waitingReleaseOrders,
      remindersSentTodayCount,
      releasedTodayCount,
      autoRefundDueCount,
    ] = await Promise.all([
      // All active escrow orders (for count + total value)
      Order.find(activeEscrowFilter).select('totalAmount').lean(),

      // Reminders sent today
      Order.countDocuments({
        escrowReminderSentAt: { $gte: startOfDay },
      }),

      // Released today (escrow properly released)
      Order.countDocuments({
        paymentStatus: 'released',
        releasedAt: { $gte: startOfDay },
      }),

      // Past 96h threshold — overdue for auto-refund
      Order.countDocuments({
        ...activeEscrowFilter,
        status: { $nin: ['cancelled', 'refunded', 'completed', 'received', 'delivered'] },
        paidAt: { $lte: autoRefundCutoff },
      }),
    ])

    const waitingReleaseCount = waitingReleaseOrders.length
    const escrowTotalValue = (waitingReleaseOrders as any[]).reduce(
      (sum, o) => sum + Number(o.totalAmount || 0),
      0
    )

    return NextResponse.json({
      success: true,
      summary: {
        waitingReleaseCount,
        escrowTotalValue,
        remindersSentTodayCount,
        releasedTodayCount,
        autoRefundDueCount,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch escrow summary' },
      { status: 500 }
    )
  }
}
