import mongoose, { Schema, model, models } from 'mongoose'

// One row per inbound WhatsApp message id we've started processing. Meta re-delivers a
// webhook whenever it doesn't get a fast 200 (slow cold start, timeout, transient error),
// and re-processing "add 2" would put a second pair of sneakers in the cart. The unique
// index makes the first insert win; a duplicate key error means "already handled, skip".
// Rows expire after a day — Meta's retry window is far shorter than that.
const WhatsAppInboundMessageSchema = new Schema({
  messageId: { type: String, required: true, unique: true, index: true },
  waId: { type: String, required: true },
  type: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
})

export const WhatsAppInboundMessage =
  models.WhatsAppInboundMessage || model('WhatsAppInboundMessage', WhatsAppInboundMessageSchema)
