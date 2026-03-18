import mongoose, { Schema, model, models } from 'mongoose'

const VendorFunnelEventSchema = new Schema({
  vendorId: { type: String, required: true, index: true },
  storeId: { type: String, index: true },
  productId: { type: String, index: true },
  customerId: { type: String, index: true },
  eventType: {
    type: String,
    enum: ['store_visit', 'product_view', 'cart_add', 'checkout_start'],
    required: true,
    index: true,
  },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
})

VendorFunnelEventSchema.index({ vendorId: 1, eventType: 1, createdAt: -1 })

export const VendorFunnelEvent =
  models.VendorFunnelEvent || model('VendorFunnelEvent', VendorFunnelEventSchema)
