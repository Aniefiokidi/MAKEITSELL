import { Schema, model, models } from 'mongoose';

// Vendor vetting for accounts created via the mobile apps (customer app's "Become a
// Vendor" and the vendor app's own upgrade gate) — the website's vendor signup stays
// immediate/unreviewed by design, this collection is only ever written to by those two
// mobile flows and the admin approve/reject route. Kept as its own collection rather
// than fields on User so a rejected-then-resubmitted history stays intact.
const VendorApplicationSchema = new Schema({
  userId: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  vendorType: { type: String, enum: ['goods', 'services', 'both'], required: true },
  whatTheyPlanToSell: { type: String, required: true },
  expectedMonthlyIncome: { type: String, required: true },
  // Nigeria's National Identification Number — 11 digits. Stored as plain text like
  // every other field on this app today (phone, email, etc.); reads are restricted to
  // admin-role API calls, never returned to the applicant or any other user.
  nin: { type: String, required: true },
  proofOfAddressUrl: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: String },
  rejectionReason: { type: String },
});

export const VendorApplication = models.VendorApplication || model('VendorApplication', VendorApplicationSchema);
