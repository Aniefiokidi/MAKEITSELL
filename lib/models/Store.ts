import mongoose, { Schema, model, models } from 'mongoose';

const StoreSchema = new Schema({
  storeName: { type: String, required: true },
  storeDescription: { type: String },
  storeImage: { type: String },
  profileImage: { type: String },
  logo: { type: String },
  bannerImages: [{ type: String }],
  storeBanner: { type: String },
  address: { type: String },
  vendorId: { type: String, required: true },
  subscriptionStatus: { type: String },
  accountStatus: { type: String },
  isActive: { type: Boolean, default: true },
  category: { type: String },
  reviewCount: { type: Number, default: 0 },
  isOpen: { type: Boolean, default: true },
  deliveryTime: { type: String },
  deliveryFee: { type: Number },
  minimumOrder: { type: Number },
  phone: { type: String },
  email: { type: String },
  // Payout/bank details fields
  bankName: { type: String },
  bankCode: { type: String },
  accountNumber: { type: String },
  accountName: { type: String },
  accountVerified: { type: Boolean, default: false }
}, { timestamps: true });

export const Store = models.Store || model('Store', StoreSchema);
