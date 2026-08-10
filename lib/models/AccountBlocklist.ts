import mongoose, { Schema, models } from 'mongoose'

// One-way hashes only — never the raw email/phone. This collection exists so (a) a
// fraud-banned account can't cleanly re-register with the same email/phone, and (b) the
// platform can answer a fraud/authority inquiry ("was this email ever banned") without
// holding onto live personal data for accounts that were otherwise fully erased.
const AccountBlocklistSchema = new Schema({
  emailHash: { type: String, index: true, sparse: true },
  phoneHash: { type: String, index: true, sparse: true },
  reason: { type: String, required: true },
  // Links back to the (now-erased/pseudonymized) user this came from, for audit/support
  // lookups. Not reversible to email/phone — the account it points to no longer holds
  // either in readable form by the time this entry exists.
  originalUserId: { type: String },
  createdAt: { type: Date, default: Date.now },
})

export const AccountBlocklist =
  models.AccountBlocklist || mongoose.model('AccountBlocklist', AccountBlocklistSchema)
