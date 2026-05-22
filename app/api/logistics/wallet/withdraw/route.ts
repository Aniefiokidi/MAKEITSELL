import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { createTransferRecipient, fetchPaystackNgnBalance, initiateTransfer } from '@/lib/paystack-transfer'
import { logisticsEmailAllowedForRegion, resolveLogisticsRegion } from '@/lib/logistics-access'
import { enforceSameOrigin } from '@/lib/request-security'
import { enforceRateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'

const mapTransferStatusToTxStatus = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (
    ['success', 'successful', 'succeeded', 'completed', 'complete', 'paid', 'approved', 'ok', 'transferred', 'done', 'true'].includes(normalized)
    || normalized.includes('success')
    || normalized.includes('succeed')
    || normalized.includes('complete')
    || normalized.includes('paid')
    || normalized.includes('approve')
  ) return 'completed'
  if (
    ['failed', 'failure', 'reversed', 'declined', 'cancelled', 'canceled'].includes(normalized)
    || normalized.includes('fail')
    || normalized.includes('declin')
    || normalized.includes('cancel')
    || normalized.includes('revers')
  ) return 'failed'
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
      key: 'logistics-wallet-withdraw',
      maxRequests: 8,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const { amount, bankName, bankCode, accountNumber, accountName, region: regionParam } = body

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await getUserBySessionToken(sessionToken)
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const region = resolveLogisticsRegion(regionParam)
    if (!logisticsEmailAllowedForRegion(currentUser.email, region)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Validate amount
    const normalizedAmount = Math.round(Number(amount) * 100) / 100
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Please enter a valid withdrawal amount' }, { status: 400 })
    }
    if (normalizedAmount < 1000) {
      return NextResponse.json({ success: false, error: 'Minimum withdrawal is ₦1,000' }, { status: 400 })
    }

    // Validate bank details
    const cleanAccountNumber = normalizeAccountNumber(accountNumber)
    if (!bankName?.trim() || !bankCode?.trim() || !accountName?.trim() || !/^\d{10}$/.test(cleanAccountNumber)) {
      return NextResponse.json({ success: false, error: 'Enter bank name, bank code, account number and account name' }, { status: 400 })
    }

    await connectToDatabase()

    // Check Paystack payout balance first
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

    // Find the logistics company user
    const logisticsUser = await User.findOne({
      email: { $regex: new RegExp(`^${region.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).select('walletBalance payoutProfile').lean()

    if (!logisticsUser) {
      return NextResponse.json({ success: false, error: 'Logistics account not found' }, { status: 404 })
    }

    const userBalance = Number((logisticsUser as any).walletBalance || 0)
    if (userBalance < normalizedAmount) {
      return NextResponse.json({ success: false, error: 'Insufficient wallet balance for this withdrawal' }, { status: 400 })
    }

    // Atomically deduct balance
    const updateResult = await User.updateOne(
      { _id: (logisticsUser as any)._id, walletBalance: { $gte: normalizedAmount } },
      { $inc: { walletBalance: -normalizedAmount }, $set: { updatedAt: new Date() } }
    )
    if (updateResult.modifiedCount === 0) {
      return NextResponse.json({ success: false, error: 'Unable to process withdrawal right now. Please try again.' }, { status: 400 })
    }

    const reference = `lgst_wd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const payoutReference = `lgwd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`

    let transferCode = ''
    let transferStatus = 'pending'
    let transferRecipientCode = ''
    let payoutError = ''

    try {
      const storedProfile = (logisticsUser as any).payoutProfile && typeof (logisticsUser as any).payoutProfile === 'object'
        ? (logisticsUser as any).payoutProfile
        : {}

      const storedBankCode = normalizeText(storedProfile.bankCode)
      const storedAccountNumber = normalizeAccountNumber(storedProfile.accountNumber)
      const storedRecipientCode = normalizeText(storedProfile.paystackRecipientCode)

      const accountChanged = storedBankCode !== normalizeText(bankCode) || storedAccountNumber !== cleanAccountNumber

      const nextPayoutProfile: Record<string, any> = {
        provider: 'paystack',
        bankName,
        bankCode,
        accountNumber: cleanAccountNumber,
        accountName,
        updatedAt: new Date(),
      }

      let resolvedRecipientCode = !accountChanged ? storedRecipientCode : ''
      if (resolvedRecipientCode) {
        nextPayoutProfile.paystackRecipientCode = resolvedRecipientCode
        nextPayoutProfile.recipientCreatedAt = storedProfile.recipientCreatedAt || new Date()
      }

      await User.updateOne(
        { _id: (logisticsUser as any)._id },
        { $set: { payoutProfile: nextPayoutProfile, updatedAt: new Date() } }
      )

      if (!resolvedRecipientCode) {
        const recipient = await createTransferRecipient({
          name: accountName,
          accountNumber: cleanAccountNumber,
          bankCode: normalizeText(bankCode),
        })
        if (!recipient.success || !recipient.recipientCode) {
          throw new Error(recipient.message || 'Failed to create transfer recipient')
        }
        resolvedRecipientCode = recipient.recipientCode
        nextPayoutProfile.paystackRecipientCode = resolvedRecipientCode
        nextPayoutProfile.recipientCreatedAt = new Date()
        await User.updateOne(
          { _id: (logisticsUser as any)._id },
          { $set: { payoutProfile: nextPayoutProfile, updatedAt: new Date() } }
        )
      }

      transferRecipientCode = resolvedRecipientCode

      const transfer = await initiateTransfer({
        amount: normalizedAmount,
        recipientCode: resolvedRecipientCode,
        reference: payoutReference,
        reason: `Logistics wallet withdrawal to ${accountName}`,
      })

      if (transfer.success && transfer.transferCode) {
        transferCode = transfer.transferCode
        transferStatus = transfer.status || 'pending'
      } else {
        const providerStatus = String((transfer.raw as any)?.data?.status || (transfer.raw as any)?.status || '').trim()
        const providerMessage = String((transfer.raw as any)?.message || '').trim()
        payoutError = [transfer.message, providerMessage, providerStatus].filter(Boolean).join(' | ') || 'Paystack payout initiation failed'
      }
    } catch (err: any) {
      payoutError = err?.message || 'Paystack payout request failed'
    }

    // Roll back if transfer didn't go through
    if (!transferCode) {
      await User.updateOne(
        { _id: (logisticsUser as any)._id },
        { $inc: { walletBalance: normalizedAmount }, $set: { updatedAt: new Date() } }
      )
      return NextResponse.json({ success: false, error: toFriendlyPayoutError(payoutError) }, { status: 502 })
    }

    const txStatus = mapTransferStatusToTxStatus(transferStatus)

    await WalletTransaction.create({
      userId: String((logisticsUser as any)._id),
      type: 'withdrawal',
      amount: normalizedAmount,
      status: txStatus,
      reference,
      provider: 'paystack_payout',
      note: `Withdrawal to ${accountName} (${bankName})`,
      metadata: {
        bankName,
        bankCode,
        accountNumber: cleanAccountNumber,
        accountName,
        payoutReference,
        transferCode,
        transferStatus,
        transferRecipientCode,
        region: region.key,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const updatedUser = await User.findById((logisticsUser as any)._id).select('walletBalance').lean()
    const newBalance = Number((updatedUser as any)?.walletBalance || 0)

    return NextResponse.json({
      success: true,
      message: txStatus === 'completed'
        ? 'Withdrawal completed successfully.'
        : 'Withdrawal request submitted. Transfer is being processed.',
      newBalance,
    })
  } catch (error: any) {
    console.error('[logistics/wallet/withdraw]', error)
    return NextResponse.json({ success: false, error: 'Failed to process withdrawal' }, { status: 500 })
  }
}
