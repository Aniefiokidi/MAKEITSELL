import mongoose, { Schema, model, models } from 'mongoose'

// Persisted record of WhatsApp delivery-status webhook events (sent/delivered/read/failed).
// Exists because Vercel's log export (both historical query and --follow) doesn't reliably
// surface console.log content, making delivery failures otherwise undiagnosable in
// production — this collection is queryable directly regardless of log tooling.
const WhatsAppDeliveryEventSchema = new Schema(
  {
    recipientId: { type: String, required: true, index: true },
    status: { type: String, required: true },
    messageId: { type: String },
    errors: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
)

export const WhatsAppDeliveryEvent =
  models.WhatsAppDeliveryEvent || model('WhatsAppDeliveryEvent', WhatsAppDeliveryEventSchema)
