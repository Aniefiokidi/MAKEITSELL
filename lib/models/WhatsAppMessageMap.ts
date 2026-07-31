import mongoose, { Schema, model, models } from 'mongoose';

// Maps an outbound order_received template message's WhatsApp message ID back to the
// order/vendor it was about — the only way a "Mark as dispatched" quick-reply button tap
// (which arrives with just message.context.id, no order info of its own) can be resolved
// back to an order. Persistent (a real collection, not in-memory) so mappings survive
// redeploys/restarts — an in-memory map would silently break every outstanding button
// the moment the server restarted.
//
// TTL index: these accumulate one doc per order_received send with nothing to prune them
// otherwise. Auto-expires after 90 days — a tap on a 3-month-old notification is
// vanishingly rare, and the typed "dispatched [ref]" command is always available as a
// fallback, so an expired mapping is never a dead end for the vendor.
const WhatsAppMessageMapSchema = new Schema({
  messageId: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, required: true, index: true },
  vendorId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
});

export const WhatsAppMessageMap =
  models.WhatsAppMessageMap || model('WhatsAppMessageMap', WhatsAppMessageMapSchema);
