import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { Store } from '@/lib/models/Store'
import { User } from '@/lib/models/User'
import { xoroPayService } from '@/lib/xoro-pay'
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

const pickTransferStatus = (tx: any) => {
  const rawStatus =
    tx?.metadata?.transferData?.status
    || tx?.metadata?.transferStatus
    || tx?.metadata?.xoroTransferRaw?.status
    || tx?.metadata?.xoroTransferRaw?.transfer_status
    || tx?.metadata?.xoroTransferRaw?.transferStatus
    || ''

  return String(rawStatus || '').trim()
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value || request.headers.get('X-Session-Token')

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

      let verification: Awaited<ReturnType<typeof xoroPayService.verifyPayment>> | null = null
      for (const candidate of candidates) {
        try {
          const attempt = await xoroPayService.verifyPayment(candidate)
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

      const resolvedReference = verification.reference || candidates[0]

      const completeUpdate = await WalletTransaction.updateOne(
        { _id: pendingTopup._id, status: 'pending' },
        {
          $set: {
            status: 'completed',
            paymentReference: resolvedReference,
            metadata: {
              ...(pendingTopup.metadata || {}),
              xoroPayData: verification.raw || {},
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
            $inc: { walletBalance: Number(pendingTopup.amount || 0) },
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

    const store = await Store.findOne({ linkedWalletUserId: String(currentUser.id) })
      .sort({ createdAt: -1 })
      .select('walletBalance')
      .lean()

    const userBalance = typeof currentUser.walletBalance === 'number' ? currentUser.walletBalance : 0
    const storeBalance = typeof store?.walletBalance === 'number' ? store.walletBalance : 0
    const combinedBalance = userBalance + storeBalance

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
      walletBalance: combinedBalance,
      breakdown: {
        userBalance,
        storeBalance,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch vendor wallet transactions' },
      { status: 500 }
    )
  }
}
