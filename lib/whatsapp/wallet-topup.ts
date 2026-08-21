// Wallet top-up over WhatsApp — for both buyers and linked vendors. Deliberately
// stateless and single-turn: unlike withdrawal, there's no PIN or conversation stage at
// all here, because the real authorization happens on Paystack's own page once the buyer
// taps the link — exactly the same trust model as every other "here's your payment link"
// flow already in this bot (booking payments, quote acceptance, negotiated bookings).
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { sendTextMessage } from '@/lib/whatsapp/client'
import { findOrCreateBuyerForWaId, placeholderEmailForWaId } from '@/lib/whatsapp/buyer-identity'
import { initiateWalletTopup } from '@/lib/wallet-topup'

const TOPUP_PATTERN = /^top ?up(\s+([\d,]+(?:\.\d+)?))?$/i

async function trySend(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-wallet-topup] Text send failed for ${waId}:`, error)
  }
}

// Buyer top-up auto-creates the passwordless buyer identity on first use, same as
// negotiation's "offer <amount>" (lib/whatsapp/service-negotiation.ts) — unlike
// withdrawal, there's no prerequisite (existing balance, a PIN already set) a fresh
// identity could fail on, so there's nothing to gain from bailing instead.
export async function tryHandleCustomerTopupCommand(waId: string, text: string): Promise<boolean> {
  const match = String(text || '').trim().match(TOPUP_PATTERN)
  if (!match) return false

  if (!match[2]) {
    await trySend(waId, 'How much would you like to top up? Reply like: topup 5000')
    return true
  }

  const amount = Number(match[2].replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) {
    await trySend(waId, "That amount doesn't look right. Reply like: topup 5000")
    return true
  }

  const { customerId } = await findOrCreateBuyerForWaId(waId)
  const buyerUser: any = await User.findById(customerId).select('name displayName email').lean()
  const email = buyerUser?.email || placeholderEmailForWaId(waId)

  const result = await initiateWalletTopup({ userId: customerId, email, role: 'customer', amount })

  if (!result.success) {
    await trySend(waId, `Couldn't start that top-up: ${result.error}`)
    return true
  }

  await trySend(
    waId,
    `Tap the link below to pay ${formatNaira(result.payableAmount)} and credit ${formatNaira(result.walletCreditAmount)} to your wallet:\n\n${result.authorization_url}\n\nOnce payment is confirmed we'll message you here.`
  )
  return true
}

export async function tryHandleVendorTopupCommand(waId: string, vendorId: string, text: string): Promise<boolean> {
  const match = String(text || '').trim().match(TOPUP_PATTERN)
  if (!match) return false

  if (!match[2]) {
    await trySend(waId, 'How much would you like to top up? Reply like: topup 5000')
    return true
  }

  const amount = Number(match[2].replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) {
    await trySend(waId, "That amount doesn't look right. Reply like: topup 5000")
    return true
  }

  await connectToDatabase()
  const vendor: any = await User.findById(vendorId).select('email').lean()
  if (!vendor?.email) {
    await trySend(waId, "Couldn't find your account email — please top up from the app instead.")
    return true
  }

  const result = await initiateWalletTopup({ userId: vendorId, email: vendor.email, role: 'vendor', amount })

  if (!result.success) {
    await trySend(waId, `Couldn't start that top-up: ${result.error}`)
    return true
  }

  await trySend(
    waId,
    `Tap the link below to pay ${formatNaira(result.payableAmount)} and credit ${formatNaira(result.walletCreditAmount)} to your wallet:\n\n${result.authorization_url}\n\nOnce payment is confirmed we'll message you here.`
  )
  return true
}

function formatNaira(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}
