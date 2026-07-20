import mongoose, { Schema, models } from 'mongoose'

const ReviewSchema = new Schema({
  storeId:      { type: String, required: true, index: true },
  vendorId:     { type: String, required: true },
  // Present only for a review scoped to one specific product or service — absent
  // (undefined, not null) for the original whole-store review. Left undefined rather
  // than defaulted so the compound unique index below can tell the two apart.
  productId:    { type: String, index: true },
  serviceId:    { type: String, index: true },
  customerId:   { type: String, required: true },
  customerName: { type: String, default: 'Customer' },
  orderId:      { type: String, required: true },
  rating:       { type: Number, required: true, min: 1, max: 5 },
  comment:      { type: String, default: '' },
  reply:        { type: String },
  repliedAt:    { type: Date },
  createdAt:    { type: Date, default: Date.now },
})

// One review per order+store+product(+service) combination. A plain store review
// (no productId/serviceId) still gets exactly one per order, same as before — MongoDB
// treats the missing field as a shared "null" value across those documents for
// uniqueness purposes, so this is a strict superset of the original {orderId, storeId}
// constraint, not a loosening of it.
ReviewSchema.index({ orderId: 1, storeId: 1, productId: 1, serviceId: 1 }, { unique: true })

export const Review = models.Review || mongoose.model('Review', ReviewSchema)
