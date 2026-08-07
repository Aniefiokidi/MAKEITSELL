import mongoose, { Schema, model, models } from 'mongoose';

// Services counterpart to WhatsAppProductMessageMap — maps an outbound service-result
// image message's WhatsApp message ID back to the service it showed, so a buyer replying
// to a specific service result starts that service's booking flow
// (lib/whatsapp/service-booking.ts). Same 48h TTL, same rationale: ephemeral browse-
// session artifact, not something worth resolving days later.
const WhatsAppServiceMessageMapSchema = new Schema({
  messageId: { type: String, required: true, unique: true, index: true },
  serviceId: { type: String, required: true },
  waId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 48 },
});

export const WhatsAppServiceMessageMap =
  models.WhatsAppServiceMessageMap || model('WhatsAppServiceMessageMap', WhatsAppServiceMessageMapSchema);
