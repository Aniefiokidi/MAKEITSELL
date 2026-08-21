// WhatsApp account claiming — turns a passwordless, bot-created placeholder User into a
// real, login-capable account (same _id, so order/booking/wallet history carries over),
// without ever asking for a password over chat. Stateless single-turn, same shape as
// lib/whatsapp/wallet-topup.ts: the actual identity-setting step happens on a web form
// (app/claim-account/page.tsx + app/api/auth/claim-account/route.ts), not here — this file
// only issues the one-time link.
import crypto from 'crypto'
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { sendTextMessage } from '@/lib/whatsapp/client'
import { findOrCreateBuyerForWaId } from '@/lib/whatsapp/buyer-identity'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

const CLAIM_COMMAND_PATTERN = /^(claim|set ?up|create)( my)? account$/i
const CLAIM_TOKEN_TTL_MS = 30 * 60 * 1000

async function trySend(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-claim-account] Text send failed for ${waId}:`, error)
  }
}

export async function tryHandleClaimAccountCommand(waId: string, text: string): Promise<boolean> {
  const trimmed = String(text || '').trim()
  if (!CLAIM_COMMAND_PATTERN.test(trimmed)) return false

  const { customerId } = await findOrCreateBuyerForWaId(waId)

  await connectToDatabase()
  const user: any = await User.findById(customerId).select('isPlaceholderAccount').lean()

  if (!user?.isPlaceholderAccount) {
    await trySend(waId, "This number is already linked to a full account — log in on the website or app.")
    return true
  }

  const token = crypto.randomBytes(32).toString('hex')
  await WhatsAppBuyer.updateOne(
    { waId },
    { $set: { claimToken: token, claimTokenExpiresAt: new Date(Date.now() + CLAIM_TOKEN_TTL_MS), updatedAt: new Date() } }
  )

  const link = `${getCanonicalAppBaseUrl()}/claim-account?token=${token}`
  await trySend(
    waId,
    `Set up your account to log in on the website or app anytime:\n\n${link}\n\nThis link expires in 30 minutes.`
  )
  return true
}
