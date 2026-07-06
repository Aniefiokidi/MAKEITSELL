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
 * Credits ₦500 to whoever referred this vendor, once, on their very first sale.
 */
export async function processVendorReferral(sellingVendorId: string): Promise<void> {
  await connectToDatabase()

  const vendor = await User.findById(sellingVendorId)
    .select('referredByVendorId vendorInfo name displayName')
    .lean() as any

  if (!vendor?.referredByVendorId) return

  const referringUserId = String(vendor.referredByVendorId)
  const reference = `VENDOR-REFERRAL-${sellingVendorId}`

  const existing = await WalletTransaction.findOne({ reference }).lean()
  if (existing) return

  const referrer = await User.findById(referringUserId).select('_id').lean() as any
  if (!referrer) return

  // Only fire on the 1st settled order
  const settledCount = await Order.countDocuments({
    'vendors.vendorId': sellingVendorId,
    status: { $in: SETTLED_STATUSES },
  })
  if (settledCount !== 1) return

  const tx = await WalletTransaction.updateOne(
    { reference },
    {
      $setOnInsert: {
        userId: referringUserId,
        type: 'vendor_referral_bonus',
        amount: BUYER_REFERRAL_AMOUNT,
        status: 'completed',
        reference,
        provider: 'referral_programme',
        note: `Referral bonus — referred vendor made their first sale`,
        metadata: {
          subType: 'vendor_referral',
          referredVendorId: sellingVendorId,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  )

  if ((tx as any).upsertedCount > 0) {
    await User.updateOne(
      { _id: referringUserId },
      { $inc: { walletBalance: BUYER_REFERRAL_AMOUNT, prizeBalance: BUYER_REFERRAL_AMOUNT }, $set: { updatedAt: new Date() } }
    )

    const storeName =
      String(vendor?.vendorInfo?.businessName || vendor?.name || vendor?.displayName || 'A vendor you referred').trim()

    await sendReferralNotification(
      referringUserId,
      'Referral Bonus Earned',
      `Great news. ${storeName} you referred just made their first sale on Make It Sell. ₦500 has been added to your wallet.`,
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
    { _id: buyerId, referredByVendorId: { $exists: true, $nin: [null, ''] }, referralCreditIssued: { $ne: true } },
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
