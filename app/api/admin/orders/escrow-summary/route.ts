import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { requireAdminAccess } from '@/lib/server-route-auth'

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()

    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)

    const [waitingReleaseCount, remindersSentTodayCount, releasedTodayCount] = await Promise.all([
      Order.countDocuments({
        paymentStatus: 'escrow',
        $or: [
          { disputeStatus: { $exists: false } },
          { disputeStatus: null },
          { disputeStatus: { $ne: 'active' } },
        ],
      }),
      Order.countDocuments({
        escrowReminderSentAt: { $gte: startOfDay },
      }),
      Order.countDocuments({
        paymentStatus: 'released',
        releasedAt: { $gte: startOfDay },
      }),
    ])

    return NextResponse.json({
      success: true,
      summary: {
        waitingReleaseCount,
        remindersSentTodayCount,
        releasedTodayCount,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch escrow summary' },
      { status: 500 }
    )
  }
}
