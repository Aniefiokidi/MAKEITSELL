import mongoose, { Schema, model, models } from 'mongoose'

// Every inbound and outbound bot message, so the team can see what buyers actually say
// and where the bot fell short — the raw material for the daily digest
// (app/api/admin/whatsapp/digest) and, later, an inbox UI. `outcome` is set on the
// inbound entry by the router when it knows it didn't really answer (no match, clarify,
// unsupported type) or handed off. 90-day TTL keeps the collection bounded.
const WhatsAppConversationLogSchema = new Schema({
  waId: { type: String, required: true, index: true },
  direction: { type: String, enum: ['in', 'out'], required: true },
  kind: { type: String, default: 'text' },
  text: { type: String, default: '' },
  outcome: { type: String, index: true }, // 'no_match' | 'clarify' | 'unsupported' | 'handoff' | 'product_question_unanswered'
  detail: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
})
WhatsAppConversationLogSchema.index({ waId: 1, createdAt: -1 })
WhatsAppConversationLogSchema.index({ createdAt: -1 })

export const WhatsAppConversationLog =
  models.WhatsAppConversationLog || model('WhatsAppConversationLog', WhatsAppConversationLogSchema)
