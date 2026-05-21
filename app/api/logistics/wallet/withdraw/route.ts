import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { logisticsEmailAllowedForRegion, resolveLogisticsRegion } from '@/lib/logistics-access'
import { createTransferRecipient, fetchPaystackNgnBalance, initiateTransfer } from '@/lib/paystack-transfer'
import crypto from 'crypto'

const normalizeAccountNumber = (v: any) => String(v || '').replace(/\D/g, '')
const normalizeText = (v: any) => String(v || '').trim()

const toFriendlyError = (message: string) => {
  const n = String(message || '').toLowerCase()
  if (n.includes('balance is not enough') || n.includes('insufficient')) {
    return 'Payout provider balance is too low right now. Your wallet was not deducted. Please try again shortly.'
  }
  return String(message || '').trim() || 'Payout failed. No funds were deducted. Please try again.'
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { amount, bankCode, bankName, accountNumber, accountName, region: regionParam } = body

    const region = resolveLogisticsRegion(regionParam)
    if (!logisticsEmailAllowedForRegion(sessionUser.email, region)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Validate amount
    const normalizedAmount = Math.round(Number(amount) * 100) / 100
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Enter a valid withdrawal amount' }, { status: 400 })
    }
    if (normalizedAmount < 1000) {
      return NextResponse.json({ success: false, error: 'Minimum withdrawal is ₦1,000' }, { status: 400 })
    }

    // Validate bank details
    const cleanAccount = normalizeAccountNumber(accountNumber)
    if (!normalizeText(bankCode) || !normalizeText(accountName) || !/^\d{10}$/.test(cleanAccount)) {
      return NextResponse.json({ success: false, error: 'Enter bank, 10-digit account number, and account name' }, { status: 400 })
    }

    await connectToDatabase()

    const logisticsUser = await User.findOne({
      email: { $regex: new RegExp(`^${region.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).lean()

    if (!logisticsUser) {
      return NextResponse.json({ success: false, error: 'Logistics account not found' }, { status: 404 })
    }

    const currentBalance = Number((logisticsUser as any).walletBalance || 0)
    if (currentBalance < normalizedAmount) {
      return NextResponse.json({ success: false, error: 'Insufficient wallet balance' }, { status: 400 })
    }

    // Check Paystack payout balance
    const paystackBalance = await fetchPaystackNgnBalance()
    if (paystackBalance.success && Number(paystackBalance.availableNgn || 0) < normalizedAmount) {
      return NextResponse.json(
        { success: false, error: `Payout provider balance is ₦${Number(paystackBalance.availableNgn || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })} — below this withdrawal amount. Please try again later.` },
        { status: 502 }
      )
    }

    // Deduct balance atomically
    const deductResult = await User.updateOne(
      { _id: (logisticsUser as any)._id, walletBalance: { $gte: normalizedAmount } },
      { $inc: { walletBalance: -normalizedAmount }, $set: { updatedAt: new Date() } }
    )
    if (deductResult.modifiedCount === 0) {
      return NextResponse.json({ success: false, error: 'Unable to process withdrawal. Please try again.' }, { status: 400 })
    }

    // Paystack transfer
    const payoutReference = `lgst_wd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const reference = `logistics_withdraw_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
    let transferCode = ''
    let transferStatus = 'pending'
    let payoutError = ''

    try {
      const stored = (logisticsUser as any).payoutProfile || {}
      const accountChanged =
        normalizeText(stored.bankCode) !== normalizeText(bankCode) ||
        normalizeAccountNumber(stored.accountNumber) !== cleanAccount

      let recipientCode = !accountChanged ? normalizeText(stored.paystackRecipientCode) : ''

      if (!recipientCode) {
        const recipient = await createTransferRecipient({
          name: accountName,
          accountNumber: cleanAccount,
          bankCode: normalizeText(bankCode),
        })
        if (!recipient.success || !recipient.recipientCode) throw new Error(recipient.message || 'Failed to create recipient')
        recipientCode = recipient.recipientCode

        await User.updateOne(
          { _id: (logisticsUser as any)._id },
          {
            $set: {
              payoutProfile: { bankName, bankCode, accountNumber: cleanAccount, accountName, paystackRecipientCode: recipientCode, updatedAt: new Date() },
              updatedAt: new Date(),
            },
          }
        )
      }

      const transfer = await initiateTransfer({
        amount: normalizedAmount,
        recipientCode,
        reference: payoutReference,
        reason: `Logistics wallet withdrawal to ${accountName}`,
      })

      if (transfer.success && transfer.transferCode) {
        transferCode = transfer.transferCode
        transferStatus = transfer.status || 'pending'
      } else {
        payoutError = transfer.message || 'Transfer initiation failed'
      }
    } catch (err: any) {
      payoutError = err?.message || 'Transfer request failed'
    }

    // Roll back if transfer didn't go through
    if (!transferCode) {
      await User.updateOne(
        { _id: (logisticsUser as any)._id },
        { $inc: { walletBalance: normalizedAmount }, $set: { updatedAt: new Date() } }
      )
      return NextResponse.json({ success: false, error: toFriendlyError(payoutError) }, { status: 502 })
    }

    const txStatus = ['success', 'successful', 'completed'].includes(String(transferStatus).toLowerCase()) ? 'completed' : 'pending'

    await WalletTransaction.create({
      userId: String((logisticsUser as any)._id),
      type: 'withdrawal',
      amount: normalizedAmount,
      status: txStatus,
      reference,
      provider: 'paystack_payout',
      note: `Withdrawal to ${accountName} (${bankName || bankCode})`,
      metadata: { bankName, bankCode, accountNumber: cleanAccount, accountName, payoutReference, transferCode, transferStatus, region: region.key },
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const updated = await User.findById((logisticsUser as any)._id).select('walletBalance').lean()
    const newBalance = Number((updated as any)?.walletBalance || 0)

    return NextResponse.json({
      success: true,
      message: txStatus === 'completed' ? 'Withdrawal completed.' : 'Withdrawal submitted — transfer is being processed.',
      newBalance,
    })
  } catch (error: any) {
    console.error('[logistics/wallet/withdraw]', error)
    return NextResponse.json({ success: false, error: 'Failed to process withdrawal' }, { status: 500 })
  }
}
