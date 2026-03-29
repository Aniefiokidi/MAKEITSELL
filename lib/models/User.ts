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
  otp_last_sent_at: { type: Date },
  otp_attempts: { type: Number, default: 0 },
  otp_attempts_reset_at: { type: Date },
  role: { type: String, default: 'customer' },
  walletBalance: { type: Number, default: 0 },
  withdrawalPinHash: { type: String },
  withdrawalPinSetAt: { type: Date },
  payoutProfile: { type: Schema.Types.Mixed },
  vendorInfo: { type: Schema.Types.Mixed },
  sessionToken: { type: String },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationTokenExpiry: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const User = models.User || model('User', UserSchema);
