// Customer withdrawal via WhatsApp — mirrors lib/whatsapp/vendor-withdrawal.ts's exact
// 5-stage flow (amount -> confirm saved bank account -> PIN with lockout -> confirm ->
// execute) and lockout design (3 wrong PINs -> 30min lockout, out-of-band push+email
// alert, recovery via a successful web PIN entry). Kept as an independent, parallel file
// rather than sharing code with the vendor conversation module — same "don't touch
// already-shipped flows for marginal reuse" reasoning as lib/customer-withdrawal.ts vs
// lib/vendor-withdrawal.ts. The one real difference: no commission/3-bucket recap in the
// confirmation message — customer withdrawal has zero fee, the full amount transfers.
//
// Unlike the vendor flow (state on WhatsAppLink, found by vendorId), state here lives on
// WhatsAppBuyer, found by waId — and requires an EXISTING mapping to even start (no
// placeholder account auto-created just because someone typed "withdraw"; same
// bail-gracefully precedent lib/whatsapp/buyer.ts's sendOrderStatus/sendMyBookings use).
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { sendTextMessage } from '@/lib/whatsapp/client'
import { pushToUser } from '@/lib/push-notifications'
import { emailService } from '@/lib/email'
import { verifyWithdrawalPin, processCustomerWithdrawal } from '@/lib/customer-withdrawal'

const WITHDRAWAL_ENTRY_PATTERN = /^withdraw(\s+([\d,]+(?:\.\d+)?))?$/i
const PIN_PATTERN = /^\d{4}$/
const STAGE_TTL_MS = 5 * 60 * 1000
const MAX_PIN_ATTEMPTS = 3
const LOCKOUT_MS = 30 * 60 * 1000

async function trySend(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-customer-withdrawal] Text send failed for ${waId}:`, error)
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

async function saveState(waId: string, patch: Record<string, any>): Promise<void> {
  await connectToDatabase()
  await WhatsAppBuyer.updateOne({ waId }, { $set: { ...patch, updatedAt: new Date() } })
}

async function resetWithdrawalState(waId: string): Promise<void> {
  await saveState(waId, { withdrawalStage: 'idle', withdrawalDraft: {}, withdrawalStageExpiresAt: null })
}

// ---------------------------------------------------------------------------
// Entry point — checked at the very top of lib/whatsapp/buyer.ts's handleBuyerMessage,
// before anything else. Returns false only when the message doesn't match the withdrawal
// entry pattern at all AND there's no active stage — i.e. genuinely not ours.
// ---------------------------------------------------------------------------

export async function tryHandleCustomerWithdrawalFlow(waId: string, text: string): Promise<boolean> {
  await connectToDatabase()
  const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()
  const trimmed = String(text || '').trim()
  const lower = trimmed.toLowerCase()

  const stageExpired = Boolean(mapping?.withdrawalStageExpiresAt) && new Date(mapping.withdrawalStageExpiresAt).getTime() < Date.now()
  const stage = stageExpired ? 'idle' : String(mapping?.withdrawalStage || 'idle')

  if (stage !== 'idle') {
    if (lower === 'cancel') {
      await resetWithdrawalState(waId)
      await trySend(waId, 'Withdrawal cancelled.')
      return true
    }
    await handleStageMessage(waId, mapping.customerId, stage, trimmed, mapping?.withdrawalDraft || {})
    return true
  }

  const entryMatch = trimmed.match(WITHDRAWAL_ENTRY_PATTERN)
  if (!entryMatch) return false

  if (!mapping?.customerId) {
    await trySend(waId, "You don't have an account with us yet — place an order first, then you'll be able to withdraw from your wallet.")
    return true
  }

  await startWithdrawal(waId, mapping.customerId, mapping, entryMatch[2])
  return true
}

function handleStageMessage(waId: string, customerId: string, stage: string, text: string, draft: Record<string, any>): Promise<void> {
  switch (stage) {
    case 'awaiting_amount':
      return handleAmountReply(waId, customerId, text)
    case 'awaiting_bank_choice':
      return handleBankChoiceReply(waId, customerId, text, draft)
    case 'awaiting_pin':
      return handlePinReply(waId, customerId, text, draft)
    case 'awaiting_confirmation':
      return handleConfirmationReply(waId, customerId, text, draft)
    default:
      return resetWithdrawalState(waId)
  }
}

// ---------------------------------------------------------------------------
// Stage 1 — start
// ---------------------------------------------------------------------------

async function startWithdrawal(waId: string, customerId: string, mapping: any, rawAmount?: string): Promise<void> {
  if (mapping?.withdrawalPinLockedUntil && new Date(mapping.withdrawalPinLockedUntil).getTime() > Date.now()) {
    const mins = Math.max(1, Math.ceil((new Date(mapping.withdrawalPinLockedUntil).getTime() - Date.now()) / 60000))
    await trySend(
      waId,
      `Withdrawals from WhatsApp are temporarily locked after too many incorrect PIN attempts. Try again in about ${mins} minute${mins === 1 ? '' : 's'} — or withdraw from the Make It Sell app now, which also unlocks WhatsApp withdrawal immediately.`
    )
    return
  }

  await connectToDatabase()
  const user: any = await User.findById(customerId).select('withdrawalPinHash payoutProfile').lean()

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
    await promptBankConfirmation(waId, customerId, profile, amount)
    return
  }

  await saveState(waId, {
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

async function handleAmountReply(waId: string, customerId: string, text: string): Promise<void> {
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
  const user: any = await User.findById(customerId).select('payoutProfile').lean()
  const profile = user?.payoutProfile
  if (!profile?.paystackRecipientCode) {
    await resetWithdrawalState(waId)
    await trySend(waId, 'Your first withdrawal needs to be done from the Make It Sell app.')
    return
  }

  await promptBankConfirmation(waId, customerId, profile, amount)
}

async function promptBankConfirmation(waId: string, customerId: string, profile: any, amount: number): Promise<void> {
  await saveState(waId, {
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

async function handleBankChoiceReply(waId: string, customerId: string, text: string, draft: Record<string, any>): Promise<void> {
  const lower = String(text || '').trim().toLowerCase()
  if (lower !== 'yes' && lower !== 'confirm') {
    await trySend(waId, 'To use a different account, please do this from the Make It Sell app. Reply "yes" to continue with your saved account, or "cancel" to stop.')
    return
  }

  await connectToDatabase()
  const user: any = await User.findById(customerId).select('payoutProfile').lean()
  const profile = user?.payoutProfile
  if (!profile?.paystackRecipientCode) {
    await resetWithdrawalState(waId)
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
  await saveState(waId, {
    withdrawalStage: 'awaiting_pin',
    withdrawalDraft: nextDraft,
    withdrawalStageExpiresAt: new Date(Date.now() + STAGE_TTL_MS),
  })
  await trySend(waId, `Enter your 4-digit withdrawal PIN to confirm ${formatNaira(nextDraft.amount)} to ${profile.bankName} ${maskAccountNumber(profile.accountNumber)}.`)
}

// ---------------------------------------------------------------------------
// Stage 4 — PIN, with lockout
// ---------------------------------------------------------------------------

async function handlePinReply(waId: string, customerId: string, text: string, draft: Record<string, any>): Promise<void> {
  const trimmed = String(text || '').trim()

  if (!PIN_PATTERN.test(trimmed)) {
    await trySend(waId, 'Please reply with just your 4-digit PIN, or "cancel" to stop.')
    return
  }

  const pinCheck = await verifyWithdrawalPin(customerId, trimmed)

  if (!pinCheck.valid) {
    await connectToDatabase()
    const updated: any = await WhatsAppBuyer.findOneAndUpdate(
      { waId },
      { $inc: { withdrawalPinFailCount: 1 }, $set: { updatedAt: new Date() } },
      { new: true }
    ).lean()

    const failCount = Number(updated?.withdrawalPinFailCount || 0)

    if (failCount >= MAX_PIN_ATTEMPTS) {
      await saveState(waId, {
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
      console.warn(`[whatsapp-customer-withdrawal] PIN lockout for customer ${customerId}`)
      notifyPinLockout(customerId).catch(() => {})
      return
    }

    await trySend(waId, `Incorrect PIN (attempt ${failCount} of ${MAX_PIN_ATTEMPTS}). Try again, or reply "cancel" to stop.`)
    return
  }

  await WhatsAppBuyer.updateOne({ waId }, { $set: { withdrawalPinFailCount: 0, withdrawalPinLockedUntil: null } })

  await saveState(waId, {
    withdrawalStage: 'awaiting_confirmation',
    withdrawalStageExpiresAt: new Date(Date.now() + STAGE_TTL_MS),
  })

  const amount = Number(draft.amount || 0)
  await trySend(
    waId,
    `You'll receive ${formatNaira(amount)} to ${draft.bankName} ${maskAccountNumber(draft.accountNumber)}.\n\nReply "confirm" to send it, or "cancel" to stop.`
  )
}

async function notifyPinLockout(customerId: string): Promise<void> {
  try {
    await connectToDatabase()
    const user: any = await User.findById(customerId).select('email name').lean()
    await Promise.allSettled([
      pushToUser(customerId, {
        title: 'Withdrawal PIN Locked',
        body: "Multiple incorrect withdrawal PIN attempts on your WhatsApp-linked number. You can still withdraw from the app — if this wasn't you, secure your account.",
        url: '/wallet',
        tag: `withdrawal-pin-lockout-${customerId}-${Date.now()}`,
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
    console.error(`[whatsapp-customer-withdrawal] notifyPinLockout failed for customer ${customerId}:`, error)
  }
}

// ---------------------------------------------------------------------------
// Stage 5 — final confirmation, executes the withdrawal
// ---------------------------------------------------------------------------

async function handleConfirmationReply(waId: string, customerId: string, text: string, draft: Record<string, any>): Promise<void> {
  const lower = String(text || '').trim().toLowerCase()
  if (lower !== 'confirm' && lower !== 'yes') {
    await resetWithdrawalState(waId)
    await trySend(waId, 'Withdrawal cancelled.')
    return
  }

  await resetWithdrawalState(waId)

  const result = await processCustomerWithdrawal({
    userId: customerId,
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

  await trySend(waId, `${result.message}\n\nNew wallet balance: ${formatNaira(result.newBalance)}.`)
}
