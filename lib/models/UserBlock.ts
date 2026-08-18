import mongoose, { Schema, models } from 'mongoose'

// A one-directional block: blockerId no longer wants to hear from blockedUserId.
// Enforced in /api/messages/send (rejects a send in either direction once either party
// has blocked the other) and used to let a user manage/undo their own blocks from
// account settings. Required for App Store Guideline 1.2 (apps with user-to-user
// messaging must let a user block another user).
const UserBlockSchema = new Schema({
  blockerId: { type: String, required: true, index: true },
  blockedUserId: { type: String, required: true, index: true },
  blockedUserName: { type: String },
  createdAt: { type: Date, default: Date.now },
})

UserBlockSchema.index({ blockerId: 1, blockedUserId: 1 }, { unique: true })

export const UserBlock = models.UserBlock || mongoose.model('UserBlock', UserBlockSchema)
