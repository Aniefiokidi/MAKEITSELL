// Fire-and-forget logging helpers around WhatsAppConversationLog. Never throws, never
// awaited on the hot path beyond a single insert, so a logging hiccup can't break a
// reply.
import connectToDatabase from '@/lib/mongodb'
import { WhatsAppConversationLog } from '@/lib/models/WhatsAppConversationLog'

export type Outcome = 'no_match' | 'clarify' | 'unsupported' | 'handoff' | 'product_question_unanswered'

export async function logInbound(waId: string, kind: string, text: string, detail?: Record<string, unknown>): Promise<void> {
  try {
    await connectToDatabase()
    await WhatsAppConversationLog.create({ waId, direction: 'in', kind, text: String(text || '').slice(0, 2000), detail })
  } catch (error) {
    console.error('[whatsapp-log] inbound log failed:', error)
  }
}

export async function logOutbound(waId: string, kind: string, text: string, detail?: Record<string, unknown>): Promise<void> {
  try {
    await connectToDatabase()
    await WhatsAppConversationLog.create({ waId, direction: 'out', kind, text: String(text || '').slice(0, 2000), detail })
  } catch (error) {
    console.error('[whatsapp-log] outbound log failed:', error)
  }
}

// Marks the buyer's most recent inbound message (within the last minute) with how the
// bot fared — called by the router at the points where it knows it didn't answer.
export async function recordOutcome(waId: string, outcome: Outcome, detail?: Record<string, unknown>): Promise<void> {
  try {
    await connectToDatabase()
    const since = new Date(Date.now() - 60 * 1000)
    await WhatsAppConversationLog.findOneAndUpdate(
      { waId, direction: 'in', createdAt: { $gte: since } },
      { $set: { outcome, ...(detail ? { detail } : {}) } },
      { sort: { createdAt: -1 } }
    )
  } catch (error) {
    console.error('[whatsapp-log] outcome update failed:', error)
  }
}
