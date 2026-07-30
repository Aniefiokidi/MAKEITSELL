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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const WhatsAppLink = models.WhatsAppLink || model('WhatsAppLink', WhatsAppLinkSchema);
