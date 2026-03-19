import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { xoroPayService } from '@/lib/xoro-pay'
import crypto from 'crypto'

const hashWithdrawalPin = (pin: string, userId: string) => {
  return crypto.createHash('sha256').update(`${pin}:${userId}`).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const amount = Number(body?.amount)
    const bankName = String(body?.bankName || '').trim()
    const bankCode = String(body?.bankCode || '').trim()
    const accountNumber = String(body?.accountNumber || '').trim()
    const accountName = String(body?.accountName || '').trim()
    const withdrawalPin = String(body?.withdrawalPin || '').trim()

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Amount must be greater than zero' }, { status: 400 })
    }

    if (!bankName || !bankCode || !accountNumber || !accountName) {
      return NextResponse.json(
        { success: false, error: 'Bank, account number and account name are required' },
        { status: 400 }
      )
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json(
        { success: false, error: 'Account number must be 10 digits' },
        { status: 400 }
      )
    }

    if (!/^\d{4}$/.test(withdrawalPin)) {
      return NextResponse.json(
        { success: false, error: 'Valid 4-digit withdrawal PIN is required' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value || request.headers.get('X-Session-Token')
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await getUserBySessionToken(sessionToken)
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== 'customer') {
      return NextResponse.json({ success: false, error: 'Only customers can withdraw' }, { status: 403 })
    }

    const normalizedAmount = Math.round(amount * 100) / 100

    await connectToDatabase()

    const userForPin = await User.findOne(
      { _id: currentUser.id, role: 'customer' },
      { withdrawalPinHash: 1 }
    )

    if (!userForPin?.withdrawalPinHash) {
      return NextResponse.json(
        { success: false, error: 'Set your 4-digit withdrawal PIN before requesting withdrawal' },
        { status: 400 }
      )
    }

    const providedPinHash = hashWithdrawalPin(withdrawalPin, String(currentUser.id))
    if (userForPin.withdrawalPinHash !== providedPinHash) {
      return NextResponse.json(
        { success: false, error: 'Incorrect withdrawal PIN' },
        { status: 400 }
      )
    }

    const debitResult = await User.updateOne(
      {
        _id: currentUser.id,
        role: 'customer',
        walletBalance: { $gte: normalizedAmount },
      },
      {
        $inc: { walletBalance: -normalizedAmount },
        $set: {
          updatedAt: new Date(),
        },
      }
    )

    if (debitResult.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Insufficient wallet balance for this withdrawal' },
        { status: 400 }
      )
    }

    const reference = `wallet_withdraw_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
    const payoutReference = `wd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const transferReason = `Customer wallet withdrawal to ${accountName}`

    let transferProvider = 'xoro_payout'
    let transferCode = ''
    let transferStatus = 'pending'
    let transferRecipientCode = ''
    let transferMeta: Record<string, any> = {}
    let xoroError = ''

    try {
      const xoroRecipient = await xoroPayService.createTransferRecipient({
        name: accountName,
        accountNumber,
        bankCode,
      })

      if (xoroRecipient.success && xoroRecipient.recipientCode) {
        const xoroTransfer = await xoroPayService.initiateTransfer({
          amount: normalizedAmount,
          recipientCode: xoroRecipient.recipientCode,
          reference: payoutReference,
          reason: transferReason,
        })

        if (xoroTransfer.success && xoroTransfer.transferCode && xoroTransfer.status !== 'otp') {
          transferProvider = 'xoro_payout'
          transferCode = xoroTransfer.transferCode
          transferStatus = xoroTransfer.status || 'pending'
          transferRecipientCode = xoroRecipient.recipientCode
          transferMeta = {
            xoroRecipientRaw: xoroRecipient.raw || null,
            xoroTransferRaw: xoroTransfer.raw || null,
          }
        } else {
          xoroError = xoroTransfer.message || 'Xoro transfer initiation failed'
        }
      } else {
        xoroError = xoroRecipient.message || 'Xoro recipient creation failed'
      }
    } catch (xoroFailure: any) {
      xoroError = xoroFailure?.message || 'Xoro transfer request failed'
    }

    if (!transferCode) {
      transferProvider = 'manual_transfer'
      transferStatus = 'manual_review'
      transferRecipientCode = ''
      transferMeta = {
        autoTransferInitiated: false,
        manualProcessingRequired: true,
        xoroError,
      }

      console.warn('[wallet/withdraw] auto-transfer unavailable, queued for manual processing', {
        userId: String(currentUser.id),
        amount: normalizedAmount,
        bankCode,
        payoutReference,
        xoroError,
      })
    }

    await WalletTransaction.create({
      userId: String(currentUser.id),
      type: 'withdrawal',
      amount: normalizedAmount,
      status: 'pending',
      reference,
      provider: transferProvider,
      note: `Customer withdrawal to ${accountName} (${bankName})`,
      metadata: {
        bankName,
        bankCode,
        accountNumber,
        accountName,
        payoutReference,
        transferCode,
        transferStatus,
        transferRecipientCode,
        requestedBy: currentUser.email,
        ...transferMeta,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const refreshedUser = await User.findOne(
      { _id: currentUser.id },
      { walletBalance: 1 }
    )

    return NextResponse.json({
      success: true,
      message: transferCode
        ? 'Withdrawal request submitted. Transfer is being processed.'
        : 'Withdrawal request submitted for manual processing.',
      reference,
      balance: typeof refreshedUser?.walletBalance === 'number' ? refreshedUser.walletBalance : 0,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create withdrawal request' },
      { status: 500 }
    )
  }
}
