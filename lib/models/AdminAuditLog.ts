import mongoose, { Schema, models, model } from 'mongoose'

const AdminAuditLogSchema = new Schema({
  action: { type: String, required: true, index: true },
  actorUserId: { type: String, required: true, index: true },
  actorEmail: { type: String },
  targetUserId: { type: String, required: true, index: true },
  targetUserEmail: { type: String },
  changes: {
    type: Schema.Types.Mixed,
    default: {},
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
  createdAt: { type: Date, default: Date.now, index: true },
})

export const AdminAuditLog = models.AdminAuditLog || model('AdminAuditLog', AdminAuditLogSchema)
