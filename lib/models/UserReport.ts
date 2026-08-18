import mongoose, { Schema, models } from 'mongoose'

export const REPORT_REASONS = ['spam', 'harassment', 'scam', 'inappropriate', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

// A user-submitted report of another user's behavior, typically raised from a chat
// conversation. Reporting doesn't block by itself — the two are deliberately separate
// actions (see UserBlock) so a user can report something and keep the conversation open,
// or block without formally reporting. Required alongside UserBlock for App Store
// Guideline 1.2 (apps with user-to-user messaging must offer a way to report abuse).
const UserReportSchema = new Schema({
  reporterId: { type: String, required: true, index: true },
  reporterName: { type: String },
  reportedUserId: { type: String, required: true, index: true },
  reportedUserName: { type: String },
  reason: { type: String, required: true, enum: REPORT_REASONS },
  description: { type: String },
  conversationId: { type: String },
  status: { type: String, default: 'open', enum: ['open', 'reviewed', 'dismissed'] },
  createdAt: { type: Date, default: Date.now },
})

export const UserReport = models.UserReport || mongoose.model('UserReport', UserReportSchema)
