import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import mongoose from 'mongoose'
import { getUserBySessionToken } from '@/lib/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { User } from '@/lib/models/User'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value || request.headers.get('X-Session-Token')

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await getUserBySessionToken(sessionToken)
    if (!currentUser || currentUser.role !== 'customer') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const reference = String(body?.reference || '').trim()
    const creditAmountRaw = Number(body?.creditAmount)

    if (!reference) {
      return NextResponse.json({ success: false, error: 'reference is required' }, { status: 400 })
    }

    const creditAmount = Number.isFinite(creditAmountRaw) && creditAmountRaw > 0
      ? Math.round(creditAmountRaw * 100) / 100
      : NaN

    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      return NextResponse.json({ success: false, error: 'creditAmount must be greater than zero' }, { status: 400 })
    }

    await connectToDatabase()

    const transaction = await WalletTransaction.findOne({
      reference,
      userId: String(currentUser.id),
      type: 'topup',
    })

    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
    }

    if (transaction.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Transaction already completed',
        reference: transaction.reference,
        creditedAmount: Number(transaction.amount || 0),
      })
    }

    const originalAmount = Number(transaction.amount || 0)
    const chargedFee = Math.max(0, Math.round((originalAmount - creditAmount) * 100) / 100)

    const completeUpdate = await WalletTransaction.updateOne(
      { _id: transaction._id, status: 'pending' },
      {
        $set: {
          status: 'completed',
          amount: creditAmount,
          metadata: {
            ...(transaction.metadata || {}),
            manualAdjustment: {
              reason: 'Manual force completion',
              originalTopupAmount: originalAmount,
              creditedAmount: creditAmount,
              chargedFee,
              at: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        },
      }
    )

    if (completeUpdate.modifiedCount === 0) {
      return NextResponse.json({ success: false, error: 'Unable to complete transaction' }, { status: 409 })
    }

    const userIdObject = mongoose.Types.ObjectId.isValid(String(transaction.userId))
      ? new mongoose.Types.ObjectId(String(transaction.userId))
      : transaction.userId

    await User.updateOne(
      { _id: userIdObject, role: 'customer' },
      {
        $inc: { walletBalance: creditAmount },
        $set: { updatedAt: new Date() },
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Transaction force completed',
      reference: transaction.reference,
      creditedAmount: creditAmount,
      chargedFee,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to force complete top-up' },
      { status: 500 }
    )
  }
}
