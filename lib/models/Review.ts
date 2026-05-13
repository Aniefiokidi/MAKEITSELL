import mongoose, { Schema, models } from 'mongoose'

const ReviewSchema = new Schema({
  storeId:      { type: String, required: true, index: true },
  vendorId:     { type: String, required: true },
  customerId:   { type: String, required: true },
  customerName: { type: String, default: 'Customer' },
  orderId:      { type: String, required: true },
  rating:       { type: Number, required: true, min: 1, max: 5 },
  comment:      { type: String, default: '' },
  reply:        { type: String },
  repliedAt:    { type: Date },
  createdAt:    { type: Date, default: Date.now },
})

// One review per order+store
ReviewSchema.index({ orderId: 1, storeId: 1 }, { unique: true })

export const Review = models.Review || mongoose.model('Review', ReviewSchema)
