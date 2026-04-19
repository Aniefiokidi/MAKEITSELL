import { Schema, model, models } from 'mongoose'

const SmsDeliveryLogSchema = new Schema({
  provider: { type: String, default: 'termii', index: true },
  messageId: { type: String, required: true, unique: true, index: true },
  sender: { type: String },
  receiver: { type: String, index: true },
  message: { type: String },
  channel: { type: String, index: true },
  status: { type: String, index: true },
  cost: { type: String },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  failedAt: { type: Date },
  failureReason: { type: String },
  rawPayload: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now, index: true },
})

export const SmsDeliveryLog = models.SmsDeliveryLog || model('SmsDeliveryLog', SmsDeliveryLogSchema)
