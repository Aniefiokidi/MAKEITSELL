import mongoose, { Schema, model, models } from 'mongoose'

const VendorPromoTriggerSchema = new Schema({
  vendorId: { type: String, required: true, index: true },
  customerId: { type: String, required: true, index: true },
  segment: {
    type: String,
    enum: ['new', 'repeat', 'dormant', 'high-value'],
    required: true,
    index: true,
  },
  promoCode: { type: String, required: true },
  promoMessage: { type: String, required: true },
  triggeredAt: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued' },
})

VendorPromoTriggerSchema.index({ vendorId: 1, customerId: 1, segment: 1, triggeredAt: -1 })

export const VendorPromoTrigger =
  models.VendorPromoTrigger || model('VendorPromoTrigger', VendorPromoTriggerSchema)
