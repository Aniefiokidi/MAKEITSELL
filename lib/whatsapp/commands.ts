// Inbound WhatsApp command dispatcher — called from app/api/whatsapp/webhook/route.ts
// for every message with a text body. Keeps the webhook route itself thin (verify,
// parse, extract) and all command/parsing logic in one place, per the cross-cutting
// requirement that inbound parsing lives in the POST handler or a dispatcher it calls.
//
// Feature 0 (this file, for now): WhatsApp account linking via one-time code. Later
// features (order notifications are outbound-only so don't need this dispatcher; mark-
// dispatched and balance-check are inbound and will be added here) all depend on this
// linking step, since no vendor data may leave the bot for an unresolved wa_id.
import connectToDatabase from '@/lib/mongodb'
import { WhatsAppLink } from '@/lib/models/WhatsAppLink'
import { Store } from '@/lib/models/Store'
import { sendTextMessage } from '@/lib/whatsapp/client'

const CODE_PATTERN = /^[A-Z0-9]{6}$/i

export async function handleInboundMessage(waId: string, text: string): Promise<void> {
  const trimmed = String(text || '').trim()

  // A bare 6-char code is checked first — it's the one command that must work for an
  // as-yet-unlinked number. Everything else will require a resolved vendor once added.
  if (CODE_PATTERN.test(trimmed)) {
    const handled = await tryHandleLinkCode(waId, trimmed.toUpperCase())
    if (handled) return
  }

  // TODO Feature 2/3: resolve wa_id -> linked vendor and route "balance" /
  // "dispatched <ref>" commands here, before falling through to the help menu.

  await sendHelpMenu(waId)
}

async function tryHandleLinkCode(waId: string, code: string): Promise<boolean> {
  await connectToDatabase()
  const link: any = await WhatsAppLink.findOne({ code })
  if (!link) return false // not a real code at all — let the caller fall through to help

  if (link.status === 'linked') {
    await sendTextMessage(waId, 'That code has already been used. If you need to (re)connect, generate a new one from your vendor dashboard.')
    console.log(`[whatsapp-commands] Rejected already-used code for vendor ${link.vendorId}`)
    return true
  }

  if (!link.codeExpiresAt || new Date(link.codeExpiresAt) <= new Date()) {
    await sendTextMessage(waId, 'That code has expired (codes are valid for 10 minutes). Generate a new one from your vendor dashboard.')
    console.log(`[whatsapp-commands] Rejected expired code for vendor ${link.vendorId}`)
    return true
  }

  // A wa_id can only be linked to one vendor at a time — replace any existing link for
  // this number before attaching it to the new vendor.
  await WhatsAppLink.updateMany(
    { waId, vendorId: { $ne: link.vendorId }, status: 'linked' },
    { $set: { waId: null, linkedAt: null, status: 'pending', updatedAt: new Date() } }
  )

  link.waId = waId
  link.linkedAt = new Date()
  link.status = 'linked'
  link.updatedAt = new Date()
  await link.save()

  const store: any = await Store.findOne({ vendorId: link.vendorId }).select('storeName').lean()
  const storeName = store?.storeName || 'your store'
  await sendTextMessage(waId, `Connected! This WhatsApp number is now linked to ${storeName} on Make It Sell.`)
  console.log(`[whatsapp-commands] Linked wa_id ${waId} to vendor ${link.vendorId}`)
  return true
}

async function sendHelpMenu(waId: string): Promise<void> {
  await sendTextMessage(
    waId,
    "Hi! I didn't recognize that message.\n\nIf your Make It Sell vendor dashboard gave you a connection code, send just that code here to link your account."
  )
}
