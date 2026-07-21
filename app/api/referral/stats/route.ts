import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { VendorFunnelEvent } from '@/lib/models/VendorFunnelEvent'

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  await connectToDatabase()

  const me = await User.findById(sessionUser.id).select('referralCode referralClickCount role').lean() as any
  if (!me) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }

  const referredUsers = await User.find({ referredByVendorId: sessionUser.id })
    .select('displayName name email role createdAt referralCreditIssued')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean() as any[]

  // Vendor referrals only get an idempotency flag via a WalletTransaction reference (no
  // per-user flag like buyers get) — look those up in one batch rather than per-row.
  const referredVendorIds = referredUsers.filter((u) => u.role === 'vendor').map((u) => String(u._id))
  const vendorReferralRefs = referredVendorIds.map((id) => `VENDOR-REFERRAL-${id}`)
  const paidVendorTxs = vendorReferralRefs.length > 0
    ? await WalletTransaction.find({ reference: { $in: vendorReferralRefs } }).select('reference').lean()
    : []
  const paidVendorRefSet = new Set((paidVendorTxs as any[]).map((tx) => tx.reference))

  const referrals = referredUsers.map((u) => ({
    id: String(u._id),
    name: u.displayName || u.name || 'User',
    role: u.role,
    joinedAt: u.createdAt,
    credited: u.role === 'vendor'
      ? paidVendorRefSet.has(`VENDOR-REFERRAL-${u._id}`)
      : Boolean(u.referralCreditIssued),
  }))

  const earningsAgg = await WalletTransaction.aggregate([
    {
      $match: {
        userId: sessionUser.id,
        type: { $in: ['vendor_referral_bonus', 'buyer_referral_credit'] },
        status: 'completed',
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ])
  const totalEarnings = earningsAgg[0]?.total || 0
  const paidCount = earningsAgg[0]?.count || 0

  // Bonus signal for vendors — visiting their /store/[id] page also carries referral
  // attribution, so store visits are a real (if broader) proxy for referral reach.
  let storeVisitCount: number | undefined
  if (me.role === 'vendor') {
    storeVisitCount = await VendorFunnelEvent.countDocuments({
      vendorId: sessionUser.id,
      eventType: 'store_visit',
    })
  }

  return NextResponse.json({
    success: true,
    referralCode: me.referralCode || null,
    clickCount: me.referralClickCount || 0,
    signupCount: referredUsers.length,
    paidCount,
    totalEarnings,
    storeVisitCount,
    referrals,
  })
}
