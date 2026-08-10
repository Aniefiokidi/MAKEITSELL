// Shared account-deletion flow — the ONE place both the website and the mobile app's
// account-deletion routes call into (app/api/account/delete/route.ts, plus the legacy
// app/api/user/delete-account and app/api/vendor/delete-account routes, which are now
// thin wrappers around this). Do not duplicate this logic per platform or per role.
//
// Split-delete model, not a full wipe and not a full retain:
//  - ERASE: personal profile data with no retention justification (name, saved
//    addresses, phone, profile fields, payout bank details, vendor/rider info).
//  - PSEUDONYMIZE: transaction records (orders, bookings, reviews) — keep every fact
//    about what was sold/booked and when, replace the buyer-side personal identifiers
//    on them with a deterministic internal reference.
//  - BLOCK: if there's an open, unpaid-for-in-full obligation (an order/booking still
//    in play, or — for vendors — money owed/held that hasn't been settled), deletion is
//    deferred with a clear reason instead of proceeding.
//
// Idempotent: calling this on an already-deleted account is a safe no-op (checked via
// User.deletedAt, set at the end of a successful deletion). All mutations run inside one
// MongoDB transaction, so a failure partway through never leaves an account
// partially-deleted — either everything below commits, or nothing does.
import crypto from 'crypto'
import mongoose from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { Order } from '@/lib/models/Order'
import { Booking } from '@/lib/models/Booking'
import { Store } from '@/lib/models/Store'
import { Product } from '@/lib/models/Product'
import { SavedAddress } from '@/lib/models/SavedAddress'
import { Cart } from '@/lib/models/Cart'
import { Wishlist } from '@/lib/models/Wishlist'
import { Follow } from '@/lib/models/Follow'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { Review } from '@/lib/models/Review'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { addToBlocklist } from '@/lib/account-blocklist'

export type DeletionBlockReason =
  | 'open_orders'
  | 'open_bookings'
  | 'unsettled_wallet_balance'
  | 'unreleased_escrow'
  | 'pending_payout'

export interface DeletionResult {
  success: boolean
  status: 'deleted' | 'already_deleted' | 'blocked' | 'not_found'
  reason?: string
  blockedBy?: DeletionBlockReason[]
}

// An order/booking counts as "open" only once money has actually moved on it — one
// stuck at paymentStatus pending/failed is an abandoned checkout attempt (extremely
// common; every unpaid cart abandonment leaves one of these), not a real transaction
// either party has an outstanding obligation on.
const ORDER_CLOSED_STATUSES = ['completed', 'cancelled', 'received']
const ORDER_UNPAID_PAYMENT_STATUSES = ['pending', 'failed']
const BOOKING_CLOSED_STATUSES = ['completed', 'cancelled']

function buildOpenOrderFilter(matchField: 'customerId' | 'vendors.vendorId', id: string) {
  return {
    [matchField]: id,
    status: { $nin: ORDER_CLOSED_STATUSES },
    paymentStatus: { $nin: ORDER_UNPAID_PAYMENT_STATUSES },
  }
}

// Deterministic per user — every order/booking/review pseudonymized for the same
// deleted account gets the same reference, so they're still recognizable as "the same
// (now-anonymous) customer" for support or fraud-pattern purposes without holding any
// live personal data. Not reversible to the original identity on its own.
function internalCustomerRef(userId: string): string {
  const hash = crypto.createHash('sha256').update(String(userId)).digest('hex').slice(0, 12)
  return `deleted-user-${hash}`
}

export async function deleteUserAccount(userId: string): Promise<DeletionResult> {
  await connectToDatabase()

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return { success: false, status: 'not_found', reason: 'Account not found.' }
  }

  const user: any = await User.findById(userId).lean()
  if (!user) {
    return { success: false, status: 'not_found', reason: 'Account not found.' }
  }

  if (user.deletedAt) {
    return { success: true, status: 'already_deleted' }
  }

  if (user.role === 'admin') {
    return {
      success: false,
      status: 'blocked',
      reason: 'Admin accounts cannot be self-deleted. Contact platform support.',
    }
  }

  const isVendor = user.role === 'vendor'

  // ---- Eligibility checks — read-only. Nothing is mutated unless every check passes. ----
  if (isVendor) {
    const [openOrderCount, escrowOrderCount, openBookingCount, pendingPayoutCount, stores] =
      await Promise.all([
        Order.countDocuments(buildOpenOrderFilter('vendors.vendorId', userId)),
        Order.countDocuments({ 'vendors.vendorId': userId, paymentStatus: 'escrow' }),
        // The platform has two parallel transaction types (goods orders and service
        // bookings) — a services-only vendor would sail through an orders-only check
        // with zero protection, so "open orders" is treated as covering both here.
        Booking.countDocuments({
          providerId: userId,
          $or: [{ status: { $nin: BOOKING_CLOSED_STATUSES } }, { balanceOwed: { $gt: 0 } }],
        }),
        WalletTransaction.countDocuments({ userId, type: 'withdrawal', status: 'pending' }),
        Store.find({ vendorId: userId }).select('walletBalance').lean(),
      ])

    // walletBalance/earnedBalance/depositedBalance/prizeBalance live on User; Store also
    // has its own separate walletBalance field used by an older/parallel code path —
    // checking both since it wasn't possible to confirm the Store-side one is fully
    // unused without a deeper audit than this change warrants.
    const userWalletBalance =
      Number(user.walletBalance || 0) +
      Number(user.earnedBalance || 0) +
      Number(user.depositedBalance || 0) +
      Number(user.prizeBalance || 0)
    const storeWalletBalance = (stores as any[]).reduce(
      (sum, s) => sum + Number(s.walletBalance || 0),
      0
    )
    const totalWalletBalance = userWalletBalance + storeWalletBalance

    const blockedBy: DeletionBlockReason[] = []
    const reasons: string[] = []

    if (openOrderCount > 0) {
      blockedBy.push('open_orders')
      reasons.push(`${openOrderCount} order(s) not yet completed or cancelled`)
    }
    if (escrowOrderCount > 0 && !blockedBy.includes('open_orders')) {
      blockedBy.push('unreleased_escrow')
      reasons.push(`${escrowOrderCount} order(s) with unreleased escrow`)
    }
    if (openBookingCount > 0) {
      blockedBy.push('open_bookings')
      reasons.push(`${openBookingCount} booking(s) not yet completed, cancelled, or settled`)
    }
    if (pendingPayoutCount > 0) {
      blockedBy.push('pending_payout')
      reasons.push(`${pendingPayoutCount} payout(s) still processing`)
    }
    if (totalWalletBalance > 0) {
      blockedBy.push('unsettled_wallet_balance')
      reasons.push(`a wallet balance of ₦${totalWalletBalance.toLocaleString('en-NG')} not yet withdrawn`)
    }

    if (blockedBy.length > 0) {
      return {
        success: false,
        status: 'blocked',
        reason: `Cannot delete this vendor account yet: ${reasons.join('; ')}. Settle these first, then try again.`,
        blockedBy,
      }
    }
  } else {
    const [openOrderCount, openBookingCount] = await Promise.all([
      Order.countDocuments(buildOpenOrderFilter('customerId', userId)),
      Booking.countDocuments({ customerId: userId, status: { $nin: BOOKING_CLOSED_STATUSES } }),
    ])

    const blockedBy: DeletionBlockReason[] = []
    if (openOrderCount > 0) blockedBy.push('open_orders')
    if (openBookingCount > 0) blockedBy.push('open_bookings')

    if (blockedBy.length > 0) {
      return {
        success: false,
        status: 'blocked',
        reason: 'Complete or cancel your open orders first.',
        blockedBy,
      }
    }
  }

  // ---- Mutations — all-or-nothing, and the User update below is an atomic CLAIM (same
  // pattern as lib/order-payment-confirmation.ts's handleOrderPaid): its filter only
  // matches a not-yet-deleted account, so two concurrent deletion requests for the same
  // account (e.g. a double-tapped "delete my account" button) can't both win. Only the
  // request that successfully claims it runs the rest of the mutations — including the
  // blocklist write — below; the other sees claimed === null and backs off as a no-op.
  // Confirmed this race is real, not theoretical: an earlier version of this function
  // read deletedAt before starting the transaction, and two concurrent calls both read
  // "not deleted yet" and both ran the full deletion independently. ----
  const ref = internalCustomerRef(userId)
  const tombstoneEmail = `deleted-${userId}@deleted.makeitsell.ng`

  let claimedByThisCall = false

  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const claimed = await User.findOneAndUpdate(
        { _id: userId, deletedAt: { $exists: false } },
        {
          $set: {
            email: tombstoneEmail,
            name: 'Deleted User',
            displayName: 'Deleted User',
            deletedAt: new Date(),
            updatedAt: new Date(),
          },
          $unset: {
            passwordHash: '',
            password: '',
            profileImage: '',
            phone: '',
            phone_number: '',
            address: '',
            city: '',
            state: '',
            postalCode: '',
            otp_code: '',
            otp_expiry: '',
            otp_voice_pin_id: '',
            otp_voice_pin_expiry: '',
            withdrawalPinHash: '',
            withdrawalPinSetAt: '',
            payoutProfile: '',
            vendorInfo: '',
            riderInfo: '',
            sessionToken: '',
            resetToken: '',
            resetTokenExpiry: '',
            emailVerificationToken: '',
            emailVerificationTokenExpiry: '',
          },
        },
        { session, new: false }
      )

      if (!claimed) {
        // Lost the race — another concurrent call already claimed this deletion.
        return
      }
      claimedByThisCall = true

      // Fraud blocklist — before the identity above was overwritten, using the
      // pre-claim `user` values read at the top of this function. Only ever runs for a
      // fraud-flagged account; a normal voluntary deletion never reaches this branch.
      // No fraud-detection feature exists yet, so user.fraudBanned is never true today —
      // this is wired up now so a future feature setting it activates this
      // automatically, with no further changes needed here.
      if (user.fraudBanned) {
        await addToBlocklist({
          email: user.email,
          phone: user.phone || user.phone_number,
          reason: 'fraud_banned_account_deletion',
          originalUserId: String(user._id),
          session,
        })
      }

      // Purely personal records with no retention justification — erase entirely.
      await SavedAddress.deleteMany({ userId }, { session })
      await Cart.deleteMany({ userId }, { session })
      await Wishlist.deleteMany({ userId }, { session })
      await Follow.deleteMany({ customerId: userId }, { session })
      await WhatsAppBuyer.deleteMany({ customerId: userId }, { session })

      // Transaction/review records — pseudonymize the buyer-side identity only. orderId,
      // customerId (an opaque internal reference — that's the point of it), items,
      // amounts, dates, vendor info, and dispute/escrow state are all left untouched;
      // this is what lets "what was sold and when" survive for legal/tax/dispute
      // purposes without holding live personal data.
      await Order.updateMany(
        { customerId: userId },
        {
          $set: {
            'shippingInfo.firstName': ref,
            'shippingInfo.lastName': '',
            'shippingInfo.email': null,
            'shippingInfo.phone': null,
            'shippingInfo.address': null,
            'shippingInfo.deliveryInstructions': null,
            'shippingInfo.payerPhone': null,
            'shippingAddress.street': null,
            'shippingAddress.instructions': null,
          },
        },
        { session }
      )

      await Booking.updateMany(
        { customerId: userId },
        {
          $set: {
            customerName: ref,
            customerEmail: `${ref}@deleted.makeitsell.ng`,
            customerPhone: null,
          },
        },
        { session }
      )

      await Review.updateMany({ customerId: userId }, { $set: { customerName: ref } }, { session })

      if (isVendor) {
        // Hidden, not deleted — historical orders/reviews still reference these ids, and
        // deleting them would orphan those records.
        await Product.updateMany({ vendorId: userId }, { $set: { status: 'inactive' } }, { session })
        await Store.updateMany(
          { vendorId: userId },
          {
            $set: { isActive: false, accountStatus: 'deleted' },
            $unset: { phone: '', email: '', bankName: '', bankCode: '', accountNumber: '', accountName: '' },
          },
          { session }
        )
        // Vendor-side identifiers on historical orders/bookings (vendorName, storeId,
        // providerName) are deliberately left untouched — per the stricter retention
        // policy for vendor sales records, these are the seller's own business/
        // transaction history, not personal profile data being erased on their request.
      }
    })
  } finally {
    await session.endSession()
  }

  if (!claimedByThisCall) {
    return { success: true, status: 'already_deleted' }
  }

  return { success: true, status: 'deleted' }
}
