import mongoose, { Schema, model, models } from 'mongoose';

// One doc per vendor represents their current WhatsApp link state — upserted on
// vendorId, not an ever-growing history table. `code`/`codeExpiresAt` hold the most
// recently generated code; once used, `status` flips to 'linked' so the same code can
// never match again (single-use is enforced by the status check in the lookup query,
// not by deleting the code). A wa_id can only be linked to one vendor at a time — see
// lib/whatsapp/commands.ts, which unlinks any other vendor's doc holding the same wa_id
// before linking it here.
const WhatsAppLinkSchema = new Schema({
  vendorId: { type: String, required: true, unique: true, index: true },
  waId: { type: String, default: null, index: true },
  code: { type: String, default: null },
  codeExpiresAt: { type: Date, default: null },
  linkedAt: { type: Date, default: null },
  status: { type: String, enum: ['pending', 'linked'], default: 'pending' },
  // WhatsApp withdrawal conversation state (lib/whatsapp/vendor-withdrawal.ts). Lives here
  // rather than a new collection: this doc is already read on every inbound message
  // (resolveLinkedVendor), is unique per vendor (naturally serializes one flow at a time),
  // and survives an unlink/relink cycle — so lockout can't be dodged by relinking a new
  // number to the same vendor account.
  withdrawalStage: {
    type: String,
    enum: ['idle', 'awaiting_amount', 'awaiting_bank_choice', 'awaiting_pin', 'awaiting_confirmation'],
    default: 'idle',
  },
  withdrawalDraft: { type: Schema.Types.Mixed, default: {} },
  withdrawalStageExpiresAt: { type: Date, default: null },
  withdrawalPinFailCount: { type: Number, default: 0 },
  withdrawalPinLockedUntil: { type: Date, default: null },
  // Lets a linked vendor also browse/buy through the bot (lib/whatsapp/vendor-shopping.ts)
  // using their own real account rather than a fresh placeholder buyer — toggled by
  // "shop"/"stop shopping". Financial vendor commands (withdraw/topup) are always checked
  // before this takes effect, regardless of its value — see commands.ts's dispatch order.
  shoppingMode: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const WhatsAppLink = models.WhatsAppLink || model('WhatsAppLink', WhatsAppLinkSchema);
