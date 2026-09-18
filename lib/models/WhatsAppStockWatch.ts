import mongoose, { Schema, model, models } from 'mongoose'

// A buyer asked about (or tried to add) a product that was out of stock. When it comes
// back, app/api/admin/whatsapp/proactive tells them. One row per buyer+product; cleared
// once notified. 30-day TTL — nobody wants a "back in stock" for something from a month ago.
const WhatsAppStockWatchSchema = new Schema({
  waId: { type: String, required: true, index: true },
  productId: { type: String, required: true, index: true },
  productName: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
})
WhatsAppStockWatchSchema.index({ waId: 1, productId: 1 }, { unique: true })

export const WhatsAppStockWatch = models.WhatsAppStockWatch || model('WhatsAppStockWatch', WhatsAppStockWatchSchema)
