import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { User } from '@/lib/models/User'
import { Order } from '@/lib/models/Order'
import { paystackService } from '@/lib/payment'
import mongoose from 'mongoose'

const getDirection = (type: string) => {
  if (type === 'vendor_credit' || type === 'topup') return 'credit'
  if (type === 'withdrawal' || type === 'purchase_debit') return 'debit'
  return 'neutral'
}

const mapTransferStatusToTxStatus = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (
    ['success', 'successful', 'succeeded', 'completed', 'complete', 'paid', 'approved', 'ok', 'transferred', 'done', 'true'].includes(normalized)
    || normalized.includes('success')
    || normalized.includes('succeed')
    || normalized.includes('complete')
    || normalized.includes('paid')
    || normalized.includes('approve')
    || normalized.includes('transfer success')
  ) {
    return 'completed'
  }
  if (
    ['failed', 'failure', 'reversed', 'declined', 'cancelled', 'canceled'].includes(normalized)
    || normalized.includes('fail')
    || normalized.includes('declin')
    || normalized.includes('cancel')
    || normalized.includes('revers')
  ) {
    return 'failed'
  }
  return 'pending'
}

const EXPLICIT_PAID_STATUSES = new Set([
  'success',
  'successful',
  'succeeded',
  'completed',
  'complete',
  'paid',
  'approved',
])

const EXPLICIT_FAILED_STATUSES = new Set([
  'failed',
  'failure',
  'declined',
  'cancelled',
  'canceled',
  'abandoned',
  'expired',
  'reversed',
])

const TOPUP_PENDING_TIMEOUT_MS = 6 * 60 * 60 * 1000

const pickTransferStatus = (tx: any) => {
  const rawStatus =
    tx?.metadata?.transferData?.status
    || tx?.metadata?.transferStatus
    || tx?.metadata?.paystackTransferRaw?.status
    || tx?.metadata?.paystackTransferRaw?.transfer_status
    || tx?.metadata?.paystackTransferRaw?.transferStatus
    || ''

  return String(rawStatus || '').trim()
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await getUserBySessionToken(sessionToken)
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== 'vendor') {
      return NextResponse.json({ success: false, error: 'Only vendors can access this endpoint' }, { status: 403 })
    }

    await connectToDatabase()

    const pendingTopups = await WalletTransaction.find({
      userId: String(currentUser.id),
      type: 'topup',
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()

    for (const pendingTopup of pendingTopups as any[]) {
      const createdAtMs = new Date(pendingTopup?.createdAt || 0).getTime()
      if (Number.isFinite(createdAtMs) && Date.now() - createdAtMs >= TOPUP_PENDING_TIMEOUT_MS) {
        await WalletTransaction.updateOne(
          { _id: pendingTopup._id, status: 'pending' },
          {
            $set: {
              status: 'failed',
              metadata: {
                ...(pendingTopup.metadata || {}),
                timeoutFailure: {
                  source: 'vendor-wallet-transactions-read',
                  timeoutHours: 6,
                  at: new Date().toISOString(),
                },
              },
              updatedAt: new Date(),
            },
          }
        )
        continue
      }

      const candidates = Array.from(
        new Set(
          [
            pendingTopup.paymentReference,
            pendingTopup.reference,
            pendingTopup?.metadata?.orderId,
            pendingTopup?.metadata?.orderID,
            pendingTopup?.metadata?.paymentReference,
            pendingTopup?.metadata?.payment_reference,
          ]
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => value.trim())
        )
      )

      if (candidates.length === 0) {
        continue
      }

      let verification: Awaited<ReturnType<typeof paystackService.verifyPayment>> | null = null
      for (const candidate of candidates) {
        try {
          const attempt = await paystackService.verifyPayment(candidate)
          if (attempt.success) {
            verification = attempt
            break
          }
          if (!verification) {
            verification = attempt
          }
        } catch {
          // Ignore verification transport errors for this candidate and continue.
        }
      }

      if (!verification?.success) {
        continue
      }

      const verifyStatus = String(verification.data?.status || '').trim().toLowerCase()
      const isExplicitPaid = EXPLICIT_PAID_STATUSES.has(verifyStatus)
      const isExplicitFailed = EXPLICIT_FAILED_STATUSES.has(verifyStatus)

      if (!isExplicitPaid) {
        if (isExplicitFailed) {
          await WalletTransaction.updateOne(
            { _id: pendingTopup._id, status: 'pending' },
            {
              $set: {
                status: 'failed',
                metadata: {
                  ...(pendingTopup.metadata || {}),
                  paystackVerification: {
                    status: verification.data?.status,
                    message: verification.message,
                    source: 'vendor-wallet-transactions-read',
                    at: new Date().toISOString(),
                  },
                },
                updatedAt: new Date(),
              },
            }
          )
        }
        continue
      }

      const resolvedReference = String(verification.data?.reference || candidates[0])

      const completeUpdate = await WalletTransaction.updateOne(
        { _id: pendingTopup._id, status: 'pending' },
        {
          $set: {
            status: 'completed',
            paymentReference: resolvedReference,
            metadata: {
              ...(pendingTopup.metadata || {}),
              paystackData: verification.data || {},
            },
            updatedAt: new Date(),
          },
        }
      )

      if (completeUpdate.modifiedCount > 0) {
        const userIdObject = mongoose.Types.ObjectId.isValid(String(pendingTopup.userId))
          ? new mongoose.Types.ObjectId(String(pendingTopup.userId))
          : pendingTopup.userId

        await User.updateOne(
          { _id: userIdObject, role: 'vendor' },
          {
            $inc: { walletBalance: Number(pendingTopup.amount || 0), depositedBalance: Number(pendingTopup.amount || 0) },
            $set: { updatedAt: new Date() },
          }
        )
      }
    }

    const pendingWithdrawals = await WalletTransaction.find({
      userId: String(currentUser.id),
      type: 'withdrawal',
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    for (const pendingWithdrawal of pendingWithdrawals as any[]) {
      const transferStatus = pickTransferStatus(pendingWithdrawal)
      const mappedStatus = mapTransferStatusToTxStatus(transferStatus)
      if (mappedStatus === 'pending') {
        continue
      }

      await WalletTransaction.updateOne(
        { _id: pendingWithdrawal._id, status: 'pending' },
        {
          $set: {
            status: mappedStatus,
            metadata: {
              ...(pendingWithdrawal.metadata || {}),
              autoStatusReconcile: {
                source: 'vendor-wallet-transactions-read',
                transferStatus,
                mappedStatus,
                at: new Date().toISOString(),
              },
            },
            updatedAt: new Date(),
          },
        }
      )
    }

    const transactions = await WalletTransaction.find({ userId: String(currentUser.id) })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    const userBalance = typeof currentUser.walletBalance === 'number' ? currentUser.walletBalance : 0

    // Fetch sub-balances for breakdown display
    const userDoc = await User.findById(currentUser.id)
      .select('earnedBalance depositedBalance prizeBalance')
      .lean() as any
    const earnedBalance = typeof userDoc?.earnedBalance === 'number' ? userDoc.earnedBalance : 0
    const depositedBalance = typeof userDoc?.depositedBalance === 'number' ? userDoc.depositedBalance : 0
    const prizeBalance = typeof userDoc?.prizeBalance === 'number' ? userDoc.prizeBalance : 0

    // Sum totalAmount for escrow-held orders involving this vendor
    const escrowOrders = await Order.find({
      paymentStatus: 'escrow',
      'vendors.vendorId': String(currentUser.id),
    }).select('totalAmount').lean()
    const escrowBalance = (escrowOrders as any[]).reduce(
      (sum, o) => sum + Number(o.totalAmount || 0),
      0
    )

    // Payout schedule preview — this vendor's own portion of each order still in escrow,
    // sorted by when it will resolve one way or another. There's no fixed "payout date":
    // it releases the moment the customer confirms receipt, or auto-refunds to the
    // *customer* (not the vendor) if they never respond within the ~96h window — so
    // "resolvesBy" is the latest this stays undecided, not a guaranteed payout date.
    const NINETY_SIX_HOURS_MS = 96 * 60 * 60 * 1000
    const escrowOrdersDetailed = await Order.find({
      paymentStatus: 'escrow',
      'vendors.vendorId': String(currentUser.id),
    }).select('orderId vendors paidAt createdAt disputeStatus disputeRaisedAt').lean()

    const pendingSettlements = (escrowOrdersDetailed as any[])
      .map((o) => {
        const vendorLine = (o.vendors || []).find((v: any) => String(v?.vendorId) === String(currentUser.id))
        const vendorAmount = Number(vendorLine?.total || 0)
        if (vendorAmount <= 0) return null

        const paidAt = o.paidAt || o.createdAt
        const isDisputed = Boolean(o.disputeRaisedAt) || String(o.disputeStatus || '').toLowerCase() === 'active'
        const resolvesBy = paidAt ? new Date(new Date(paidAt).getTime() + NINETY_SIX_HOURS_MS).toISOString() : null

        return {
          orderId: o.orderId,
          vendorAmount,
          paidAt: paidAt ? new Date(paidAt).toISOString() : null,
          resolvesBy: isDisputed ? null : resolvesBy,
          isDisputed,
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        if (!a.resolvesBy) return 1
        if (!b.resolvesBy) return -1
        return new Date(a.resolvesBy).getTime() - new Date(b.resolvesBy).getTime()
      })

    const data = transactions.map((tx: any) => {
      const isManualReview =
        tx?.type === 'withdrawal'
        && tx?.status === 'pending'
        && (
          tx?.provider === 'manual_transfer'
          || tx?.metadata?.manualProcessingRequired === true
          || tx?.metadata?.transferStatus === 'manual_review'
        )

      return {
      id: tx?._id?.toString?.() || '',
      type: tx.type,
      amount: Number(tx.amount || 0),
      status: isManualReview ? 'manual_review' : tx.status,
      reference: tx.reference,
      note: tx.note || '',
      provider: tx.provider || '',
      orderId: tx.orderId || '',
      createdAt: tx.createdAt,
      direction: getDirection(String(tx.type || '')),
      }
    })

    return NextResponse.json({
      success: true,
      transactions: data,
      walletBalance: userBalance,
      earnedBalance,
      depositedBalance,
      prizeBalance,
      escrowBalance,
      pendingSettlements,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch vendor wallet transactions' },
      { status: 500 }
    )
  }
}
