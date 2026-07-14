import mongoose from 'mongoose'
import connectToDatabase from './mongodb'
import { Order } from './models/Order'
import { User } from './models/User'
import { WalletTransaction } from './models/WalletTransaction'
import { RiderAssignment } from './models/RiderAssignment'

const TERMINAL_ORDER_STATUSES = ['delivered', 'received', 'completed', 'cancelled', 'refunded']

// Appends real account data to a matched FAQ answer, for the handful of topics where
// we actually have something specific to say (their own order, wallet, referral code).
// Falls back to the plain FAQ text untouched if there's no logged-in user, no data
// found, or the entry isn't one of the personalizable topics — never throws.
export async function personalize(entryId: string, baseText: string, lang: 'en' | 'pcm', userId?: string): Promise<string> {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return baseText

  try {
    await connectToDatabase()

    switch (entryId) {
      case 'order-status': {
        const order = await Order.findOne({ customerId: userId, status: { $nin: TERMINAL_ORDER_STATUSES } })
          .sort({ createdAt: -1 })
          .lean() as any
        if (!order) return baseText
        const shortId = String(order.orderId || '').substring(0, 8).toUpperCase()
        const statusLabel = String(order.status || '').replace(/_/g, ' ')
        return lang === 'pcm'
          ? `${baseText}\n\n📦 Your most recent order **#${shortId}** dey currently **${statusLabel}**.`
          : `${baseText}\n\n📦 Your most recent order **#${shortId}** is currently **${statusLabel}**.`
      }

      case 'live-tracking': {
        const assignment = await RiderAssignment.findOne({
          customerId: userId,
          status: { $in: ['assigned', 'picked_up', 'en_route', 'arrived'] },
        })
          .sort({ assignedAt: -1 })
          .lean() as any
        if (!assignment) return baseText
        return lang === 'pcm'
          ? `${baseText}\n\n🛵 You get active rider right now — track am here: /track/${assignment.trackingToken}`
          : `${baseText}\n\n🛵 You have an active rider right now — track them here: /track/${assignment.trackingToken}`
      }

      case 'wallet-general': {
        const user = await User.findById(userId).select('walletBalance').lean() as any
        if (!user) return baseText
        const balance = Number(user.walletBalance || 0).toLocaleString('en-NG')
        return lang === 'pcm'
          ? `${baseText}\n\n💰 Your current wallet balance na **₦${balance}**.`
          : `${baseText}\n\n💰 Your current wallet balance is **₦${balance}**.`
      }

      case 'withdrawal':
      case 'withdrawal-delayed': {
        const tx = await WalletTransaction.findOne({ userId, type: 'withdrawal' })
          .sort({ createdAt: -1 })
          .lean() as any
        if (!tx) return baseText
        const amount = Number(tx.amount || 0).toLocaleString('en-NG')
        return lang === 'pcm'
          ? `${baseText}\n\n📋 Your last withdrawal of **₦${amount}** dey **${tx.status}**.`
          : `${baseText}\n\n📋 Your last withdrawal of **₦${amount}** is **${tx.status}**.`
      }

      case 'referral': {
        const user = await User.findById(userId).select('referralCode').lean() as any
        if (!user?.referralCode) return baseText
        return lang === 'pcm'
          ? `${baseText}\n\n🎁 Your referral code na **${user.referralCode}**.`
          : `${baseText}\n\n🎁 Your referral code is **${user.referralCode}**.`
      }

      default:
        return baseText
    }
  } catch (error) {
    console.error('[support-personalize] Failed:', error)
    return baseText
  }
}
