// Shared customer-withdrawal logic — extracted from app/api/wallet/withdraw/route.ts, the
// same way lib/vendor-withdrawal.ts extracted the vendor route. Kept as its OWN parallel
// module rather than merged into lib/vendor-withdrawal.ts: that file's processVendorWithdrawal
// is already-shipped, tested money-movement code from earlier this session, and generalizing
// it into a role-branching function would risk regressing it for marginal reuse benefit. The
// two web routes were already independent before this, so this mirrors that same shape.
//
// verifyWithdrawalPin and toFriendlyPayoutError ARE reused as-is from lib/vendor-withdrawal.ts
// — both are already role-agnostic (PIN verification doesn't care about role; the error
// wording doesn't either), so there's nothing role-specific to duplicate there.
import crypto from 'crypto'
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { createTransferRecipient, fetchPaystackNgnBalance, initiateTransfer } from '@/lib/paystack-transfer'
import { toFriendlyPayoutError } from '@/lib/vendor-withdrawal'

export { verifyWithdrawalPin, toFriendlyPayoutError } from '@/lib/vendor-withdrawal'

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

// Recovery path for lib/whatsapp/customer-withdrawal.ts's PIN-lockout, mirroring
// lib/vendor-withdrawal.ts's clearWhatsAppWithdrawalLockout — a successful PIN
// verification on the web is a second factor (an authenticated app session) that clears
// the WhatsApp lockout immediately instead of forcing the full 30min wait.
export async function clearWhatsAppWithdrawalLockoutForCustomer(userId: string): Promise<void> {
  await connectToDatabase()
  await WhatsAppBuyer.updateOne(
    { customerId: userId },
    { $set: { withdrawalPinFailCount: 0, withdrawalPinLockedUntil: null, updatedAt: new Date() } }
  )
}

export type ProcessCustomerWithdrawalParams = {
  userId: string
  amount: number
  bankName: string
  bankCode: string
  accountNumber: string
  accountName: string
}

export type ProcessCustomerWithdrawalResult =
  | { success: true; message: string; reference: string; newBalance: number }
  | { success: false; error: string; status: number }

// Full body of app/api/wallet/withdraw/route.ts's POST handler, from just after the PIN
// check onward — unchanged behavior, only parameterized. No commission, no 3-bucket split
// (unlike the vendor version): a flat walletBalance deduction, the full amount transfers.
export async function processCustomerWithdrawal(params: ProcessCustomerWithdrawalParams): Promise<ProcessCustomerWithdrawalResult> {
  const { userId, bankName, bankCode, accountName } = params
  const normalizedAmount = Math.round(Number(params.amount) * 100) / 100

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return { success: false, error: 'Amount must be greater than zero', status: 400 }
  }

  const minimumWithdrawal = Number(process.env.PAYSTACK_MIN_WITHDRAWAL_NGN || 1000)
  if (normalizedAmount < minimumWithdrawal) {
    return { success: false, error: `Minimum withdrawal is ${minimumWithdrawal}`, status: 400 }
  }

  if (!bankName?.trim() || !bankCode?.trim() || !accountName?.trim() || !String(params.accountNumber || '').trim()) {
    return { success: false, error: 'Bank, account number and account name are required', status: 400 }
  }

  const cleanAccountNumber = normalizeAccountNumber(params.accountNumber)
  const bankCodeForPayout = String(bankCode || '').trim()
  if (!/^\d{10}$/.test(cleanAccountNumber)) {
    return { success: false, error: 'Account number must be 10 digits', status: 400 }
  }

  await connectToDatabase()

  const paystackBalance = await fetchPaystackNgnBalance()
  if (paystackBalance.success && Number(paystackBalance.availableNgn || 0) < normalizedAmount) {
    return {
      success: false,
      error: `Payout provider balance is currently ₦${Number(paystackBalance.availableNgn || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, which is below this withdrawal amount. Please try again after balance is funded.`,
      status: 502,
    }
  }

  const userForPin: any = await User.findOne(
    { _id: userId, role: 'customer' },
    { withdrawalPinHash: 1, payoutProfile: 1 }
  )

  const debitResult = await User.updateOne(
    { _id: userId, role: 'customer', walletBalance: { $gte: normalizedAmount } },
    { $inc: { walletBalance: -normalizedAmount }, $set: { updatedAt: new Date() } }
  )

  if (debitResult.modifiedCount === 0) {
    return { success: false, error: 'Insufficient wallet balance for this withdrawal', status: 400 }
  }

  const reference = `wallet_withdraw_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
  const payoutReference = `wd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const transferReason = `Customer wallet withdrawal to ${accountName}`

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

    await User.updateOne({ _id: userId }, { $set: { payoutProfile: nextPayoutProfile, updatedAt: new Date() } })

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
      await User.updateOne({ _id: userId }, { $set: { payoutProfile: nextPayoutProfile, updatedAt: new Date() } })
    }

    const transfer = await initiateTransfer({
      amount: normalizedAmount,
      recipientCode: resolvedRecipientCode,
      reference: payoutReference,
      reason: transferReason,
    })

    if (transfer.success && transfer.transferCode) {
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
      payoutError = [transfer.message, providerMessage, providerStatus].filter(Boolean).join(' | ') || 'Paystack transfer initiation failed'
    }
  } catch (transferFailure: any) {
    payoutError = transferFailure?.message || 'Paystack transfer request failed'
  }

  if (!transferCode) {
    await User.updateOne(
      { _id: userId, role: 'customer' },
      { $inc: { walletBalance: normalizedAmount }, $set: { updatedAt: new Date() } }
    )

    console.warn('[customer-withdrawal] auto-transfer unavailable, debit rolled back', {
      userId: String(userId),
      amount: normalizedAmount,
      bankCode,
      bankCodeForPayout,
      payoutReference,
      payoutError,
    })

    return { success: false, error: toFriendlyPayoutError(payoutError), status: 502 }
  }

  await WalletTransaction.create({
    userId: String(userId),
    type: 'withdrawal',
    amount: normalizedAmount,
    status: mapTransferStatusToTxStatus(transferStatus),
    reference,
    provider: 'paystack_payout',
    note: `Customer withdrawal to ${accountName} (${bankName})`,
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
      ...transferMeta,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const refreshedUser: any = await User.findOne({ _id: userId }, { walletBalance: 1 })
  const newBalance = typeof refreshedUser?.walletBalance === 'number' ? refreshedUser.walletBalance : 0

  if (mapTransferStatusToTxStatus(transferStatus) === 'completed') {
    try {
      const fullUser: any = await User.findById(userId).select('email').lean()
      if (fullUser?.email) {
        const { sendWalletWithdrawalEmail } = await import('@/lib/wallet-emails')
        await sendWalletWithdrawalEmail({ to: fullUser.email, amount: normalizedAmount, reference, balance: newBalance })
      }
    } catch (emailErr) {
      console.error('[customer-withdrawal] Failed to send withdrawal email:', emailErr)
    }
  }

  return {
    success: true,
    message: mapTransferStatusToTxStatus(transferStatus) === 'completed'
      ? 'Withdrawal completed successfully.'
      : transferCode
        ? 'Withdrawal request submitted. Transfer is being processed.'
        : 'Withdrawal request submitted.',
    reference,
    newBalance,
  }
}
