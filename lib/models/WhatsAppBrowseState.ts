import mongoose, { Schema, model, models } from 'mongoose';

// Per-buyer paging state for the WhatsApp product-browsing flow — one doc per waId,
// upserted on every search/category tap. Persistent (a real collection, not in-memory)
// so "more" keeps working across serverless invocations/redeploys, matching the same
// reasoning as WhatsAppMessageMap.
const WhatsAppBrowseStateSchema = new Schema({
  waId: { type: String, required: true, unique: true, index: true },
  lastQuery: { type: String, required: true },
  offset: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

export const WhatsAppBrowseState =
  models.WhatsAppBrowseState || model('WhatsAppBrowseState', WhatsAppBrowseStateSchema);
