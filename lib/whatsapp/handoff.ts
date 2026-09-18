// Human handoff without an inbox UI: when a buyer asks for a person, the bot goes quiet
// for that number and relays the conversation to the support team's WhatsApp
// (SUPPORT_WHATSAPP_NUMBER). Support answers through the bot with "r <number> <text>"
// and hands back with "bot <number>". The buyer can come back with "bot" at any time,
// and an idle handoff expires on its own so nobody is stranded.
import connectToDatabase from '@/lib/mongodb'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import { sendTextMessage } from '@/lib/whatsapp/client'
import { Product } from '@/lib/models/Product'

export const HANDOFF_IDLE_HOURS = 12

export function supportNumber(): string {
  return String(process.env.SUPPORT_WHATSAPP_NUMBER || '').replace(/\D/g, '')
}

export function supportNumberConfigured(): boolean {
  return supportNumber().length >= 10
}

export function isHandedOff(state: any): boolean {
  if (!state || state.mode !== 'human') return false
  const last = state.handoffLastActivityAt || state.handoffAt
  if (!last) return false
  return Date.now() - new Date(last).getTime() < HANDOFF_IDLE_HOURS * 60 * 60 * 1000
}

async function trySend(to: string, body: string): Promise<void> {
  try {
    await sendTextMessage(to, body)
  } catch (error) {
    console.error(`[whatsapp-handoff] send to ${to} failed:`, error)
  }
}

export async function beginHandoff(waId: string, lastMessage: string): Promise<void> {
  await connectToDatabase()
  const now = new Date()
  await WhatsAppBrowseState.findOneAndUpdate(
    { waId },
    { $set: { mode: 'human', handoffAt: now, handoffLastActivityAt: now, updatedAt: now } },
    { upsert: true }
  )
  await trySend(waId, "I've passed this to our support team — a person will reply here shortly. Reply \"bot\" any time to come back to me.")
  await trySend(
    supportNumber(),
    `👤 Buyer ${waId} asked for a human.\nTheir message: "${lastMessage}"\n\nReply: r ${waId} <your message>\nFind for them: find ${waId} <what>\nHand back: bot ${waId}\n(Type "help" for all commands.)`
  )
}

export async function forwardToSupport(waId: string, text: string, state: any, options: { botHandled?: boolean } = {}): Promise<void> {
  await connectToDatabase()
  await WhatsAppBrowseState.updateOne({ waId }, { $set: { handoffLastActivityAt: new Date() } })
  if (!supportNumberConfigured()) {
    // Support number removed mid-conversation — don't swallow the buyer's message.
    await endHandoff(waId)
    await trySend(waId, "Our team isn't reachable here right now — email support@makeitsell.ng and they'll get back to you. I'm here for anything else.")
    return
  }
  await trySend(supportNumber(), options.botHandled ? `🤖 ${waId} (handled by bot): ${text}` : `💬 ${waId}: ${text}`)
}

const AGENT_HELP = [
  'Support commands (replace NUMBER with the buyer\'s number):',
  'r NUMBER <message> — reply to the buyer',
  'find NUMBER <what> — search and send product cards (e.g. find NUMBER black sneakers under 20k)',
  'service NUMBER <what> — send nearest service providers',
  'send NUMBER <card #> — re-send one card from the last search',
  'add NUMBER <card #> [x<qty>] — put a card in their cart',
  'cart NUMBER — see their cart',
  'checkout NUMBER — start checkout on their side (name, address, delivery, payment link)',
  'orders NUMBER — see their orders',
  'link NUMBER <what> — send a website search link',
  'bot NUMBER — hand them back to the bot',
].join('\n')

// After acting on the buyer's behalf, tell the agent what the buyer now sees.
async function reportRecentCards(agent: string, buyer: string, verb: string): Promise<void> {
  const state: any = await WhatsAppBrowseState.findOne({ waId: buyer }).select('lastResults').lean()
  const results: any[] = Array.isArray(state?.lastResults) ? state.lastResults : []
  await trySend(agent, results.length
    ? `✅ ${verb} ${buyer}:\n${results.map((r, i) => `${i + 1}. ${r.name}${r.price ? ` — NGN ${Number(r.price).toLocaleString('en-NG')}` : ''}`).join('\n')}\n\nThey can reply with a number; you can "add ${buyer} <#>" or "checkout ${buyer}".`
    : `⚠️ Nothing found to send to ${buyer}. Try different words, or "link ${buyer} <what>".`)
}

export async function endHandoff(waId: string): Promise<void> {
  await connectToDatabase()
  await WhatsAppBrowseState.updateOne({ waId }, { $set: { mode: 'bot', updatedAt: new Date() }, $unset: { handoffAt: '', handoffLastActivityAt: '' } })
}

// Commands typed by the support number itself. Returns false when the sender isn't the
// support number or the text isn't one of its commands.
export async function tryHandleSupportCommand(senderWaId: string, text: string): Promise<boolean> {
  if (!supportNumberConfigured() || senderWaId.replace(/\D/g, '') !== supportNumber()) return false
  const trimmed = String(text || '').trim()

  const reply = trimmed.match(/^(?:r|reply)\s+\+?(\d{10,15})\s+([\s\S]+)$/i)
  if (reply) {
    const buyer = reply[1]
    await connectToDatabase()
    const now = new Date()
    await WhatsAppBrowseState.findOneAndUpdate(
      { waId: buyer },
      { $set: { mode: 'human', handoffLastActivityAt: now, updatedAt: now }, $setOnInsert: { handoffAt: now } },
      { upsert: true }
    )
    try {
      await sendTextMessage(buyer, reply[2].trim())
      await trySend(senderWaId, `✅ Sent to ${buyer}.`)
    } catch (error: any) {
      await trySend(senderWaId, `❌ Couldn't send to ${buyer}: ${error?.message || 'unknown error'}. If they last wrote more than 24h ago, WhatsApp only allows template messages.`)
    }
    return true
  }

  // Acting on the buyer's behalf. The buyer is put in human mode (if not already) so
  // their follow-up questions keep coming to this agent.
  const act = trimmed.match(/^(find|search|service|send|add|cart|checkout|orders|link)\s+\+?(\d{10,15})(?:\s+([\s\S]+))?$/i)
  if (act) {
    const verb = act[1].toLowerCase()
    const buyer = act[2]
    const arg = String(act[3] || '').trim()
    const { handleBuyerMessage } = await import('@/lib/whatsapp/buyer')
    const { handleProductAction, handleCheckoutStart, describeCart } = await import('@/lib/whatsapp/checkout')
    const { sendProductResults } = await import('@/lib/whatsapp/product-results')
    await connectToDatabase()
    const now = new Date()
    await WhatsAppBrowseState.findOneAndUpdate(
      { waId: buyer },
      { $set: { mode: 'human', handoffLastActivityAt: now, updatedAt: now }, $setOnInsert: { handoffAt: now } },
      { upsert: true }
    )
    const state: any = await WhatsAppBrowseState.findOne({ waId: buyer }).lean()
    const results: any[] = Array.isArray(state?.lastResults) ? state.lastResults : []

    if ((verb === 'find' || verb === 'search') && arg) {
      await WhatsAppBrowseState.updateOne({ waId: buyer }, { $set: { browseMode: 'goods' } })
      await handleBuyerMessage(buyer, arg, undefined, { asAgent: true })
      await reportRecentCards(senderWaId, buyer, 'Sent to')
      return true
    }
    if (verb === 'service' && arg) {
      await WhatsAppBrowseState.updateOne({ waId: buyer }, { $set: { browseMode: 'services' } })
      await handleBuyerMessage(buyer, arg, undefined, { asAgent: true })
      await reportRecentCards(senderWaId, buyer, 'Sent providers to')
      return true
    }
    if (verb === 'send') {
      const index = Number(arg) - 1
      const target = results[index]
      if (!target) { await trySend(senderWaId, `No card #${arg} — run "find ${buyer} <what>" first.`); return true }
      if (target.kind === 'service') {
        const { resendProviderDetails } = await import('@/lib/whatsapp/service-contacts')
        await resendProviderDetails(buyer, target.id, state?.buyerLocation || null)
      } else {
        const product: any = await Product.findById(target.id).lean()
        if (product) await sendProductResults(buyer, [{ ...product, id: String(product._id) }], { append: true })
      }
      await trySend(senderWaId, `✅ Re-sent "${target.name}" to ${buyer}.`)
      return true
    }
    if (verb === 'add') {
      const m = arg.match(/^(\d{1,2})(?:\s*x\s*(\d{1,2}))?/)
      const target = m ? results[Number(m[1]) - 1] : undefined
      if (!target || target.kind !== 'product') { await trySend(senderWaId, `No product card #${arg} — run "find ${buyer} <what>" first.`); return true }
      await handleProductAction(buyer, target.id, `add ${m?.[2] ? Number(m[2]) : 1}`)
      await trySend(senderWaId, `✅ Added ${target.name} to ${buyer}'s cart.\n\n${await describeCart(buyer)}`)
      return true
    }
    if (verb === 'cart') {
      await trySend(senderWaId, `🛒 ${buyer}:\n${await describeCart(buyer)}`)
      return true
    }
    if (verb === 'checkout') {
      await handleCheckoutStart(buyer)
      await trySend(senderWaId, `✅ Checkout started for ${buyer} — the bot will collect their name/address and send the payment link. You'll see their replies here.`)
      return true
    }
    if (verb === 'orders') {
      await handleBuyerMessage(buyer, 'my orders', undefined, { asAgent: true })
      await trySend(senderWaId, `✅ Sent ${buyer} their order list.`)
      return true
    }
    if (verb === 'link' && arg) {
      const base = String(process.env.NEXT_PUBLIC_APP_URL || 'https://makeitsell.ng').replace(/\/+$/, '')
      const url = `${base}/search?q=${encodeURIComponent(arg)}`
      await trySend(buyer, `Here's everything we have for "${arg}": ${url}`)
      await trySend(senderWaId, `✅ Sent ${buyer} ${url}`)
      return true
    }
    await trySend(senderWaId, AGENT_HELP)
    return true
  }

  const release = trimmed.match(/^(?:bot|release|done|close)\s+\+?(\d{10,15})$/i)
  if (release) {
    await endHandoff(release[1])
    await trySend(release[1], "Our team has handed you back to me. What can I find for you?")
    await trySend(senderWaId, `↩️ ${release[1]} is back with the bot.`)
    return true
  }

  if (/^(?:help|commands|\?)$/i.test(trimmed)) {
    await trySend(senderWaId, AGENT_HELP)
    return true
  }
  return false
}
