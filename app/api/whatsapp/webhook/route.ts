import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { handleInboundMessage, handleButtonReply, handleInboundImageMessage } from '@/lib/whatsapp/commands'
import { handleCategorySelection, handleServiceCategorySelection } from '@/lib/whatsapp/buyer'
import { handleSavedAddressListReply } from '@/lib/whatsapp/checkout'

// WhatsApp Cloud API webhook — Meta's dashboard verification handshake (GET) plus the
// message/status event receiver (POST). Docs:
// https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = String(process.env.WHATSAPP_VERIFY_TOKEN || '').trim()

  if (mode === 'subscribe' && verifyToken && token === verifyToken) {
    return new NextResponse(String(challenge ?? ''), { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

/**
 * Verifies the X-Hub-Signature-256 header (HMAC-SHA256, WHATSAPP_APP_SECRET as key)
 * against the raw request body — per Meta's webhook docs. Must be computed over the raw
 * (unparsed) body, not the re-serialized JSON, or the signature won't match. Meta's
 * header format is "sha256=<hex>", unlike a bare hex digest.
 */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = String(process.env.WHATSAPP_APP_SECRET || '').trim()
  if (!secret || !signatureHeader) return false

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
  } catch {
    return false // length mismatch etc. — not a valid signature
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  if (!verifySignature(rawBody, signature)) {
    console.error('[whatsapp-webhook] Signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const entries = Array.isArray(payload?.entry) ? payload.entry : []
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : []
      for (const change of changes) {
        const value = change?.value || {}

        // Incoming user messages
        const messages = Array.isArray(value?.messages) ? value.messages : []
        for (const message of messages) {
          const waId = String(message?.from || 'unknown')
          const text = message?.text?.body
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
          } else if (message?.type === 'image' && message?.image?.id) {
            // A buyer's photo — matched against the catalog via perceptual hashing (see
            // lib/whatsapp/image-search.ts), no AI/vision API involved.
            console.log(`[whatsapp-webhook] Image message from ${waId} (media id: ${message.image.id})`)
            await handleInboundImageMessage(waId, String(message.image.id))
          } else {
            console.log(`[whatsapp-webhook] Message from ${waId} (type: ${message?.type || 'unknown'}, no text body)`)
          }
        }

        // Delivery/read status updates for messages we sent — no message content here,
        // handled separately so it never falls through to the "no text body" log above.
        const statuses = Array.isArray(value?.statuses) ? value.statuses : []
        for (const status of statuses) {
          console.log(`[whatsapp-webhook] Status update for ${status?.recipient_id}: ${status?.status}`)
          // "failed" statuses carry the real reason here (e.g. code 131047 = outside the
          // 24h customer-service window) — the send call itself only gets a queuing ack,
          // not delivery outcome, so this is the only place the actual cause shows up.
          if (status?.status === 'failed' && Array.isArray(status?.errors)) {
            console.error(`[whatsapp-webhook] Delivery failure for ${status?.recipient_id}:`, JSON.stringify(status.errors))
          }
        }
      }
    }
  } catch (error) {
    // Log and still 200 below — Meta retries on non-200, and a processing error here
    // isn't something a retry will fix.
    console.error('[whatsapp-webhook] Failed to process payload:', error)
  }

  return NextResponse.json({ success: true })
}
