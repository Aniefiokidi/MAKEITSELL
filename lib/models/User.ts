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
  role: { type: String, default: 'customer' },
  vendorInfo: { type: Schema.Types.Mixed },
  sessionToken: { type: String },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationTokenExpiry: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const User = models.User || model('User', UserSchema);
