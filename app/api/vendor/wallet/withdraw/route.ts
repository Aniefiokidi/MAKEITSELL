import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { createTransferRecipient, fetchPaystackNgnBalance, initiateTransfer } from '@/lib/paystack-transfer'
import crypto from 'crypto'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/request-security'

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
const toFriendlyPayoutError = (message: string) => {
  const text = String(message || '').trim()
  const normalized = text.toLowerCase()
  if (
    normalized.includes('balance is not enough')
    || normalized.includes('insufficient balance')
    || normalized.includes('insufficient funds')
  ) {
    return 'Withdrawal could not be processed by payout provider right now. Your wallet balance was not deducted. Please try again shortly.'
  }
  return text || 'Automatic payout failed. No funds were deducted. Please try again shortly.'
}

export async function POST(request: NextRequest) {
  try {
    const originCheck = enforceSameOrigin(request)
    if (originCheck) return originCheck

    const rateLimitResponse = enforceRateLimit(request, {
      key: 'vendor-wallet-withdraw',
      maxRequests: 8,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

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
    const sessionToken = cookieStore.get('sessionToken')?.value

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

    const minimumWithdrawal = Number(process.env.PAYSTACK_MIN_WITHDRAWAL_NGN || 1000)
    if (normalizedAmount < minimumWithdrawal) {
      return NextResponse.json(
        { success: false, error: `Minimum withdrawal is ${minimumWithdrawal}` },
        { status: 400 }
      )
    }

    if (!bankName?.trim() || !bankCode?.trim() || !accountName?.trim() || !String(accountNumber || '').trim()) {
      return NextResponse.json(
        { success: false, error: 'Enter bank name, bank code, account number and account name' },
        { status: 400 }
      )
    }

    const cleanAccountNumber = normalizeAccountNumber(accountNumber)
    let bankCodeForPayout = String(bankCode || '').trim()
    if (!/^\d{10}$/.test(cleanAccountNumber)) {
      return NextResponse.json(
        { success: false, error: 'Account number must be 10 digits' },
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

    const paystackBalance = await fetchPaystackNgnBalance()
    if (paystackBalance.success && Number(paystackBalance.availableNgn || 0) < normalizedAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `Payout provider balance is currently ₦${Number(paystackBalance.availableNgn || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, which is below this withdrawal amount. Please try again after balance is funded.`,
        },
        { status: 502 }
      )
    }

    // Get user for PIN verification
    const userForPin = await User.findById(currentUser.id).select('withdrawalPinHash walletBalance payoutProfile').lean()

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

    const userBalance = typeof userForPin.walletBalance === 'number' ? userForPin.walletBalance : 0
    if (userBalance < normalizedAmount) {
      return NextResponse.json(
        { success: false, error: 'Insufficient wallet balance for this withdrawal' },
        { status: 400 }
      )
    }

    const updateResult = await User.updateOne(
      {
        _id: currentUser.id,
        walletBalance: { $gte: normalizedAmount },
      },
      {
        $inc: { walletBalance: -normalizedAmount },
        $set: { updatedAt: new Date() },
      }
    )

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Unable to process withdrawal right now. Please try again.' },
        { status: 400 }
      )
    }

    const reference = `vendor_withdraw_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
    const payoutReference = `vwd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const transferReason = `Vendor wallet withdrawal to ${accountName}`

    let transferProvider = 'paystack_payout'
    let transferCode = ''
    let transferStatus = 'pending'
    let transferRecipientCode = ''
    let transferMeta: Record<string, any> = {}
    let payoutError = ''

    try {
      const storedProfile = userForPin?.payoutProfile && typeof userForPin.payoutProfile === 'object'
        ? userForPin.payoutProfile
        : {}
      const storedBankCode = normalizeText((storedProfile as any).bankCode)
      const storedAccountNumber = normalizeAccountNumber((storedProfile as any).accountNumber)
      const storedAccountName = normalizeText((storedProfile as any).accountName)
      const storedRecipientCode = normalizeText((storedProfile as any).paystackRecipientCode)

      const accountChanged = (
        storedBankCode !== normalizeText(bankCode)
        || storedAccountNumber !== cleanAccountNumber
        || storedAccountName.toLowerCase() !== normalizeText(accountName).toLowerCase()
      )

      const recipientCode = !accountChanged ? storedRecipientCode : ''

      const nextPayoutProfile: Record<string, any> = {
        provider: 'paystack',
        bankName,
        bankCode,
        accountNumber: cleanAccountNumber,
        accountName,
        updatedAt: new Date(),
      }
      if (recipientCode) {
        nextPayoutProfile.paystackRecipientCode = recipientCode
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

      let resolvedRecipientCode = recipientCode
      if (!resolvedRecipientCode) {
        const recipient = await createTransferRecipient({
          name: accountName,
          accountNumber: cleanAccountNumber,
          bankCode: bankCodeForPayout,
        })
        if (!recipient.success || !recipient.recipientCode) {
          throw new Error(recipient.message || 'Failed to create transfer recipient')
        }
        resolvedRecipientCode = recipient.recipientCode
        nextPayoutProfile.paystackRecipientCode = resolvedRecipientCode
        nextPayoutProfile.recipientCreatedAt = new Date()
        await User.updateOne({ _id: currentUser.id }, { $set: { payoutProfile: nextPayoutProfile, updatedAt: new Date() } })
      }

      const transfer = await initiateTransfer({
        amount: normalizedAmount,
        recipientCode: resolvedRecipientCode,
        reference: payoutReference,
        reason: transferReason,
      })

      if (transfer.success && transfer.transferCode) {
        transferProvider = 'paystack_payout'
        transferCode = transfer.transferCode
        transferStatus = transfer.status || 'pending'
        transferRecipientCode = resolvedRecipientCode
        transferMeta = {
          payoutProfileUsed: {
            bankName,
            bankCode,
            accountNumber: cleanAccountNumber,
            accountName,
            recipientCode,
            reusedStoredRecipient: Boolean(storedRecipientCode) && !accountChanged,
            accountChanged,
          },
          paystackTransferRaw: transfer.raw || null,
        }
      } else {
        const providerStatus = String((transfer.raw as any)?.data?.status || (transfer.raw as any)?.status || '').trim()
        const providerMessage = String((transfer.raw as any)?.message || '').trim()
        const transferMsg = [transfer.message, providerMessage, providerStatus].filter(Boolean).join(' | ') || 'Paystack payout initiation failed'
        payoutError = transferMsg
      }
    } catch (transferFailure: any) {
      payoutError = transferFailure?.message || 'Paystack payout request failed'
    }

    if (!transferCode) {
      await User.updateOne(
        { _id: currentUser.id },
        {
          $inc: { walletBalance: normalizedAmount },
          $set: { updatedAt: new Date() },
        }
      )

      console.warn('[vendor/wallet/withdraw] auto-transfer unavailable, debit rolled back', {
        userId: String(currentUser.id),
        amount: normalizedAmount,
        bankCode,
        bankCodeForPayout,
        payoutReference,
        payoutError,
      })

      return NextResponse.json(
        {
          success: false,
          error: toFriendlyPayoutError(payoutError),
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
      note: `Vendor withdrawal to ${accountName} (${bankName})`,
      metadata: {
        bankName,
        bankCode,
        bankCodeForPayout,
        accountNumber: cleanAccountNumber,
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
    const updatedUser = await User.findById(currentUser.id).select('walletBalance').lean()
    const newBalance = typeof updatedUser?.walletBalance === 'number' ? updatedUser.walletBalance : 0

    return NextResponse.json({
      success: true,
      message: mapTransferStatusToTxStatus(transferStatus) === 'completed'
        ? 'Withdrawal completed successfully.'
        : transferCode
          ? 'Withdrawal request submitted. Transfer is being processed.'
          : 'Withdrawal request submitted.',
      reference,
      newBalance,
      balance: newBalance,
    })
  } catch (error: any) {
    console.error('[vendor/wallet/withdraw] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process withdrawal' },
      { status: 500 }
    )
  }
}
