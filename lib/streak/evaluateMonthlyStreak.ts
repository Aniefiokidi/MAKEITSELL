import connectToDatabase from '@/lib/mongodb'
import { VendorStreak } from '@/lib/models/VendorStreak'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { pushToUser } from '@/lib/push-notifications'
import { sendCustomSms } from '@/lib/sms'
import crypto from 'crypto'

const SETTLED_STATUSES = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'received', 'completed']
const PLATFORM_FEE_RATE = 0.075
const PRIZES: Record<number, number> = { 3: 15000, 6: 40000, 12: 150000 }

async function creditStreakPrize(vendorId: string, milestone: number, amount: number) {
  const reference = `STREAK-PRIZE-${vendorId}-${milestone}M-${Date.now()}`

  const tx = await WalletTransaction.updateOne(
    { reference },
    {
      $setOnInsert: {
        userId: vendorId,
        type: 'vendor_credit',
        amount,
        status: 'completed',
        reference,
        provider: 'streak_programme',
        note: `Streak prize — ${milestone}-month streak achieved`,
        metadata: { subType: 'streak_prize', milestone },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  )

  if ((tx as any).upsertedCount > 0) {
    await User.updateOne(
      { _id: vendorId },
      { $inc: { walletBalance: amount }, $set: { updatedAt: new Date() } }
    )
  }
}

async function sendStreakNotification(vendorId: string, message: string) {
  void pushToUser(vendorId, {
    title: 'MakeItSell Streak',
    body: message,
    url: '/vendor/dashboard',
    tag: `streak-${vendorId}-${Date.now()}`,
  })

  try {
    const vendorUser = await User.findById(vendorId).select('phone phone_number').lean() as any
    const phone = String(vendorUser?.phone || vendorUser?.phone_number || '').trim()
    if (phone) {
      await sendCustomSms({ phoneNumber: phone, message })
    }
  } catch {
    // SMS is best-effort; don't fail the evaluation
  }
}

export async function evaluateMonthlyStreak(): Promise<{
  evaluated: number
  hits: number
  misses: number
  prizesAwarded: number
}> {
  await connectToDatabase()

  const now = new Date()
  // Evaluate the previous calendar month
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const startDate = new Date(prevYear, prevMonth - 1, 1)
  const endDate = new Date(prevYear, prevMonth, 1)

  const vendors = await VendorStreak.find({ hasSetTarget: true }).lean() as any[]

  let evaluated = 0
  let hits = 0
  let misses = 0
  let prizesAwarded = 0

  for (const doc of vendors) {
    try {
      const vendorId = String(doc.vendorId)

      // Check if this month was already recorded
      const alreadyRecorded = doc.monthlyRecords?.some(
        (r: any) => r.month === prevMonth && r.year === prevYear
      )
      if (alreadyRecorded) continue

      // Count settled orders for this vendor in the previous month
      const orders = await Order.find({
        'vendors.vendorId': vendorId,
        createdAt: { $gte: startDate, $lt: endDate },
        status: { $in: SETTLED_STATUSES },
      }).lean() as any[]

      // Sum GMV from this vendor's portion
      let gmvThatMonth = 0
      for (const order of orders) {
        const vendorEntry = Array.isArray(order.vendors)
          ? order.vendors.find((v: any) => v.vendorId === vendorId)
          : null
        if (vendorEntry?.total) {
          gmvThatMonth += Number(vendorEntry.total || 0)
        }
      }

      const actualOrderCount = orders.length
      const targetOrderCount = doc.targetOrderCount
      const hit = actualOrderCount >= targetOrderCount
      const platformFeeEarned = gmvThatMonth * PLATFORM_FEE_RATE

      const monthlyRecord = {
        month: prevMonth,
        year: prevYear,
        targetOrderCount,
        actualOrderCount,
        hit,
        gmvThatMonth,
        platformFeeEarned,
      }

      let newStreak = doc.currentStreak
      let newLongest = doc.longestStreak

      if (hit) {
        newStreak += 1
        newLongest = Math.max(newLongest, newStreak)
        hits++
      } else {
        newStreak = 0
        misses++
      }

      await VendorStreak.updateOne(
        { vendorId },
        {
          $push: { monthlyRecords: monthlyRecord },
          $set: {
            currentStreak: newStreak,
            longestStreak: newLongest,
            updatedAt: new Date(),
          },
        }
      )

      // Prize check — only on hit months, only if this exact milestone not already paid
      if (hit && PRIZES[newStreak]) {
        const milestoneAmount = PRIZES[newStreak]
        const alreadyPaid = doc.streakPrizesPaid?.some((p: any) => p.milestone === newStreak)

        if (!alreadyPaid) {
          await creditStreakPrize(vendorId, newStreak, milestoneAmount)
          await VendorStreak.updateOne(
            { vendorId },
            {
              $push: {
                streakPrizesPaid: {
                  milestone: newStreak,
                  paidAt: new Date(),
                  amount: milestoneAmount,
                },
              },
            }
          )
          prizesAwarded++

          const vendorUser = await User.findById(vendorId).select('name displayName').lean() as any
          const name = String(vendorUser?.name || vendorUser?.displayName || 'Vendor').trim()
          await sendStreakNotification(
            vendorId,
            `Congratulations ${name}. You hit your ${newStreak}-month streak. ₦${milestoneAmount.toLocaleString('en-NG')} is being processed to your wallet.`
          )
        }
      } else if (!hit) {
        await sendStreakNotification(
          vendorId,
          'You missed your target last month and your streak has reset. Keep going — your next streak starts now.'
        )
      }

      evaluated++
    } catch (err) {
      console.error('[streak-evaluation] Failed for vendor:', doc.vendorId, err)
    }
  }

  return { evaluated, hits, misses, prizesAwarded }
}
