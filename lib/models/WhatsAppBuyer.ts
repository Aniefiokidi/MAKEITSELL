import mongoose, { Schema, model, models } from 'mongoose';

// Maps a WhatsApp buyer's verified wa_id to their (auto-created, passwordless) User
// record — the buyer-side counterpart to WhatsAppLink, which maps a VENDOR's wa_id to
// their existing account via a code the vendor requests from their dashboard. Buyers
// have no existing account to link to, so this is a find-or-create mapping rather than
// a code-based linking flow: the first time a wa_id places an order (see
// lib/whatsapp/buyer-identity.ts), a minimal User document is created and the mapping
// recorded here; every later order from the same number reuses it.
const WhatsAppBuyerSchema = new Schema({
  waId: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

export const WhatsAppBuyer = models.WhatsAppBuyer || model('WhatsAppBuyer', WhatsAppBuyerSchema);
