import mongoose, { Schema, model, models } from 'mongoose';

const StoreSchema = new Schema({
  storeName: { type: String, required: true },
  storeDescription: { type: String },
  storeStory: { type: String },
  accentColor: { type: String },
  storeImage: { type: String },
  backgroundImage: { type: String },
  profileImage: { type: String },
  logo: { type: String },
  bannerImages: [{ type: String }],
  storeBanner: { type: String },
  publicSlug: { type: String, unique: true, sparse: true, index: true },
  address: { type: String },
  vendorId: { type: String, required: true },
  subscriptionStatus: { type: String },
  accountStatus: { type: String },
  isActive: { type: Boolean, default: true },
  category: { type: String },
  reviewCount: { type: Number, default: 0 },
  isOpen: { type: Boolean, default: true },
  deliveryTime: { type: String },
  fulfillmentTime: { type: String, default: 'same_day' },
  deliveryFee: { type: Number },
  minimumOrder: { type: Number },
  phone: { type: String },
  email: { type: String },
  city: { type: String },
  state: { type: String },
  returnPolicy: { type: String },
  shippingPolicy: { type: String },
  acceptReturns: { type: Boolean, default: true },
  acceptExchanges: { type: Boolean, default: true },
  autoFulfill: { type: Boolean, default: false },
  emailNotifications: { type: Boolean, default: true },
  // Payout/bank details fields
  bankName: { type: String },
  bankCode: { type: String },
  accountNumber: { type: String },
  accountName: { type: String },
  accountVerified: { type: Boolean, default: false },
  walletBalance: { type: Number, default: 0 },
  linkedWalletUserId: { type: String },
  // Cached Shipbubble address_code for this store's pickup address, so checkout
  // doesn't re-validate the same address on every rate request. Cleared whenever
  // address/city/state changes (see app/api/database/stores/[id]/route.ts).
  shipbubbleAddressCode: { type: Number },
  shipbubbleAddressVerifiedAt: { type: Date },
}, { timestamps: true });

// Weighted text index for relevance-ranked search — see the matching comment on
// ProductSchema in lib/models/Product.ts for why this replaces plain regex matching.
StoreSchema.index(
  { storeName: 'text', storeDescription: 'text', category: 'text', address: 'text' },
  { weights: { storeName: 10, category: 5, address: 3, storeDescription: 1 }, name: 'StoreTextIndex' }
);

export const Store = models.Store || model('Store', StoreSchema);
