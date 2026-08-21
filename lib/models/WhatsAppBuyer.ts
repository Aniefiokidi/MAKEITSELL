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
  // Customer withdrawal conversation state (lib/whatsapp/customer-withdrawal.ts) — same
  // shape and reasoning as the withdrawal fields on lib/models/WhatsAppLink.ts (the
  // vendor-side equivalent): this doc is already unique-per-identity and read on every
  // inbound buyer message.
  withdrawalStage: {
    type: String,
    enum: ['idle', 'awaiting_amount', 'awaiting_bank_choice', 'awaiting_pin', 'awaiting_confirmation'],
    default: 'idle',
  },
  withdrawalDraft: { type: Schema.Types.Mixed, default: {} },
  withdrawalStageExpiresAt: { type: Date, default: null },
  withdrawalPinFailCount: { type: Number, default: 0 },
  withdrawalPinLockedUntil: { type: Date, default: null },
  // Account-claiming (lib/whatsapp/claim-account.ts) — a single-use, expiring token
  // embedded in the web link sent to the buyer, so setting a real password never happens
  // over WhatsApp chat itself.
  claimToken: { type: String, default: null },
  claimTokenExpiresAt: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now },
});

export const WhatsAppBuyer = models.WhatsAppBuyer || model('WhatsAppBuyer', WhatsAppBuyerSchema);
