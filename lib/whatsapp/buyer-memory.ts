// Remembering the buyer: sizes and colours they mention, what they last searched for,
// and when they were last here — so a returning buyer gets "welcome back, David" with a
// way to pick up where they left off, and a size prompt can say "you took 42 last time".
// Everything here is best-effort and never blocks a reply.
import connectToDatabase from '@/lib/mongodb'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { User } from '@/lib/models/User'
import { Order } from '@/lib/models/Order'
import { PLACEHOLDER_BUYER_NAME } from '@/lib/whatsapp/buyer-identity'
import { parseCatalogQuery } from '@/lib/whatsapp/catalog-query'

const COLOR_WORDS = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'brown', 'grey', 'gray', 'gold', 'silver', 'orange', 'beige', 'cream', 'navy', 'wine', 'maroon', 'nude', 'peach', 'lilac', 'teal']

export async function touchBuyer(waId: string): Promise<void> {
  try {
    await connectToDatabase()
    await WhatsAppBuyer.updateOne({ waId }, { $set: { lastActiveAt: new Date() } })
  } catch { /* best effort */ }
}

// Called with every product search the buyer types.
export async function rememberSearch(waId: string, query: string): Promise<void> {
  try {
    await connectToDatabase()
    const parsed = parseCatalogQuery(query)
    const colours = parsed.term.toLowerCase().split(/\s+/).filter((w) => COLOR_WORDS.includes(w))
    const update: any = { $set: { lastActiveAt: new Date() } }
    if (parsed.size) update.$set.preferredSize = parsed.size
    const push: any = { lastSearches: { $each: [parsed.term.slice(0, 60)], $position: 0, $slice: 5 } }
    if (colours.length) push.preferredColors = { $each: colours, $position: 0, $slice: 5 }
    update.$push = push
    await WhatsAppBuyer.updateOne({ waId }, update)
  } catch { /* best effort */ }
}

export interface BuyerMemory {
  name?: string
  preferredSize?: string
  preferredColors: string[]
  lastSearch?: string
  lastActiveAt?: Date
  lastOrderSummary?: string
}

export async function recallBuyer(waId: string): Promise<BuyerMemory | null> {
  try {
    await connectToDatabase()
    const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()
    if (!mapping?.customerId) return null
    const [user, lastOrder]: any[] = await Promise.all([
      User.findById(mapping.customerId).select('name').lean(),
      Order.findOne({ customerId: String(mapping.customerId), paymentStatus: { $in: ['paid', 'escrow', 'released'] } }).sort({ createdAt: -1 }).select('items vendors').lean(),
    ])
    const name = String(user?.name || '').trim()
    const items: any[] = lastOrder ? (Array.isArray(lastOrder.items) && lastOrder.items.length ? lastOrder.items : (lastOrder.vendors || []).flatMap((v: any) => v?.items || [])) : []
    const first = items.find((i) => i?.title || i?.name)
    return {
      name: name && name !== PLACEHOLDER_BUYER_NAME ? name.split(' ')[0] : undefined,
      preferredSize: mapping.preferredSize || undefined,
      preferredColors: Array.isArray(mapping.preferredColors) ? mapping.preferredColors : [],
      lastSearch: Array.isArray(mapping.lastSearches) ? mapping.lastSearches[0] : undefined,
      lastActiveAt: mapping.lastActiveAt || undefined,
      lastOrderSummary: first ? `${String(first.title || first.name)}${items.length > 1 ? ` +${items.length - 1} more` : ''}` : undefined,
    }
  } catch {
    return null
  }
}
