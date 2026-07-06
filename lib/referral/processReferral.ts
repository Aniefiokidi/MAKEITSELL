import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { Order } from '@/lib/models/Order'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { pushToUser } from '@/lib/push-notifications'
import { sendCustomSms } from '@/lib/sms'

const SETTLED_STATUSES = [
  'confirmed', 'processing', 'shipped', 'out_for_delivery',
  'delivered', 'received', 'completed',
]
const VENDOR_REFERRAL_ORDER_THRESHOLD = 10
const VENDOR_REFERRAL_WINDOW_DAYS = 60
const VENDOR_REFERRAL_AMOUNT = 10000
const BUYER_REFERRAL_AMOUNT = 500

async function sendReferralNotification(
  userId: string,
  title: string,
  body: string,
  tag: string
) {
  void pushToUser(userId, { title, body, url: '/vendor/dashboard', tag })

  try {
    const user = await User.findById(userId).select('phone phone_number').lean() as any
    const phone = String(user?.phone || user?.phone_number || '').trim()
    if (phone) await sendCustomSms({ phoneNumber: phone, message: body })
  } catch {
    // SMS is best-effort
  }
}

/**
 * Called after a vendor's wallet is credited for a settled order.
 * Checks if the selling vendor was referred by another vendor, and if they have
 * just hit their 10th settled order within 60 days of account creation.
 * If so, credits ₦10,000 to the referring vendor's prizeBalance.
 */
export async function processVendorReferral(sellingVendorId: string): Promise<void> {
  await connectToDatabase()

  const vendor = await User.findById(sellingVendorId)
    .select('referredByVendorId createdAt vendorInfo name displayName')
    .lean() as any

  if (!vendor?.referredByVendorId) return

  const daysSinceCreated =
    (Date.now() - new Date(vendor.createdAt).getTime()) / (1000 * 60 * 60 * 24)

  if (daysSinceCreated > VENDOR_REFERRAL_WINDOW_DAYS) {
    console.log(`[referral] vendor ${sellingVendorId} outside 60-day window (${Math.round(daysSinceCreated)}d)`)
    return
  }

  // Count ALL settled orders for this vendor across all orders
  const settledCount = await Order.countDocuments({
    'vendors.vendorId': sellingVendorId,
    status: { $in: SETTLED_STATUSES },
  })

  if (settledCount !== VENDOR_REFERRAL_ORDER_THRESHOLD) return

  const referringVendorId = String(vendor.referredByVendorId)
  const reference = `VENDOR-REFERRAL-${sellingVendorId}`

  const tx = await WalletTransaction.updateOne(
    { reference },
    {
      $setOnInsert: {
        userId: referringVendorId,
        type: 'vendor_referral_bonus',
        amount: VENDOR_REFERRAL_AMOUNT,
        status: 'completed',
        reference,
        provider: 'referral_programme',
        note: `Vendor referral bonus — referred vendor hit ${VENDOR_REFERRAL_ORDER_THRESHOLD} orders`,
        metadata: {
          subType: 'vendor_referral',
          referredVendorId: sellingVendorId,
          orderThreshold: VENDOR_REFERRAL_ORDER_THRESHOLD,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  )

  if ((tx as any).upsertedCount > 0) {
    await User.updateOne(
      { _id: referringVendorId },
      { $inc: { walletBalance: VENDOR_REFERRAL_AMOUNT, prizeBalance: VENDOR_REFERRAL_AMOUNT }, $set: { updatedAt: new Date() } }
    )

    const storeName =
      String(vendor?.vendorInfo?.businessName || vendor?.name || vendor?.displayName || 'The vendor you referred').trim()

    await sendReferralNotification(
      referringVendorId,
      'Referral Bonus Earned',
      `Great news. ${storeName} you referred just completed their 10th sale on Make It Sell. ₦10,000 has been added to your wallet. Withdraw anytime with no fee.`,
      `vendor-referral-${sellingVendorId}`
    )
  }
}

/**
 * Called once per settled order.
 * Checks if the buyer was referred by a vendor and has not yet triggered the one-time
 * ₦500 buyer referral credit. If so, credits ₦500 to the referring vendor's prizeBalance
 * and marks the buyer so it cannot fire again.
 */
export async function processBuyerReferral(buyerId: string, orderId: string): Promise<void> {
  if (!buyerId) return
  await connectToDatabase()

  // Atomically claim the referral credit — prevents race conditions
  const updateResult = await User.updateOne(
    { _id: buyerId, referredByVendorId: { $exists: true, $ne: null, $ne: '' }, referralCreditIssued: { $ne: true } },
    { $set: { referralCreditIssued: true, updatedAt: new Date() } }
  )

  if (updateResult.modifiedCount === 0) return

  const buyer = await User.findById(buyerId).select('referredByVendorId').lean() as any
  const referringVendorId = String(buyer?.referredByVendorId || '')
  if (!referringVendorId) return

  const reference = `BUYER-REFERRAL-${buyerId}`

  const tx = await WalletTransaction.updateOne(
    { reference },
    {
      $setOnInsert: {
        userId: referringVendorId,
        type: 'buyer_referral_credit',
        amount: BUYER_REFERRAL_AMOUNT,
        status: 'completed',
        reference,
        provider: 'referral_programme',
        note: `Buyer referral credit — new buyer made first purchase`,
        metadata: {
          subType: 'buyer_referral',
          buyerId,
          orderId,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  )

  if ((tx as any).upsertedCount > 0) {
    await User.updateOne(
      { _id: referringVendorId },
      { $inc: { walletBalance: BUYER_REFERRAL_AMOUNT, prizeBalance: BUYER_REFERRAL_AMOUNT }, $set: { updatedAt: new Date() } }
    )

    void pushToUser(referringVendorId, {
      title: 'Referral Credit Earned',
      body: 'A new buyer you referred just placed their first order. ₦500 has been added to your wallet.',
      url: '/vendor/dashboard',
      tag: `buyer-referral-${buyerId}`,
    })
  }
}
