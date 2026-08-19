// Shared WhatsApp notification primitive for one-off, additive notifications (booking
// reminders, cart recovery, low-stock alerts, review notifications) — everywhere a
// non-bot-conversation part of the codebase (a cron job, a review route) needs to ping a
// user's linked WhatsApp number alongside its existing push/email sends. Mirrors the
// resolve+template-first/free-text-fallback shape already proven in
// lib/negotiation-service.ts's notifyPartyWa/resolveRecipientWaId (Phase S4) — extracted
// here now that it's about to be reused by several more call sites. Existing call sites
// (lib/whatsapp/service-quote.ts, lib/negotiation-service.ts) are deliberately left as-is,
// not retrofitted onto this — only new code uses it.
import connectToDatabase from '@/lib/mongodb'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { WhatsAppLink } from '@/lib/models/WhatsAppLink'
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp/client'

export async function resolveBuyerWaId(customerId: string): Promise<string> {
  if (!customerId) return ''
  await connectToDatabase()
  const mapping: any = await WhatsAppBuyer.findOne({ customerId }).lean()
  return String(mapping?.waId || '').trim()
}

export async function resolveVendorWaId(vendorId: string): Promise<string> {
  if (!vendorId) return ''
  await connectToDatabase()
  const link: any = await WhatsAppLink.findOne({ vendorId, status: 'linked' }).lean()
  return String(link?.waId || '').trim()
}

// Never throws — every caller can fire-and-forget this the same way the rest of the
// codebase fires push/email (`.catch(() => {})`), so a WhatsApp delivery failure never
// blocks or breaks whatever else a caller is doing.
export async function sendWaNotification(params: {
  waId: string
  freeTextBody: string
  template?: { name: string; params: string[] }
}): Promise<void> {
  const { waId, freeTextBody, template } = params
  if (!waId) return

  try {
    if (template) {
      try {
        await sendTemplateMessage(waId, template.name, template.params)
        return
      } catch (templateError) {
        console.log(`[whatsapp-notify] ${template.name} template send failed, falling back to free text for ${waId}:`, templateError)
      }
    }
    await sendTextMessage(waId, freeTextBody)
  } catch (error) {
    console.error(`[whatsapp-notify] Send failed for ${waId}:`, error)
  }
}
