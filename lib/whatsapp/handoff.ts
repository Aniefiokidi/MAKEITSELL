// Human handoff without an inbox UI: when a buyer asks for a person, the bot goes quiet
// for that number and relays the conversation to the support team's WhatsApp
// (SUPPORT_WHATSAPP_NUMBER). Support answers through the bot with "r <number> <text>"
// and hands back with "bot <number>". The buyer can come back with "bot" at any time,
// and an idle handoff expires on its own so nobody is stranded.
import connectToDatabase from '@/lib/mongodb'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import { sendTextMessage } from '@/lib/whatsapp/client'

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
    `👤 Buyer ${waId} asked for a human.\nTheir message: "${lastMessage}"\n\nReply to them with:\nr ${waId} <your message>\n\nHand them back to the bot with:\nbot ${waId}`
  )
}

export async function forwardToSupport(waId: string, text: string, state: any): Promise<void> {
  await connectToDatabase()
  await WhatsAppBrowseState.updateOne({ waId }, { $set: { handoffLastActivityAt: new Date() } })
  if (!supportNumberConfigured()) {
    // Support number removed mid-conversation — don't swallow the buyer's message.
    await endHandoff(waId)
    await trySend(waId, "Our team isn't reachable here right now — email support@makeitsell.ng and they'll get back to you. I'm here for anything else.")
    return
  }
  await trySend(supportNumber(), `💬 ${waId}: ${text}`)
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

  const release = trimmed.match(/^(?:bot|release|done|close)\s+\+?(\d{10,15})$/i)
  if (release) {
    await endHandoff(release[1])
    await trySend(release[1], "Our team has handed you back to me. What can I find for you?")
    await trySend(senderWaId, `↩️ ${release[1]} is back with the bot.`)
    return true
  }

  if (/^(?:help|commands)$/i.test(trimmed)) {
    await trySend(senderWaId, 'Support commands:\nr <number> <message> — reply to a buyer\nbot <number> — hand a buyer back to the bot')
    return true
  }
  return false
}
