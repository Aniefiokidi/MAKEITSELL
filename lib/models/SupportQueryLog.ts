import mongoose, { Schema, models, model } from 'mongoose'

const SupportQueryLogSchema = new Schema({
  query: { type: String, required: true },
  normalizedQuery: { type: String, required: true, index: true },
  lang: { type: String, enum: ['en', 'pcm'], required: true },
  matchedEntryId: { type: String, default: null, index: true }, // null = fell through to fallback/disambiguation
  userId: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
})

export const SupportQueryLog = models.SupportQueryLog || model('SupportQueryLog', SupportQueryLogSchema)
