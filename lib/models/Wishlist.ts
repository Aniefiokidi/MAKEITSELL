import mongoose, { Schema, models } from 'mongoose'

const WishlistItemSchema = new Schema({
  productId: { type: String, required: true },
  title:     { type: String, default: '' },
  price:     { type: Number, default: 0 },
  image:     { type: String, default: '' },
  vendorId:  { type: String, default: '' },
  category:  { type: String, default: '' },
  addedAt:   { type: Date, default: Date.now },
})

const WishlistSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  items:  { type: [WishlistItemSchema], default: [] },
}, { timestamps: true })

export const Wishlist = models.Wishlist || mongoose.model('Wishlist', WishlistSchema)
