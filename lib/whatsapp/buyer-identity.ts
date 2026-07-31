// Resolves a WhatsApp buyer's wa_id to a real (but passwordless) User record, creating
// one on first order. Deliberately lazy — identity is only created at ORDER time (see
// lib/whatsapp/buyer-orders.ts), not on every browse/search message, so window-shopping
// never litters the User collection with throwaway accounts.
//
// The User schema requires email (unique) but nothing else — no password/passwordHash
// is required. A derived, per-wa_id placeholder email satisfies that one constraint
// without ever asking a phone-only buyer for a real one. The buyer can't log into the
// website with this record (no passwordHash is ever set), which is correct: they're
// WhatsApp-only until/unless a future flow lets them claim the account with a real
// email + password.
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'

export function placeholderEmailForWaId(waId: string): string {
  return `wa-${waId}@buyers.makeitsell.ng`
}

export async function findOrCreateBuyerForWaId(
  waId: string,
  name?: string
): Promise<{ customerId: string; isNew: boolean }> {
  await connectToDatabase()

  const existing: any = await WhatsAppBuyer.findOne({ waId }).lean()
  if (existing?.customerId) {
    return { customerId: String(existing.customerId), isNew: false }
  }

  const trimmedName = String(name || '').trim()
  const user: any = await User.create({
    email: placeholderEmailForWaId(waId),
    name: trimmedName || 'WhatsApp Buyer',
    displayName: trimmedName || 'WhatsApp Buyer',
    phone: waId,
    phone_verified: true, // the wa_id itself came from a verified Meta webhook delivery
    role: 'customer',
  })

  const customerId = String(user._id)

  try {
    await WhatsAppBuyer.create({ waId, customerId })
  } catch (error) {
    // Unique-index race: another concurrent order from the same wa_id created the
    // mapping first. Discard the User doc we just made and use the one that won, rather
    // than leaving two User records for the same phone number.
    const winner: any = await WhatsAppBuyer.findOne({ waId }).lean()
    if (winner?.customerId) {
      await User.deleteOne({ _id: user._id }).catch(() => {})
      return { customerId: String(winner.customerId), isNew: false }
    }
    throw error
  }

  console.log(`[whatsapp-buyer-identity] Created buyer ${customerId} for wa_id ${waId}`)
  return { customerId, isNew: true }
}
