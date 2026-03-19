import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { Store } from '@/lib/models/Store'
import { xoroPayService } from '@/lib/xoro-pay'
import crypto from 'crypto'

const hashWithdrawalPin = (pin: string, userId: string) => {
  return crypto.createHash('sha256').update(`${pin}:${userId}`).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      amount,
      bankName,
      bankCode,
      accountNumber,
      accountName,
      withdrawalPin,
    } = body

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value || request.headers.get('X-Session-Token')

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await getUserBySessionToken(sessionToken)
    if (!currentUser || currentUser.role !== 'vendor') {
      return NextResponse.json(
        { success: false, error: 'Only vendors can withdraw' },
        { status: 403 }
      )
    }

    // Validate inputs
    const normalizedAmount = Math.round(Number(amount) * 100) / 100
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid withdrawal amount' },
        { status: 400 }
      )
    }

    if (!bankName?.trim() || !bankCode?.trim() || !accountName?.trim() || !accountNumber?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Enter bank name, bank code, account number and account name' },
        { status: 400 }
      )
    }

    if (!/^\d{4}$/.test(withdrawalPin?.trim() || '')) {
      return NextResponse.json(
        { success: false, error: 'Enter your 4-digit withdrawal PIN' },
        { status: 400 }
      )
    }

    await connectToDatabase()

    // Get user for PIN verification
    const userForPin = await User.findById(currentUser.id).select('withdrawalPinHash walletBalance').lean()

    if (!userForPin?.withdrawalPinHash) {
      return NextResponse.json(
        { success: false, error: 'Set your 4-digit withdrawal PIN before requesting withdrawal' },
        { status: 400 }
      )
    }

    // Verify PIN
    const providedPinHash = hashWithdrawalPin(withdrawalPin.trim(), String(currentUser.id))
    if (userForPin.withdrawalPinHash !== providedPinHash) {
      return NextResponse.json(
        { success: false, error: 'Incorrect withdrawal PIN' },
        { status: 401 }
      )
    }

    const store = await Store.findOne({ linkedWalletUserId: String(currentUser.id) })
      .sort({ createdAt: -1 })
      .select('_id walletBalance')
      .lean()

    const userBalance = typeof userForPin.walletBalance === 'number' ? userForPin.walletBalance : 0
    const storeBalance = typeof store?.walletBalance === 'number' ? store.walletBalance : 0
    const totalAvailable = userBalance + storeBalance

    if (totalAvailable < normalizedAmount) {
      return NextResponse.json(
        { success: false, error: 'Insufficient wallet balance for this withdrawal' },
        { status: 400 }
      )
    }

    const withdrawFromStore = Math.min(storeBalance, normalizedAmount)
    const withdrawFromUser = normalizedAmount - withdrawFromStore

    if (withdrawFromStore > 0 && store?._id) {
      await Store.updateOne(
        { _id: store._id, walletBalance: { $gte: withdrawFromStore } },
        {
          $inc: { walletBalance: -withdrawFromStore },
          $set: { updatedAt: new Date() },
        }
      )
    }

    if (withdrawFromUser > 0) {
      const updateResult = await User.updateOne(
        {
          _id: currentUser.id,
          walletBalance: { $gte: withdrawFromUser },
        },
        {
          $inc: { walletBalance: -withdrawFromUser },
          $set: { updatedAt: new Date() },
        }
      )

      if (updateResult.modifiedCount === 0) {
        return NextResponse.json(
          { success: false, error: 'Unable to process withdrawal right now. Please try again.' },
          { status: 400 }
        )
      }
    }

    const reference = `vendor_withdraw_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
    const payoutReference = `vwd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const transferReason = `Vendor wallet withdrawal to ${accountName}`

    let transferProvider = 'xoro_payout'
    let transferCode = ''
    let transferStatus = 'pending'
    let transferRecipientCode = ''
    let transferMeta: Record<string, any> = {}
    let xoroError = ''

    try {
      const recipient = await xoroPayService.createTransferRecipient({
        name: accountName,
        accountNumber: accountNumber.trim(),
        bankCode: bankCode.trim(),
      })

      if (recipient.success && recipient.recipientCode) {
        const transfer = await xoroPayService.initiateTransfer({
          amount: normalizedAmount,
          recipientCode: recipient.recipientCode,
          reference: payoutReference,
          reason: transferReason,
        })

        if (transfer.success && transfer.transferCode && transfer.status !== 'otp') {
          transferProvider = 'xoro_payout'
          transferCode = transfer.transferCode
          transferStatus = transfer.status || 'pending'
          transferRecipientCode = recipient.recipientCode
          transferMeta = {
            xoroRecipientRaw: recipient.raw || null,
            xoroTransferRaw: transfer.raw || null,
          }
        } else {
          xoroError = transfer.message || 'Xoro payout initiation failed'
        }
      } else {
        xoroError = recipient.message || 'Xoro payout recipient creation failed'
      }
    } catch (xoroFailure: any) {
      xoroError = xoroFailure?.message || 'Xoro payout request failed'
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

      console.warn('[vendor/wallet/withdraw] auto-transfer unavailable, queued for manual processing', {
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
      note: `Vendor withdrawal to ${accountName} (${bankName})`,
      metadata: {
        bankName,
        bankCode,
        accountNumber,
        accountName,
        payoutReference,
        transferCode,
        transferStatus,
        transferRecipientCode,
        vendorRole: true,
        ...transferMeta,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Fetch updated balance
    const [updatedUser, updatedStore] = await Promise.all([
      User.findById(currentUser.id).select('walletBalance').lean(),
      store?._id ? Store.findById(store._id).select('walletBalance').lean() : Promise.resolve(null),
    ])

    const updatedUserBalance = typeof updatedUser?.walletBalance === 'number' ? updatedUser.walletBalance : 0
    const updatedStoreBalance = typeof updatedStore?.walletBalance === 'number' ? updatedStore.walletBalance : 0
    const newBalance = updatedUserBalance + updatedStoreBalance

    return NextResponse.json({
      success: true,
      message: transferCode
        ? 'Withdrawal request submitted. Transfer is being processed.'
        : 'Withdrawal request submitted for manual processing.',
      reference,
      newBalance,
      balance: newBalance,
      breakdown: {
        userBalance: updatedUserBalance,
        storeBalance: updatedStoreBalance,
      },
    })
  } catch (error: any) {
    console.error('[vendor/wallet/withdraw] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to process withdrawal' },
      { status: 500 }
    )
  }
}
