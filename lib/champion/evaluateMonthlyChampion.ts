import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { MonthlyChampion } from '@/lib/models/MonthlyChampion'
import { pushToUser } from '@/lib/push-notifications'
import { sendCustomSms } from '@/lib/sms'

const SETTLED_STATUSES = [
  'confirmed', 'processing', 'shipped', 'out_for_delivery',
  'delivered', 'received', 'completed',
]
const CHAMPION_PRIZE = 40000
const MIN_ORDERS_TO_QUALIFY = 10
const MAX_DISPUTE_RATE = 0.20

export async function evaluateMonthlyChampion(): Promise<{
  skipped: boolean
  reason?: string
  winnerId?: string
  winnerStoreName?: string
  winningGMV?: number
}> {
  await connectToDatabase()

  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  // Idempotency — only run once per month
  const existing = await MonthlyChampion.findOne({ month: prevMonth, year: prevYear }).lean()
  if (existing) {
    return { skipped: true, reason: 'already_evaluated' }
  }

  const startDate = new Date(prevYear, prevMonth - 1, 1)
  const endDate = new Date(prevYear, prevMonth, 1)

  // Aggregate GMV and order count per vendor for last month's settled orders
  const vendorStats: Record<string, { gmv: number; orderCount: number; disputedCount: number }> = {}

  const orders = await Order.find({
    status: { $in: SETTLED_STATUSES },
    createdAt: { $gte: startDate, $lt: endDate },
  })
    .select('vendors customerId disputeStatus disputeRaisedAt')
    .lean() as any[]

  for (const order of orders) {
    const isDisputed =
      order.disputeRaisedAt ||
      String(order.disputeStatus || '').toLowerCase() === 'active'

    for (const v of Array.isArray(order.vendors) ? order.vendors : []) {
      const vid = String(v.vendorId || '').trim()
      if (!vid) continue

      if (!vendorStats[vid]) {
        vendorStats[vid] = { gmv: 0, orderCount: 0, disputedCount: 0 }
      }
      vendorStats[vid].orderCount++
      vendorStats[vid].gmv += Number(v.total || 0)
      if (isDisputed) vendorStats[vid].disputedCount++
    }
  }

  // Filter eligible vendors
  const eligible = Object.entries(vendorStats).filter(([, stats]) => {
    if (stats.orderCount < MIN_ORDERS_TO_QUALIFY) return false
    const disputeRate = stats.orderCount > 0 ? stats.disputedCount / stats.orderCount : 0
    if (disputeRate > MAX_DISPUTE_RATE) return false
    return true
  })

  if (eligible.length === 0) {
    return { skipped: true, reason: 'no_eligible_vendors' }
  }

  // Sort: highest GMV first, then highest order count, then lowest dispute rate
  eligible.sort(([, a], [, b]) => {
    if (b.gmv !== a.gmv) return b.gmv - a.gmv
    if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount
    const dispRateA = a.orderCount > 0 ? a.disputedCount / a.orderCount : 0
    const dispRateB = b.orderCount > 0 ? b.disputedCount / b.orderCount : 0
    return dispRateA - dispRateB
  })

  // Check top vendor is not suspended
  let winnerEntry: [string, typeof vendorStats[string]] | null = null
  for (const entry of eligible) {
    const [vendorId] = entry
    const vendor = await User.findById(vendorId).select('vendorInfo name displayName').lean() as any
    if (!vendor) continue
    // Skip suspended vendors — check vendorInfo.suspended flag
    if (vendor?.vendorInfo?.suspended === true) continue
    winnerEntry = entry
    break
  }

  if (!winnerEntry) {
    return { skipped: true, reason: 'all_eligible_vendors_suspended' }
  }

  const [winnerId, winnerStats] = winnerEntry
  const winner = await User.findById(winnerId).select('vendorInfo name displayName phone phone_number').lean() as any
  const storeName = String(winner?.vendorInfo?.businessName || winner?.name || winner?.displayName || 'Vendor').trim()
  const winnerName = String(winner?.name || winner?.displayName || 'Vendor').trim()

  // Credit prize
  const reference = `CHAMPION-PRIZE-${prevYear}-${prevMonth}-${winnerId}`

  const tx = await WalletTransaction.updateOne(
    { reference },
    {
      $setOnInsert: {
        userId: winnerId,
        type: 'champion_prize',
        amount: CHAMPION_PRIZE,
        status: 'completed',
        reference,
        provider: 'champion_programme',
        note: `Monthly Champion prize — ${monthName(prevMonth)} ${prevYear}`,
        metadata: {
          subType: 'monthly_champion',
          month: prevMonth,
          year: prevYear,
          winningGMV: winnerStats.gmv,
          orderCount: winnerStats.orderCount,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  )

  if ((tx as any).upsertedCount > 0) {
    await User.updateOne(
      { _id: winnerId },
      { $inc: { walletBalance: CHAMPION_PRIZE, prizeBalance: CHAMPION_PRIZE }, $set: { updatedAt: new Date() } }
    )
  }

  // Record the champion
  await MonthlyChampion.create({
    month: prevMonth,
    year: prevYear,
    vendorId: winnerId,
    vendorName: winnerName,
    storeName,
    winningGMV: winnerStats.gmv,
    prizeAmount: CHAMPION_PRIZE,
    creditedAt: new Date(),
    acknowledged: false,
  })

  // Notify winner
  const msg =
    `Congratulations ${winnerName}. You are Make It Sell's Champion for ${monthName(prevMonth)} ${prevYear}. ` +
    `₦40,000 has been added to your wallet. Withdraw anytime with no fee.`

  void pushToUser(winnerId, {
    title: 'You are Make It Sell Champion!',
    body: msg,
    url: '/vendor/dashboard',
    tag: `champion-${prevYear}-${prevMonth}`,
  })

  try {
    const phone = String(winner?.phone || winner?.phone_number || '').trim()
    if (phone) await sendCustomSms({ phoneNumber: phone, message: msg })
  } catch {
    // SMS is best-effort
  }

  return {
    skipped: false,
    winnerId,
    winnerStoreName: storeName,
    winningGMV: winnerStats.gmv,
  }
}

function monthName(month: number): string {
  return [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][month] || String(month)
}
