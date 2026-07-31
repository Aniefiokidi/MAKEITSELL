import mongoose, { Schema, model, models } from 'mongoose';

// Maps an outbound product-result image message's WhatsApp message ID back to the
// product it showed — lets a buyer "reply to select" a product from a search/category
// burst (lib/whatsapp/checkout.ts), the same context.id resolution pattern already used
// for the vendor "Mark as dispatched" button (WhatsAppMessageMap). Persistent (a real
// collection, not in-memory) for the same reason as every other WhatsApp state in this
// app: a buyer's reply can arrive well after a serverless redeploy/restart.
//
// Short TTL (48h) relative to WhatsAppMessageMap's 90 days — these are ephemeral browse-
// session artifacts, not something a buyer would reasonably expect to still be able to
// tap after a couple of days. An expired mapping just means the reply falls back to
// "couldn't find that item — search again" rather than resolving automatically.
const WhatsAppProductMessageMapSchema = new Schema({
  messageId: { type: String, required: true, unique: true, index: true },
  productId: { type: String, required: true },
  waId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 48 },
});

export const WhatsAppProductMessageMap =
  models.WhatsAppProductMessageMap || model('WhatsAppProductMessageMap', WhatsAppProductMessageMapSchema);
