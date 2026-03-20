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

const normalizeAccountNumber = (value: any) => String(value || '').replace(/\D/g, '')
const normalizeText = (value: any) => String(value || '').trim()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const amount = Number(body?.amount)
    const bankName = String(body?.bankName || '').trim()
    const bankCode = String(body?.bankCode || '').trim()
    let bankCodeForPayout = bankCode
    const accountNumber = normalizeAccountNumber(body?.accountNumber)
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
    const minimumWithdrawal = Number(process.env.XORO_MIN_WITHDRAWAL_NGN || 1000)
    if (normalizedAmount < minimumWithdrawal) {
      return NextResponse.json(
        { success: false, error: `Minimum withdrawal is ${minimumWithdrawal}` },
        { status: 400 }
      )
    }

    await connectToDatabase()
    bankCodeForPayout = await xoroPayService.normalizeBankCodeForPayout(bankCode)

    const userForPin = await User.findOne(
      { _id: currentUser.id, role: 'customer' },
      { withdrawalPinHash: 1, payoutProfile: 1 }
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
      const storedProfile = userForPin?.payoutProfile && typeof userForPin.payoutProfile === 'object'
        ? userForPin.payoutProfile
        : {}
      const storedBankCode = normalizeText((storedProfile as any).bankCode)
      const storedAccountNumber = normalizeAccountNumber((storedProfile as any).accountNumber)
      const storedAccountName = normalizeText((storedProfile as any).accountName)
      const storedRecipientCode = normalizeText((storedProfile as any).xoroRecipientCode)

      const accountChanged = (
        storedBankCode !== normalizeText(bankCode)
        || storedAccountNumber !== normalizeAccountNumber(accountNumber)
        || storedAccountName.toLowerCase() !== normalizeText(accountName).toLowerCase()
      )

      const recipientCode = !accountChanged ? storedRecipientCode : ''

      const nextPayoutProfile: Record<string, any> = {
        provider: 'xoro',
        bankName,
        bankCode,
        accountNumber,
        accountName,
        updatedAt: new Date(),
      }
      if (recipientCode) {
        nextPayoutProfile.xoroRecipientCode = recipientCode
        nextPayoutProfile.recipientCreatedAt = (storedProfile as any).recipientCreatedAt || new Date()
      }

      await User.updateOne(
        { _id: currentUser.id },
        {
          $set: {
            payoutProfile: nextPayoutProfile,
            updatedAt: new Date(),
          },
        }
      )

      const xoroTransfer = await xoroPayService.initiateTransfer({
        amount: normalizedAmount,
        recipientCode,
        reference: payoutReference,
        reason: transferReason,
        accountNumber,
        bankCode: bankCodeForPayout,
        accountName,
        customerEmail: currentUser.email,
        customerName: currentUser.name || currentUser.email,
      })

      if (xoroTransfer.success && xoroTransfer.transferCode && xoroTransfer.status !== 'otp') {
        transferProvider = 'xoro_payout'
        transferCode = xoroTransfer.transferCode
        transferStatus = xoroTransfer.status || 'pending'
        transferRecipientCode = recipientCode
        transferMeta = {
          payoutProfileUsed: {
            bankName,
            bankCode,
            accountNumber,
            accountName,
            recipientCode,
            reusedStoredRecipient: Boolean(storedRecipientCode) && !accountChanged,
            accountChanged,
          },
          xoroTransferRaw: xoroTransfer.raw || null,
        }
      } else {
        const transferMsg = xoroTransfer.message || 'Xoro transfer initiation failed'
        xoroError = transferMsg
      }
    } catch (xoroFailure: any) {
      xoroError = xoroFailure?.message || 'Xoro transfer request failed'
    }

    if (!transferCode) {
      await User.updateOne(
        { _id: currentUser.id, role: 'customer' },
        {
          $inc: { walletBalance: normalizedAmount },
          $set: { updatedAt: new Date() },
        }
      )

      console.warn('[wallet/withdraw] auto-transfer unavailable, debit rolled back', {
        userId: String(currentUser.id),
        amount: normalizedAmount,
        bankCode,
        bankCodeForPayout,
        payoutReference,
        xoroError,
      })

      return NextResponse.json(
        {
          success: false,
          error: xoroError || 'Automatic payout failed. No funds were deducted. Please try again shortly.',
        },
        { status: 502 }
      )
    }

    await WalletTransaction.create({
      userId: String(currentUser.id),
      type: 'withdrawal',
      amount: normalizedAmount,
      status: mapTransferStatusToTxStatus(transferStatus),
      reference,
      provider: transferProvider,
      note: `Customer withdrawal to ${accountName} (${bankName})`,
      metadata: {
        bankName,
        bankCode,
        bankCodeForPayout,
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
      message: mapTransferStatusToTxStatus(transferStatus) === 'completed'
        ? 'Withdrawal completed successfully.'
        : transferCode
          ? 'Withdrawal request submitted. Transfer is being processed.'
          : 'Withdrawal request submitted.',
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
