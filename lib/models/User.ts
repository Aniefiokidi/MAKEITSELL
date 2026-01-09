import mongoose, { Schema, model, models } from 'mongoose';

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  displayName: { type: String },
  name: { type: String },
  profileImage: { type: String },
  role: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const User = models.User || model('User', UserSchema);
