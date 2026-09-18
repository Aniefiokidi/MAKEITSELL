// The daily "how did the bot do" report, built from WhatsAppConversationLog: volume,
// where it failed to answer (grouped so the same question asked ten ways surfaces
// once), product questions sellers should fix in their listings, handoffs, and the
// browse -> cart -> checkout -> payment funnel. Consumed by
// app/api/admin/whatsapp/digest (JSON, and optionally sent to the support WhatsApp).
import connectToDatabase from '@/lib/mongodb'
import { WhatsAppConversationLog } from '@/lib/models/WhatsAppConversationLog'
import { Order } from '@/lib/models/Order'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'

export interface Digest {
  since: string
  until: string
  inbound: number
  outbound: number
  uniqueBuyers: number
  newBuyers: number
  unanswered: Array<{ text: string; count: number; outcome: string }>
  productQuestions: Array<{ productName: string; productId: string; count: number; examples: string[] }>
  unsupported: Record<string, number>
  handoffs: number
  funnel: { searches: number; cartAdds: number; checkouts: number; paymentLinks: number; ordersPaid: number }
}

function normalise(text: string): string {
  return String(text || '').toLowerCase().replace(/[^\w\s₦]/g, ' ').replace(/\d[\d,]*\s*k?/g, '#').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export async function buildDigest(hours = 24): Promise<Digest> {
  await connectToDatabase()
  const until = new Date()
  const since = new Date(until.getTime() - hours * 60 * 60 * 1000)
  const window = { createdAt: { $gte: since, $lte: until } }

  const [inbound, outbound, buyers, entries, newBuyers, waCustomerIds] = await Promise.all([
    WhatsAppConversationLog.countDocuments({ ...window, direction: 'in' }),
    WhatsAppConversationLog.countDocuments({ ...window, direction: 'out' }),
    WhatsAppConversationLog.distinct('waId', { ...window, direction: 'in' }),
    WhatsAppConversationLog.find({ ...window }).select('waId direction kind text outcome detail').lean(),
    WhatsAppBuyer.countDocuments({ createdAt: { $gte: since } }),
    WhatsAppBuyer.distinct('customerId'),
  ])
  // Orders paid by WhatsApp buyers in the window (the bot's own conversions).
  const ordersPaid = await Order.countDocuments({ createdAt: { $gte: since }, paymentStatus: { $in: ['paid', 'escrow'] }, customerId: { $in: waCustomerIds } })

  const unansweredMap = new Map<string, { text: string; count: number; outcome: string }>()
  const productMap = new Map<string, { productName: string; productId: string; count: number; examples: string[] }>()
  const unsupported: Record<string, number> = {}
  let handoffs = 0
  const funnel = { searches: 0, cartAdds: 0, checkouts: 0, paymentLinks: 0, ordersPaid }

  for (const e of entries as any[]) {
    if (e.direction === 'in') {
      if (e.outcome === 'no_match' || e.outcome === 'clarify') {
        const key = normalise(e.detail?.query || e.text)
        const cur = unansweredMap.get(key) || { text: String(e.detail?.query || e.text).slice(0, 80), count: 0, outcome: e.outcome }
        cur.count++
        unansweredMap.set(key, cur)
      } else if (e.outcome === 'product_question_unanswered') {
        const id = String(e.detail?.productId || '')
        const cur = productMap.get(id) || { productName: String(e.detail?.productName || 'Unknown'), productId: id, count: 0, examples: [] }
        cur.count++
        if (cur.examples.length < 3) cur.examples.push(String(e.detail?.question || e.text).slice(0, 80))
        productMap.set(id, cur)
      } else if (e.outcome === 'unsupported') {
        const type = String(e.detail?.type || e.kind || 'unknown')
        unsupported[type] = (unsupported[type] || 0) + 1
      } else if (e.outcome === 'handoff') {
        handoffs++
      }
    } else {
      const text = String(e.text || '')
      if (/^(?:\d+\. |Closest |Lowest-rate |I don't have ".*" exactly)/.test(text) || e.kind === 'image') funnel.searches++
      if (/^Added: /.test(text)) funnel.cartAdds++
      if (/^What's your name\?|^What's your delivery address\?/.test(text)) funnel.checkouts++
      if (/Tap the link below to pay|Here's the payment link/.test(text)) funnel.paymentLinks++
    }
  }

  return {
    since: since.toISOString(),
    until: until.toISOString(),
    inbound,
    outbound,
    uniqueBuyers: buyers.length,
    newBuyers,
    unanswered: Array.from(unansweredMap.values()).sort((a, b) => b.count - a.count).slice(0, 25),
    productQuestions: Array.from(productMap.values()).sort((a, b) => b.count - a.count).slice(0, 15),
    unsupported,
    handoffs,
    funnel,
  }
}

export function formatDigestForWhatsApp(d: Digest): string {
  const lines = [
    `📊 WhatsApp bot — last 24h`,
    `${d.inbound} messages from ${d.uniqueBuyers} buyers (${d.newBuyers} new) · ${d.outbound} replies`,
    `Funnel: ${d.funnel.searches} searches → ${d.funnel.cartAdds} cart adds → ${d.funnel.checkouts} checkouts → ${d.funnel.paymentLinks} payment links → ${d.funnel.ordersPaid} paid`,
    `Handoffs to a human: ${d.handoffs}`,
  ]
  const unsupported = Object.entries(d.unsupported)
  if (unsupported.length) lines.push(`Unsupported: ${unsupported.map(([k, v]) => `${k} ×${v}`).join(', ')}`)
  if (d.unanswered.length) {
    lines.push('', `❌ Couldn't answer (${d.unanswered.reduce((n, u) => n + u.count, 0)}):`)
    for (const u of d.unanswered.slice(0, 10)) lines.push(`- "${u.text}"${u.count > 1 ? ` ×${u.count}` : ''}`)
  } else {
    lines.push('', '✅ Nothing unanswered')
  }
  if (d.productQuestions.length) {
    lines.push('', '🏷️ Listings buyers asked about that need more detail:')
    for (const p of d.productQuestions.slice(0, 5)) lines.push(`- ${p.productName} ×${p.count}: "${p.examples[0]}"`)
  }
  return lines.join('\n')
}
