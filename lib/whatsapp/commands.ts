// Inbound WhatsApp command dispatcher — called from app/api/whatsapp/webhook/route.ts
// for every message with a text body. Keeps the webhook route itself thin (verify,
// parse, extract) and all command/parsing logic in one place, per the cross-cutting
// requirement that inbound parsing lives in the POST handler or a dispatcher it calls.
//
// Every command below except code-linking requires a resolved, linked vendor first — no
// vendor data may ever leave the bot for an unresolved wa_id.
import connectToDatabase from '@/lib/mongodb'
import { WhatsAppLink } from '@/lib/models/WhatsAppLink'
import { Store } from '@/lib/models/Store'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { WhatsAppMessageMap } from '@/lib/models/WhatsAppMessageMap'
import { applyOrderVendorStatus, resolveOrderVendorTarget } from '@/lib/order-vendor-status'
import { sendTextMessage } from '@/lib/whatsapp/client'
import { handleBuyerMessage } from '@/lib/whatsapp/buyer'

const CODE_PATTERN = /^[A-Z0-9]{6}$/i
// Matches the same orderId.slice(0, 8).toUpperCase() convention used for the order ref
// in outbound notifications (lib/whatsapp/notifications.ts) and elsewhere in the app.
const DISPATCH_PATTERN = /^dispatched\s+([a-z0-9]{8})$/i

const NOT_LINKED_MESSAGE = 'You need to connect your account first. Get a connection code from your Make It Sell vendor dashboard and send it here.'

// Every reply goes through here so a delivery failure (e.g. recipient not reachable,
// outside the 24h window) never stops the outcome from being logged — the business-logic
// log line for each branch below always fires first, independent of whether the reply
// itself actually reaches the vendor.
async function trySend(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-commands] Reply send failed for ${waId}:`, error)
  }
}

// `contextMessageId` is set when the inbound text is a reply/quote of a previous
// message (message.context.id in the webhook payload) — passed through to the buyer
// flow for reply-to-select cart adds. Never meaningful for vendor commands below, so it
// isn't threaded any further than handleBuyerMessage.
export async function handleInboundMessage(waId: string, text: string, contextMessageId?: string): Promise<void> {
  const trimmed = String(text || '').trim()

  // A bare 6-char code is checked first — it's the one command that must work for an
  // as-yet-unlinked number. Everything else branches on whether waId currently resolves
  // to a linked vendor.
  if (CODE_PATTERN.test(trimmed)) {
    const handled = await tryHandleLinkCode(waId, trimmed.toUpperCase())
    if (handled) return
  }

  // Not a linked vendor — route into buyer product browsing instead of the vendor help
  // menu. Known v1 limitation (accepted): a linked vendor can't also browse as a buyer on
  // the same number; there's no mode-switch.
  const vendorId = await resolveLinkedVendor(waId)
  if (!vendorId) {
    await handleBuyerMessage(waId, trimmed, contextMessageId)
    return
  }

  const dispatchMatch = trimmed.match(DISPATCH_PATTERN)
  if (dispatchMatch) {
    await handleDispatchedCommand(waId, dispatchMatch[1].toUpperCase())
    return
  }

  if (trimmed.toLowerCase() === 'balance') {
    await handleBalanceCommand(waId)
    return
  }

  await sendHelpMenu(waId)
}

// Entry point for an inbound image (photo) message — called from the webhook route's
// 'image' branch. A linked vendor has no photo-based command today, so this only ever
// does something for an unresolved (buyer) sender.
export async function handleInboundImageMessage(waId: string, mediaId: string): Promise<void> {
  const vendorId = await resolveLinkedVendor(waId)
  if (!vendorId) {
    // Dynamic import — image-search.ts pulls in TensorFlow.js, which must not be a
    // load-time dependency of this whole file (commands.ts is imported directly by the
    // webhook route, so a top-level import here would mean EVERY inbound message of any
    // type pays for loading TF.js, not just images). The import itself is awaited so it
    // resolves before this function returns, but the call into handleBuyerImageMessage is
    // NOT awaited — it self-defers via after() internally, since classification takes
    // several seconds and must never block this webhook's response to Meta.
    const { handleBuyerImageMessage } = await import('@/lib/whatsapp/image-search')
    handleBuyerImageMessage(waId, mediaId)
    return
  }
  await trySend(waId, "I can't do anything with a photo right now. Try: dispatched [order ref] or balance.")
}

async function tryHandleLinkCode(waId: string, code: string): Promise<boolean> {
  await connectToDatabase()
  const link: any = await WhatsAppLink.findOne({ code })
  if (!link) return false // not a real code at all — let the caller fall through to help

  if (link.status === 'linked') {
    console.log(`[whatsapp-commands] Rejected already-used code for vendor ${link.vendorId}`)
    await trySend(waId, 'That code has already been used. If you need to (re)connect, generate a new one from your vendor dashboard.')
    return true
  }

  if (!link.codeExpiresAt || new Date(link.codeExpiresAt) <= new Date()) {
    console.log(`[whatsapp-commands] Rejected expired code for vendor ${link.vendorId}`)
    await trySend(waId, 'That code has expired (codes are valid for 10 minutes). Generate a new one from your vendor dashboard.')
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
  console.log(`[whatsapp-commands] Linked wa_id ${waId} to vendor ${link.vendorId}`)
  await trySend(waId, `Connected! This WhatsApp number is now linked to ${storeName} on Make It Sell.`)
  return true
}

async function resolveLinkedVendor(waId: string): Promise<string | null> {
  await connectToDatabase()
  const link: any = await WhatsAppLink.findOne({ waId, status: 'linked' }).lean()
  const vendorId = String(link?.vendorId || '').trim()
  return vendorId || null
}

// Statuses a vendor's leg can already be at where "dispatched" no longer applies — the
// item has already moved past that point, or the leg is cancelled entirely.
const PAST_DISPATCH_STATUSES = new Set(['shipped', 'out_for_delivery', 'delivered', 'received', 'cancelled'])

export async function handleDispatchedCommand(waId: string, ref: string): Promise<void> {
  const vendorId = await resolveLinkedVendor(waId)
  if (!vendorId) {
    console.log(`[whatsapp-commands] dispatched: rejected — ${waId} is not a linked vendor`)
    await trySend(waId, NOT_LINKED_MESSAGE)
    return
  }

  await connectToDatabase()
  // `ref` is pre-validated as exactly 8 [a-z0-9] chars by DISPATCH_PATTERN, so it's safe
  // to use directly in a regex — no injection surface.
  const order: any = await Order.findOne({ orderId: { $regex: `^${ref}`, $options: 'i' } }).lean()
  if (!order) {
    console.log(`[whatsapp-commands] dispatched: no order found for ref ${ref} (vendor ${vendorId})`)
    await trySend(waId, `Couldn't find an order matching ${ref}. Double-check the reference and try again.`)
    return
  }

  const vendorEntries = Array.isArray(order.vendors) ? order.vendors : []
  const targetEntry = vendorEntries.find((entry: any) => String(entry?.vendorId || '') === vendorId)
  if (!targetEntry) {
    console.log(`[whatsapp-commands] dispatched: order ${order.orderId} does not belong to vendor ${vendorId}`)
    await trySend(waId, `Order ${ref} doesn't belong to your store.`)
    return
  }

  const currentStatus = String(targetEntry.status || '').toLowerCase()
  if (PAST_DISPATCH_STATUSES.has(currentStatus)) {
    console.log(`[whatsapp-commands] dispatched: order ${order.orderId} already ${currentStatus} for vendor ${vendorId}`)
    await trySend(waId, `Order ${ref} is already ${currentStatus.replace(/_/g, ' ')} — nothing to update.`)
    return
  }

  const target = await resolveOrderVendorTarget(order.orderId, vendorId, String(targetEntry.storeId || ''))
  if (!target) {
    console.error(`[whatsapp-commands] dispatched: resolveOrderVendorTarget failed — order ${order.orderId}, vendor ${vendorId}`)
    await trySend(waId, `Something went wrong updating order ${ref}. Please try again or use your vendor dashboard.`)
    return
  }

  const updated = await applyOrderVendorStatus({
    orderId: order.orderId,
    vendorId,
    storeId: String(targetEntry.storeId || ''),
    status: 'shipped',
    existingOrder: target.existingOrder,
    targetStore: target.targetStore,
  })

  if (!updated) {
    console.error(`[whatsapp-commands] dispatched: applyOrderVendorStatus returned null — order ${order.orderId}, vendor ${vendorId}`)
    await trySend(waId, `Couldn't update order ${ref}. Please try again or use your vendor dashboard.`)
    return
  }

  console.log(`[whatsapp-commands] Vendor ${vendorId} marked order ${order.orderId} as dispatched via WhatsApp`)
  await trySend(waId, `Order ${ref} marked as dispatched. The buyer will be notified.`)
}

// Handles a "Mark as dispatched" quick-reply button tap on an order_received template.
// The tap arrives with only message.context.id (the WhatsApp message ID of the template
// we sent) — no order info of its own — so the whole job here is resolving that back to
// an order/vendor via the persistent mapping, then handing off to the EXACT SAME
// handleDispatchedCommand used by the typed command above. That's deliberate: it's what
// gives the button the same linked-vendor, ownership, and already-shipped gates the
// typed command already has, with no separate copy of that logic to keep in sync.
export async function handleButtonReply(waId: string, contextMessageId: string): Promise<void> {
  await connectToDatabase()
  const mapping: any = await WhatsAppMessageMap.findOne({ messageId: contextMessageId }).lean()

  if (!mapping) {
    // Expired (past the mapping's 90-day TTL) or predates this feature — not an error,
    // just nothing to resolve automatically. Name the fallback explicitly so the vendor
    // has a way forward instead of a dead end.
    console.log(`[whatsapp-commands] button reply: no mapping for message ${contextMessageId} (vendor lookup pending)`)
    await trySend(waId, "I couldn't match that to an order. Please reply: dispatched [order ref]")
    return
  }

  const ref = String(mapping.orderId || '').slice(0, 8).toUpperCase()
  console.log(`[whatsapp-commands] button reply: resolved message ${contextMessageId} -> order ${mapping.orderId} (ref ${ref})`)
  await handleDispatchedCommand(waId, ref)
}

function formatNaira(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}

// Wallet data must never leave the bot for anything but a currently-linked vendor.
// resolveLinkedVendor is the ONLY resolution path here — it reads exclusively from
// WhatsAppLink, never from a phone number on the User/Store record, so a wa_id can never
// be matched to the wrong vendor's wallet. Read-only: no mutation happens in this command.
async function handleBalanceCommand(waId: string): Promise<void> {
  const vendorId = await resolveLinkedVendor(waId)
  if (!vendorId) {
    console.log(`[whatsapp-commands] balance: rejected — ${waId} is not a linked vendor`)
    await trySend(waId, NOT_LINKED_MESSAGE)
    return
  }

  await connectToDatabase()
  const vendor: any = await User.findById(vendorId)
    .select('walletBalance earnedBalance depositedBalance prizeBalance')
    .lean()

  // Missing wallet fields (or no User doc at all, which shouldn't happen for a linked
  // vendor but isn't worth erroring over) default to 0 rather than failing the request.
  const earned = Number(vendor?.earnedBalance || 0)
  const deposited = Number(vendor?.depositedBalance || 0)
  const prize = Number(vendor?.prizeBalance || 0)
  // Total comes from walletBalance, NOT earned+deposited+prize — confirmed via
  // app/api/vendor/wallet/withdraw/preview/route.ts that walletBalance is the field
  // actually trusted as the spendable total elsewhere in the app. They're supposed to
  // stay in sync, but accounts funded before the three-bucket split (walletBalance set,
  // sub-balances never populated) prove they can drift — summing the sub-balances here
  // would silently show a real balance as zero for exactly those accounts.
  const total = Number(vendor?.walletBalance || 0)

  console.log(`[whatsapp-commands] balance: sending balance to vendor ${vendorId} (total ${total})`)

  await trySend(
    waId,
    `Wallet Balance\n\nEarned: ${formatNaira(earned)}\nDeposited: ${formatNaira(deposited)}\nPrize: ${formatNaira(prize)}\n\nTotal: ${formatNaira(total)}`
  )
}

async function sendHelpMenu(waId: string): Promise<void> {
  const vendorId = await resolveLinkedVendor(waId)

  if (vendorId) {
    await trySend(
      waId,
      "Hi! I didn't recognize that message.\n\nAvailable commands:\n- dispatched [order ref] — mark an order as shipped\n- balance — check your wallet balance"
    )
    return
  }

  await trySend(
    waId,
    "Hi! I didn't recognize that message.\n\nIf your Make It Sell vendor dashboard gave you a connection code, send just that code here to link your account."
  )
}
