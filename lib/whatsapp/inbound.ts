// Inbound WhatsApp message processing, split out of app/api/whatsapp/webhook/route.ts
// (Next only allows HTTP-method exports from a route file) so it can be tested directly.
// The webhook verifies the signature, acks Meta, and hands each message here.
import { handleInboundMessage, handleButtonReply, handleInboundImageMessage, handleInboundLocation, handleUnsupportedMessage } from '@/lib/whatsapp/commands'
import { handleCategorySelection, handleServiceCategorySelection } from '@/lib/whatsapp/buyer'
import { handleSavedAddressListReply } from '@/lib/whatsapp/checkout'
import { sendTextMessage } from '@/lib/whatsapp/client'
import connectToDatabase from '@/lib/mongodb'
import { WhatsAppInboundMessage } from '@/lib/models/WhatsAppInboundMessage'
// Records that we're handling this message id. False when another delivery of the same
// webhook already claimed it (Meta retries on anything but a quick 200) — the caller
// skips it rather than replying twice. A DB hiccup errs on the side of processing: one
// duplicate reply is better than a buyer who gets no reply at all.
async function claimInboundMessage(messageId: string, waId: string, type: string): Promise<boolean> {
  if (!messageId) return true
  try {
    await connectToDatabase()
    await WhatsAppInboundMessage.create({ messageId, waId, type })
    return true
  } catch (error: any) {
    if (error?.code === 11000) {
      console.log(`[whatsapp-webhook] Duplicate delivery of ${messageId} from ${waId} — skipped`)
      return false
    }
    console.error('[whatsapp-webhook] Could not record inbound message id, processing anyway:', error)
    return true
  }
}

// Routes one inbound message to its handler. Errors are caught per message so one bad
// message can't silence the rest of the batch, and the sender is told something went
// wrong instead of being left on "read".
// `route` is injectable so tests can exercise the failure path.
export async function processInboundMessage(message: any, route: (message: any, waId: string) => Promise<void> = routeInboundMessage): Promise<void> {
  const waId = String(message?.from || 'unknown')
  const type = String(message?.type || 'unknown')
  if (!(await claimInboundMessage(String(message?.id || ''), waId, type))) return

  try {
    await route(message, waId)
  } catch (error) {
    console.error(`[whatsapp-webhook] Failed to handle ${type} message from ${waId}:`, error)
    if (waId !== 'unknown') {
      await sendTextMessage(waId, 'Sorry — something went wrong on my side while handling that. Please send it again in a moment.').catch(() => {})
    }
  }
}

async function routeInboundMessage(message: any, waId: string): Promise<void> {
  const text = typeof message?.text?.body === 'string' ? message.text.body : ''
  if (text) {
    // A text message that's a reply/quote of a previous one (e.g. a buyer
    // replying to a product-result image to add it to cart) carries the same
    // context.id shape Meta uses for button/list replies — confirmed against
    // Meta's official webhook docs (context: {from, id}).
    const contextMessageId = message?.context?.id ? String(message.context.id) : undefined
    console.log(`[whatsapp-webhook] Message from ${waId}: ${text}${contextMessageId ? ` (reply to ${contextMessageId})` : ''}`)
    await handleInboundMessage(waId, text, contextMessageId)
  } else if (message?.type === 'button' && message?.context?.id) {
    // Quick-reply button tap on a template we sent (e.g. "Mark as dispatched" on
    // order_received) — distinct from type "interactive", which is only for
    // buttons we send ourselves via the Interactive API, not template-embedded
    // ones. context.id is the WhatsApp message ID of that original template send.
    console.log(`[whatsapp-webhook] Button reply from ${waId}: "${message.button?.text}" (context: ${message.context.id})`)
    await handleButtonReply(waId, String(message.context.id))
  } else if (message?.type === 'interactive' && message?.interactive?.type === 'button_reply') {
    // A tap on one of our quick-reply buttons (sendInteractiveButtons). The id is a
    // command the text router already understands ("services", "my orders", ...), so
    // it's routed exactly as if the buyer had typed it.
    const buttonId = String(message.interactive.button_reply?.id || message.interactive.button_reply?.title || '')
    console.log(`[whatsapp-webhook] Button tap from ${waId}: "${message.interactive.button_reply?.title}" (id: ${buttonId})`)
    await handleInboundMessage(waId, buttonId.replace(/^cmd:/, ''))
  } else if (message?.type === 'interactive' && message?.interactive?.type === 'list_reply') {
    // Tap on a list message we sent ourselves via the Interactive API — distinct
    // from the template-embedded "button" type above. Three possible sources
    // today, distinguished by the row id prefix: "category:electronics" (buyer
    // goods category menu, lib/whatsapp/buyer.ts), "service-category:beauty"
    // (buyer services category menu, same file), or "address:<id|new>"
    // (saved-address picker, lib/whatsapp/checkout.ts).
    const rowId = String(message.interactive.list_reply?.id || '')
    console.log(`[whatsapp-webhook] List reply from ${waId}: "${message.interactive.list_reply?.title}" (id: ${rowId})`)
    if (rowId.startsWith('address:')) {
      await handleSavedAddressListReply(waId, rowId)
    } else if (rowId.startsWith('service-category:')) {
      await handleServiceCategorySelection(waId, rowId)
    } else {
      await handleCategorySelection(waId, rowId)
    }
  } else if (message?.type === 'location' && Number.isFinite(Number(message?.location?.latitude)) && Number.isFinite(Number(message?.location?.longitude))) {
    // A shared location pin — used to rank service providers by distance (see
    // lib/whatsapp/service-contacts.ts). Meta's payload: location: {latitude,
    // longitude, name?, address?}.
    const { latitude, longitude, name, address } = message.location
    console.log(`[whatsapp-webhook] Location from ${waId}: ${latitude},${longitude}${name ? ` (${name})` : ''}`)
    await handleInboundLocation(waId, Number(latitude), Number(longitude), String(name || address || '').trim() || undefined)
  } else if (message?.type === 'image' && message?.image?.id) {
    // A buyer's photo — matched against the catalog via perceptual hashing (see
    // lib/whatsapp/image-search.ts), no AI/vision API involved.
    console.log(`[whatsapp-webhook] Image message from ${waId} (media id: ${message.image.id})`)
    await handleInboundImageMessage(waId, String(message.image.id))
  } else {
    console.log(`[whatsapp-webhook] Message from ${waId} (type: ${message?.type || 'unknown'}, no text body)`)
    await handleUnsupportedMessage(waId, String(message?.type || 'unknown'))
  }
}
