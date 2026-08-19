// WhatsApp withdrawal — a full chat flow including PIN entry, by explicit product
// decision (the tradeoff — PIN and confirmations living in WhatsApp chat history/
// notification previews — was acknowledged and accepted). This file's job is to make that
// as safe as possible within that constraint: a strict PIN-attempt lockout (a 4-digit PIN
// is only 10,000 combinations) with an out-of-band alert, and — separately — restricting
// WhatsApp withdrawal to vendors who already have a saved payout account from a prior web
// withdrawal (see startWithdrawal below), since first-time bank-detail entry over chat
// would mean either skipping Paystack's account-name resolution entirely or building a new
// confirmation flow for it — out of scope here.
//
// State lives on WhatsAppLink (lib/models/WhatsAppLink.ts) — see that model's comment for
// why. A non-'idle' withdrawalStage is checked BEFORE every other vendor command in
// lib/whatsapp/commands.ts, the same "blocking stage owns the whole next message"
// precedent QUOTE_BLOCKING_STAGES uses for buyers.
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WhatsAppLink } from '@/lib/models/WhatsAppLink'
import { sendTextMessage } from '@/lib/whatsapp/client'
import { pushToUser } from '@/lib/push-notifications'
import { emailService } from '@/lib/email'
import { calcWithdrawalBreakdown, verifyWithdrawalPin, processVendorWithdrawal } from '@/lib/vendor-withdrawal'

const WITHDRAWAL_ENTRY_PATTERN = /^withdraw(\s+([\d,]+(?:\.\d+)?))?$/i
const PIN_PATTERN = /^\d{4}$/
const STAGE_TTL_MS = 5 * 60 * 1000
const MAX_PIN_ATTEMPTS = 3
const LOCKOUT_MS = 30 * 60 * 1000

async function trySend(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-vendor-withdrawal] Text send failed for ${waId}:`, error)
  }
}

function formatNaira(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}

function maskAccountNumber(accountNumber: string): string {
  const digits = String(accountNumber || '').replace(/\D/g, '')
  if (digits.length <= 4) return digits
  return `••••${digits.slice(-4)}`
}

async function saveState(vendorId: string, patch: Record<string, any>): Promise<void> {
  await connectToDatabase()
  await WhatsAppLink.updateOne({ vendorId }, { $set: { ...patch, updatedAt: new Date() } })
}

async function resetWithdrawalState(vendorId: string): Promise<void> {
  await saveState(vendorId, { withdrawalStage: 'idle', withdrawalDraft: {}, withdrawalStageExpiresAt: null })
}

// ---------------------------------------------------------------------------
// Entry point — dispatched from lib/whatsapp/commands.ts, checked before every other
// vendor command. Returns false only when the vendor is idle AND the message isn't a
// "withdraw" entry — i.e. this genuinely isn't ours to handle, let the caller try other
// commands. Every other case is fully consumed here (returns true).
// ---------------------------------------------------------------------------

export async function tryHandleWithdrawalFlow(waId: string, vendorId: string, text: string): Promise<boolean> {
  await connectToDatabase()
  const link: any = await WhatsAppLink.findOne({ vendorId }).lean()
  const trimmed = String(text || '').trim()
  const lower = trimmed.toLowerCase()

  const stageExpired = Boolean(link?.withdrawalStageExpiresAt) && new Date(link.withdrawalStageExpiresAt).getTime() < Date.now()
  const stage = stageExpired ? 'idle' : String(link?.withdrawalStage || 'idle')

  if (stage !== 'idle') {
    if (lower === 'cancel') {
      await resetWithdrawalState(vendorId)
      await trySend(waId, 'Withdrawal cancelled.')
      return true
    }
    await handleStageMessage(waId, vendorId, stage, trimmed, link?.withdrawalDraft || {})
    return true
  }

  const entryMatch = trimmed.match(WITHDRAWAL_ENTRY_PATTERN)
  if (!entryMatch) return false

  await startWithdrawal(waId, vendorId, link, entryMatch[2])
  return true
}

async function handleStageMessage(waId: string, vendorId: string, stage: string, text: string, draft: Record<string, any>): Promise<void> {
  switch (stage) {
    case 'awaiting_amount':
      await handleAmountReply(waId, vendorId, text)
      return
    case 'awaiting_bank_choice':
      await handleBankChoiceReply(waId, vendorId, text, draft)
      return
    case 'awaiting_pin':
      await handlePinReply(waId, vendorId, text, draft)
      return
    case 'awaiting_confirmation':
      await handleConfirmationReply(waId, vendorId, text, draft)
      return
    default:
      await resetWithdrawalState(vendorId)
      return
  }
}

// ---------------------------------------------------------------------------
// Stage 1 — start
// ---------------------------------------------------------------------------

async function startWithdrawal(waId: string, vendorId: string, link: any, rawAmount?: string): Promise<void> {
  if (link?.withdrawalPinLockedUntil && new Date(link.withdrawalPinLockedUntil).getTime() > Date.now()) {
    const mins = Math.max(1, Math.ceil((new Date(link.withdrawalPinLockedUntil).getTime() - Date.now()) / 60000))
    await trySend(
      waId,
      `Withdrawals from WhatsApp are temporarily locked after too many incorrect PIN attempts. Try again in about ${mins} minute${mins === 1 ? '' : 's'} — or withdraw from the Make It Sell app now, which also unlocks WhatsApp withdrawal immediately.`
    )
    return
  }

  await connectToDatabase()
  const user: any = await User.findById(vendorId).select('withdrawalPinHash payoutProfile').lean()

  if (!user?.withdrawalPinHash) {
    await trySend(waId, "You haven't set a withdrawal PIN yet — set one in the Make It Sell app first, then you can withdraw from WhatsApp.")
    return
  }

  const profile = user?.payoutProfile
  if (!profile?.paystackRecipientCode || !profile?.accountNumber) {
    await trySend(
      waId,
      "Your first withdrawal needs to be done from the Make It Sell app. After that, you can withdraw from WhatsApp using the same saved account."
    )
    return
  }

  if (rawAmount) {
    const amount = Number(rawAmount.replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) {
      await trySend(waId, 'That amount doesn\'t look right. Reply like: withdraw 5000')
      return
    }
    await promptBankConfirmation(waId, vendorId, profile, amount)
    return
  }

  await saveState(vendorId, {
    withdrawalStage: 'awaiting_amount',
    withdrawalDraft: {},
    withdrawalStageExpiresAt: new Date(Date.now() + STAGE_TTL_MS),
  })
  const min = Number(process.env.PAYSTACK_MIN_WITHDRAWAL_NGN || 1000)
  await trySend(waId, `How much would you like to withdraw? (Minimum ${formatNaira(min)})\n\nReply "cancel" to stop.`)
}

// ---------------------------------------------------------------------------
// Stage 2 — amount
// ---------------------------------------------------------------------------

async function handleAmountReply(waId: string, vendorId: string, text: string): Promise<void> {
  const amount = Number(String(text || '').trim().replace(/,/g, ''))
  const min = Number(process.env.PAYSTACK_MIN_WITHDRAWAL_NGN || 1000)

  if (!Number.isFinite(amount) || amount <= 0) {
    await trySend(waId, 'Please reply with just a number, e.g. 5000. Or reply "cancel" to stop.')
    return
  }
  if (amount < min) {
    await trySend(waId, `Minimum withdrawal is ${formatNaira(min)}. Please enter a higher amount, or reply "cancel".`)
    return
  }

  await connectToDatabase()
  const user: any = await User.findById(vendorId).select('payoutProfile').lean()
  const profile = user?.payoutProfile
  if (!profile?.paystackRecipientCode) {
    await resetWithdrawalState(vendorId)
    await trySend(waId, 'Your first withdrawal needs to be done from the Make It Sell app.')
    return
  }

  await promptBankConfirmation(waId, vendorId, profile, amount)
}

async function promptBankConfirmation(waId: string, vendorId: string, profile: any, amount: number): Promise<void> {
  await saveState(vendorId, {
    withdrawalStage: 'awaiting_bank_choice',
    withdrawalDraft: { amount },
    withdrawalStageExpiresAt: new Date(Date.now() + STAGE_TTL_MS),
  })
  await trySend(
    waId,
    `Withdraw ${formatNaira(amount)} to ${profile.bankName} ${maskAccountNumber(profile.accountNumber)} — ${profile.accountName}?\n\nReply "yes" to continue, or "cancel" to stop.\n\n(To use a different account, please do this from the app.)`
  )
}

// ---------------------------------------------------------------------------
// Stage 3 — confirm saved bank account
// ---------------------------------------------------------------------------

async function handleBankChoiceReply(waId: string, vendorId: string, text: string, draft: Record<string, any>): Promise<void> {
  const lower = String(text || '').trim().toLowerCase()
  if (lower !== 'yes' && lower !== 'confirm') {
    await trySend(waId, 'To use a different account, please do this from the Make It Sell app. Reply "yes" to continue with your saved account, or "cancel" to stop.')
    return
  }

  await connectToDatabase()
  const user: any = await User.findById(vendorId).select('payoutProfile').lean()
  const profile = user?.payoutProfile
  if (!profile?.paystackRecipientCode) {
    await resetWithdrawalState(vendorId)
    await trySend(waId, "Couldn't find your saved payout account — please withdraw from the app once, then try WhatsApp again.")
    return
  }

  const nextDraft: Record<string, any> = {
    ...draft,
    bankName: profile.bankName,
    bankCode: profile.bankCode,
    accountNumber: profile.accountNumber,
    accountName: profile.accountName,
  }
  await saveState(vendorId, {
    withdrawalStage: 'awaiting_pin',
    withdrawalDraft: nextDraft,
    withdrawalStageExpiresAt: new Date(Date.now() + STAGE_TTL_MS),
  })
  await trySend(waId, `Enter your 4-digit withdrawal PIN to confirm ${formatNaira(nextDraft.amount)} to ${profile.bankName} ${maskAccountNumber(profile.accountNumber)}.`)
}

// ---------------------------------------------------------------------------
// Stage 4 — PIN, with lockout
// ---------------------------------------------------------------------------

async function handlePinReply(waId: string, vendorId: string, text: string, draft: Record<string, any>): Promise<void> {
  const trimmed = String(text || '').trim()

  if (!PIN_PATTERN.test(trimmed)) {
    // A malformed reply is a format error, not a wrong-PIN guess — doesn't count toward
    // the lockout threshold.
    await trySend(waId, 'Please reply with just your 4-digit PIN, or "cancel" to stop.')
    return
  }

  const pinCheck = await verifyWithdrawalPin(vendorId, trimmed)

  if (!pinCheck.valid) {
    await connectToDatabase()
    const updated: any = await WhatsAppLink.findOneAndUpdate(
      { vendorId },
      { $inc: { withdrawalPinFailCount: 1 }, $set: { updatedAt: new Date() } },
      { new: true }
    ).lean()

    const failCount = Number(updated?.withdrawalPinFailCount || 0)

    if (failCount >= MAX_PIN_ATTEMPTS) {
      await saveState(vendorId, {
        withdrawalStage: 'idle',
        withdrawalDraft: {},
        withdrawalStageExpiresAt: null,
        withdrawalPinLockedUntil: new Date(Date.now() + LOCKOUT_MS),
        withdrawalPinFailCount: 0,
      })
      await trySend(
        waId,
        "Too many incorrect PIN attempts. Withdrawals from WhatsApp are locked for 30 minutes. You can withdraw from the Make It Sell app instead — doing so also unlocks WhatsApp withdrawal right away. If this wasn't you, please secure your account."
      )
      console.warn(`[whatsapp-vendor-withdrawal] PIN lockout for vendor ${vendorId}`)
      notifyPinLockout(vendorId).catch(() => {})
      return
    }

    await trySend(waId, `Incorrect PIN (attempt ${failCount} of ${MAX_PIN_ATTEMPTS}). Try again, or reply "cancel" to stop.`)
    return
  }

  await WhatsAppLink.updateOne({ vendorId }, { $set: { withdrawalPinFailCount: 0, withdrawalPinLockedUntil: null } })

  const amount = Number(draft.amount || 0)
  const user: any = await User.findById(vendorId).select('earnedBalance depositedBalance prizeBalance').lean()
  const breakdown = calcWithdrawalBreakdown(
    amount,
    Number(user?.earnedBalance || 0),
    Number(user?.depositedBalance || 0),
    Number(user?.prizeBalance || 0)
  )

  await saveState(vendorId, {
    withdrawalStage: 'awaiting_confirmation',
    withdrawalStageExpiresAt: new Date(Date.now() + STAGE_TTL_MS),
  })

  await trySend(
    waId,
    `You'll receive ${formatNaira(breakdown.vendorReceives)} (after ${formatNaira(breakdown.commission)} fee) to ${draft.bankName} ${maskAccountNumber(draft.accountNumber)}.\n\nReply "confirm" to send it, or "cancel" to stop.`
  )
}

async function notifyPinLockout(vendorId: string): Promise<void> {
  try {
    await connectToDatabase()
    const user: any = await User.findById(vendorId).select('email name').lean()
    await Promise.allSettled([
      pushToUser(vendorId, {
        title: 'Withdrawal PIN Locked',
        body: "Multiple incorrect withdrawal PIN attempts on your WhatsApp-linked number. You can still withdraw from the app — if this wasn't you, secure your account.",
        url: '/vendor/wallet',
        tag: `withdrawal-pin-lockout-${vendorId}-${Date.now()}`,
      }),
      user?.email
        ? emailService.sendEmail({
            to: user.email,
            subject: 'Security alert: multiple incorrect withdrawal PIN attempts',
            html: `<p>Hi ${user.name || 'there'},</p><p>There were multiple incorrect withdrawal PIN attempts on your Make It Sell WhatsApp-linked number. Withdrawals from WhatsApp are locked for 30 minutes.</p><p>If this was you, you can withdraw from the app right now — entering your PIN there also clears the WhatsApp lock immediately, no need to wait.</p><p>If this wasn't you, please secure your account and consider resetting your withdrawal PIN from the app.</p>`,
          })
        : Promise.resolve(),
    ])
  } catch (error) {
    console.error(`[whatsapp-vendor-withdrawal] notifyPinLockout failed for vendor ${vendorId}:`, error)
  }
}

// ---------------------------------------------------------------------------
// Stage 5 — final confirmation, executes the withdrawal
// ---------------------------------------------------------------------------

async function handleConfirmationReply(waId: string, vendorId: string, text: string, draft: Record<string, any>): Promise<void> {
  const lower = String(text || '').trim().toLowerCase()
  if (lower !== 'confirm' && lower !== 'yes') {
    await resetWithdrawalState(vendorId)
    await trySend(waId, 'Withdrawal cancelled.')
    return
  }

  // Reset state BEFORE calling processVendorWithdrawal — a double-tapped "confirm" while
  // this is in flight then just falls through as an unrecognized command instead of
  // re-entering this stage. The atomic walletBalance:{$gte} guard inside
  // processVendorWithdrawal is the real safety net either way.
  await resetWithdrawalState(vendorId)

  const result = await processVendorWithdrawal({
    userId: vendorId,
    amount: Number(draft.amount || 0),
    bankName: draft.bankName,
    bankCode: draft.bankCode,
    accountNumber: draft.accountNumber,
    accountName: draft.accountName,
  })

  if (!result.success) {
    await trySend(waId, `Couldn't complete that withdrawal: ${result.error}`)
    return
  }

  await trySend(
    waId,
    `${result.message}\n\nYou'll receive ${formatNaira(result.commissionBreakdown.vendorReceives)}. New wallet balance: ${formatNaira(result.newBalance)}.`
  )
}
