import mongoose, { Schema, model, models } from 'mongoose';

// Canonical User schema (shared by auth + operations)
const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  // Legacy plain password field (deprecated). Kept to avoid schema drop errors if present.
  password: { type: String },
  // Current hashed password used by auth.ts
  passwordHash: { type: String },
  name: { type: String },
  displayName: { type: String },
  profileImage: { type: String },
  phone: { type: String },
  phone_number: { type: String },
  phone_verified: { type: Boolean, default: false },
  otp_code: { type: String },
  otp_expiry: { type: Date },
  otp_voice_pin_id: { type: String },
  otp_voice_pin_expiry: { type: Date },
  otp_last_sent_at: { type: Date },
  otp_attempts: { type: Number, default: 0 },
  otp_attempts_reset_at: { type: Date },
  role: { type: String, default: 'customer' },
  walletBalance: { type: Number, default: 0 },
  // Sub-balances used for withdrawal commission calculation.
  // earnedBalance: from product sales — 5% commission on withdrawal.
  // depositedBalance: vendor top-ups — no commission.
  // prizeBalance: MIS prize payments (streak, referrals, champions) — no commission.
  // walletBalance stays as the total of all three for backward compatibility.
  // MIGRATION NOTE: any walletBalance present at deploy time is treated as earnedBalance.
  earnedBalance: { type: Number, default: 0 },
  depositedBalance: { type: Number, default: 0 },
  prizeBalance: { type: Number, default: 0 },
  withdrawalPinHash: { type: String },
  withdrawalPinSetAt: { type: Date },
  payoutProfile: { type: Schema.Types.Mixed },
  vendorInfo: { type: Schema.Types.Mixed },
  riderInfo: { type: Schema.Types.Mixed },
  sessionToken: { type: String },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationTokenExpiry: { type: Date },
  // Failed OTP-check counter for the current emailVerificationToken — locks further
  // attempts after too many wrong guesses (app/api/auth/verify-email/route.ts's PUT
  // handler), independent of the IP-based rate limit on that same route. A 6-digit code
  // is only ~1M combinations; IP throttling alone doesn't stop a distributed/rotating-IP
  // attacker from brute-forcing it, since this is scoped to the account, not the request
  // source. Reset to 0 whenever a fresh code is issued or verification succeeds.
  emailVerificationAttempts: { type: Number, default: 0 },
  verificationEmailRetryPending: { type: Boolean, default: false },
  verificationEmailRetryCount: { type: Number, default: 0 },
  verificationEmailNextRetryAt: { type: Date },
  verificationEmailLastAttemptAt: { type: Date },
  verificationEmailLastError: { type: String },
  mustChangePassword: { type: Boolean, default: false },
  temporaryPasswordIssuedAt: { type: Date },
  // Referral programme fields
  referralCode: { type: String, sparse: true, index: true },
  referredByVendorId: { type: String },
  referralCreditIssued: { type: Boolean, default: false },
  referralClickCount: { type: Number, default: 0 },
  // Account-deletion support (lib/account-deletion.ts). deletedAt is the source of truth
  // for "is this account deleted" — checked at login (lib/auth.ts) so a deleted account
  // can never authenticate again even if a session token somehow lingered.
  deletedAt: { type: Date, index: true },
  // No fraud-detection feature exists yet — this field is intentionally unset for every
  // account today. It exists so a future fraud-review feature has somewhere to write
  // `true`, at which point account deletion (lib/account-deletion.ts) starts adding the
  // hashed email/phone to AccountBlocklist automatically. Until then this never matches
  // anyone, so normal account deletions never blocklist the user.
  fraudBanned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const User = models.User || model('User', UserSchema);
