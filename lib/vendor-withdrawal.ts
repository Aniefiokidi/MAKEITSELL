// Shared vendor-withdrawal logic — extracted from app/api/vendor/wallet/withdraw/route.ts
// (and calcWithdrawalBreakdown from its sibling preview/route.ts) so both the web route
// and the new WhatsApp withdrawal flow (lib/whatsapp/vendor-withdrawal.ts) execute the
// exact same money-moving code, the same way lib/booking-payment.ts's
// initiateBookingPayment is shared between the web booking route and the WhatsApp booking
// flow. No behavior change from the original route — this is a straight extraction.
//
// verifyWithdrawalPin is deliberately its OWN function, never folded into
// processVendorWithdrawal — PIN-lockout policy differs per channel (the web route has
// none; the WhatsApp flow needs one, since a 4-digit PIN is only 10,000 combinations and
// chat is a more exposed surface). Every caller must explicitly verify the PIN itself
// before calling processVendorWithdrawal; there is no way to skip that check by accident.
import crypto from 'crypto'
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { WhatsAppLink } from '@/lib/models/WhatsAppLink'
import { createTransferRecipient, fetchPaystackNgnBalance, initiateTransfer } from '@/lib/paystack-transfer'

export function calcWithdrawalBreakdown(
  amount: number,
  earnedBalance: number,
  depositedBalance: number,
  prizeBalance: number
) {
  const withdrawFromDeposited = Math.min(depositedBalance, amount)
  let remaining = amount - withdrawFromDeposited

  const withdrawFromPrize = Math.min(prizeBalance, remaining)
  remaining = remaining - withdrawFromPrize

  const withdrawFromEarned = remaining
  const commission = Math.round(withdrawFromEarned * 0.05 * 100) / 100
  const vendorReceives = Math.round((amount - commission) * 100) / 100

  return {
    withdrawFromDeposited,
    withdrawFromPrize,
    withdrawFromEarned,
    commission,
    vendorReceives,
  }
}

function hashWithdrawalPin(pin: string, userId: string): string {
  return crypto.createHash('sha256').update(`${pin}:${userId}`).digest('hex')
}

export async function verifyWithdrawalPin(userId: string, pin: string): Promise<{ hasPinSet: boolean; valid: boolean }> {
  await connectToDatabase()
  const user: any = await User.findById(userId).select('withdrawalPinHash').lean()
  if (!user?.withdrawalPinHash) return { hasPinSet: false, valid: false }
  const providedHash = hashWithdrawalPin(String(pin || '').trim(), String(userId))
  return { hasPinSet: true, valid: user.withdrawalPinHash === providedHash }
}

// Recovery path for lib/whatsapp/vendor-withdrawal.ts's PIN-lockout: a successful PIN
// verification on the WEB counts as a second factor proving legitimate access (it
// requires an authenticated app session, not just guesses sent to a possibly-hijacked
// WhatsApp number), so it clears the WhatsApp lockout immediately rather than making a
// locked-out-but-legitimate vendor wait out the full cooldown. Called from the web
// withdraw route right after its own PIN check succeeds. No-ops harmlessly if the vendor
// has no WhatsAppLink doc at all.
export async function clearWhatsAppWithdrawalLockout(userId: string): Promise<void> {
  await connectToDatabase()
  await WhatsAppLink.updateOne(
    { vendorId: userId },
    { $set: { withdrawalPinFailCount: 0, withdrawalPinLockedUntil: null, updatedAt: new Date() } }
  )
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
export const toFriendlyPayoutError = (message: string) => {
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

export type ProcessVendorWithdrawalParams = {
  userId: string
  amount: number
  bankName: string
  bankCode: string
  accountNumber: string
  accountName: string
}

export type ProcessVendorWithdrawalResult =
  | {
      success: true
      message: string
      reference: string
      newBalance: number
      commissionBreakdown: {
        withdrawFromDeposited: number
        withdrawFromPrize: number
        withdrawFromEarned: number
        commission: number
        vendorReceives: number
      }
    }
  | { success: false; error: string; status: number }

// Full body of the withdraw route's POST handler, from just after the PIN check onward —
// unchanged behavior, only parameterized. Callers must have already verified the PIN via
// verifyWithdrawalPin (this function does not re-check it).
export async function processVendorWithdrawal(params: ProcessVendorWithdrawalParams): Promise<ProcessVendorWithdrawalResult> {
  const { userId, bankName, bankCode, accountName } = params
  const normalizedAmount = Math.round(Number(params.amount) * 100) / 100

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return { success: false, error: 'Please enter a valid withdrawal amount', status: 400 }
  }

  const minimumWithdrawal = Number(process.env.PAYSTACK_MIN_WITHDRAWAL_NGN || 1000)
  if (normalizedAmount < minimumWithdrawal) {
    return { success: false, error: `Minimum withdrawal is ${minimumWithdrawal}`, status: 400 }
  }

  if (!bankName?.trim() || !bankCode?.trim() || !accountName?.trim() || !String(params.accountNumber || '').trim()) {
    return { success: false, error: 'Enter bank name, bank code, account number and account name', status: 400 }
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

  const userForPin: any = await User.findById(userId)
    .select('walletBalance earnedBalance depositedBalance prizeBalance payoutProfile')
    .lean()

  const walletBalance = typeof userForPin?.walletBalance === 'number' ? userForPin.walletBalance : 0
  if (walletBalance < normalizedAmount) {
    return { success: false, error: 'Insufficient wallet balance for this withdrawal', status: 400 }
  }

  const earnedBalance = typeof userForPin?.earnedBalance === 'number' ? userForPin.earnedBalance : 0
  const depositedBalance = typeof userForPin?.depositedBalance === 'number' ? userForPin.depositedBalance : 0
  const prizeBalance = typeof userForPin?.prizeBalance === 'number' ? userForPin.prizeBalance : 0

  const {
    withdrawFromDeposited,
    withdrawFromPrize,
    withdrawFromEarned,
    commission,
    vendorReceives,
  } = calcWithdrawalBreakdown(normalizedAmount, earnedBalance, depositedBalance, prizeBalance)

  const deductInc: Record<string, number> = { walletBalance: -normalizedAmount }
  if (withdrawFromEarned > 0) deductInc.earnedBalance = -withdrawFromEarned
  if (withdrawFromDeposited > 0) deductInc.depositedBalance = -withdrawFromDeposited
  if (withdrawFromPrize > 0) deductInc.prizeBalance = -withdrawFromPrize

  const updateResult = await User.updateOne(
    { _id: userId, walletBalance: { $gte: normalizedAmount } },
    { $inc: deductInc, $set: { updatedAt: new Date() } }
  )

  if (updateResult.modifiedCount === 0) {
    return { success: false, error: 'Unable to process withdrawal right now. Please try again.', status: 400 }
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
      { _id: userId },
      { $set: { payoutProfile: nextPayoutProfile, updatedAt: new Date() } }
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
      await User.updateOne({ _id: userId }, { $set: { payoutProfile: nextPayoutProfile, updatedAt: new Date() } })
    }

    const transfer = await initiateTransfer({
      amount: vendorReceives,
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
      payoutError = [transfer.message, providerMessage, providerStatus].filter(Boolean).join(' | ') || 'Paystack payout initiation failed'
    }
  } catch (transferFailure: any) {
    payoutError = transferFailure?.message || 'Paystack payout request failed'
  }

  if (!transferCode) {
    const restoreInc: Record<string, number> = { walletBalance: normalizedAmount }
    if (withdrawFromEarned > 0) restoreInc.earnedBalance = withdrawFromEarned
    if (withdrawFromDeposited > 0) restoreInc.depositedBalance = withdrawFromDeposited
    if (withdrawFromPrize > 0) restoreInc.prizeBalance = withdrawFromPrize

    await User.updateOne(
      { _id: userId },
      { $inc: restoreInc, $set: { updatedAt: new Date() } }
    )

    console.warn('[vendor-withdrawal] auto-transfer unavailable, debit rolled back', {
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
      commissionBreakdown: {
        withdrawFromDeposited,
        withdrawFromPrize,
        withdrawFromEarned,
        commission,
        vendorReceives,
      },
      ...transferMeta,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const updatedUser: any = await User.findById(userId)
    .select('walletBalance earnedBalance depositedBalance prizeBalance')
    .lean()

  const newBalance = typeof updatedUser?.walletBalance === 'number' ? updatedUser.walletBalance : 0

  return {
    success: true,
    message: mapTransferStatusToTxStatus(transferStatus) === 'completed'
      ? 'Withdrawal completed successfully.'
      : transferCode
        ? 'Withdrawal request submitted. Transfer is being processed.'
        : 'Withdrawal request submitted.',
    reference,
    newBalance,
    commissionBreakdown: {
      withdrawFromDeposited,
      withdrawFromPrize,
      withdrawFromEarned,
      commission,
      vendorReceives,
    },
  }
}
