// Lets a linked vendor also browse/buy through the bot — previously a known v1 limitation
// (a linked vendor's WhatsApp number could only ever reach vendor commands, never
// lib/whatsapp/buyer.ts's browsing/checkout flow), even though the same vendor account can
// already shop normally on the website (confirmed: no role gate anywhere in checkout or
// booking creation).
//
// Toggled explicitly ("shop"/"stop shopping") rather than auto-detected, matching the
// existing goods/services browseMode toggle's philosophy (lib/whatsapp/buyer.ts's
// SERVICE_ENTRY_KEYWORDS) — a vendor is either in vendor-command mode or shopping mode,
// never both from the same message.
import connectToDatabase from '@/lib/mongodb'
import { WhatsAppLink } from '@/lib/models/WhatsAppLink'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { sendTextMessage } from '@/lib/whatsapp/client'

const SHOP_ON_PATTERN = /^(shop|start shopping|shopping mode)$/i
const SHOP_OFF_PATTERN = /^(stop shopping|vendor mode|exit shopping)$/i

async function trySend(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-vendor-shopping] Text send failed for ${waId}:`, error)
  }
}

export async function isVendorShopping(vendorId: string): Promise<boolean> {
  await connectToDatabase()
  const link: any = await WhatsAppLink.findOne({ vendorId }).select('shoppingMode').lean()
  return Boolean(link?.shoppingMode)
}

// Buyer-flow code (checkout, negotiation, my-bookings, reviews) all resolve identity via
// WhatsAppBuyer.findOne({waId}) -> customerId, same as any genuine buyer. Pointing that
// mapping at the vendor's OWN account (rather than letting findOrCreateBuyerForWaId spin up
// a fresh placeholder) means every one of those flows works completely unmodified — orders,
// order history, negotiations, etc. all land on the vendor's real account.
async function ensureBuyerIdentityForVendor(waId: string, vendorId: string): Promise<void> {
  await connectToDatabase()
  await WhatsAppBuyer.updateOne(
    { waId },
    { $setOnInsert: { waId, customerId: vendorId, createdAt: new Date() } },
    { upsert: true }
  )
}

export async function tryHandleShoppingModeToggle(waId: string, vendorId: string, text: string): Promise<boolean> {
  const trimmed = String(text || '').trim()

  if (SHOP_ON_PATTERN.test(trimmed)) {
    await ensureBuyerIdentityForVendor(waId, vendorId)
    await connectToDatabase()
    await WhatsAppLink.updateOne({ vendorId }, { $set: { shoppingMode: true, updatedAt: new Date() } })
    await trySend(
      waId,
      "You're now shopping — browse and buy just like any buyer. Reply \"vendor mode\" any time to switch back to your vendor commands."
    )
    return true
  }

  if (SHOP_OFF_PATTERN.test(trimmed)) {
    await connectToDatabase()
    await WhatsAppLink.updateOne({ vendorId }, { $set: { shoppingMode: false, updatedAt: new Date() } })
    await trySend(waId, "Back to vendor mode. Reply \"shop\" any time to browse and buy.")
    return true
  }

  return false
}

// Exported so commands.ts can call it before every message it routes into
// handleBuyerMessage, not just on the toggle transition — $setOnInsert makes repeat calls
// a harmless no-op once the mapping exists, and this way the buyer identity self-heals
// even if the doc were ever missing for an already-shopping vendor.
export { ensureBuyerIdentityForVendor }
