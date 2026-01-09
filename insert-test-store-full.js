const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test";

const StoreSchema = new mongoose.Schema({
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
  email: { type: String }
}, { timestamps: true });

const Store = mongoose.model('Store', StoreSchema);

async function main() {
  await mongoose.connect(MONGODB_URI);
  const store = await Store.create({
    vendorId: 'test-vendor-full',
    storeName: 'Test Store Full',
    storeDescription: 'A fully populated test store',
    storeImage: '/images/test-store.jpg',
    profileImage: '/images/test-profile.jpg',
    logo: '/images/test-logo.jpg',
    bannerImages: ['/images/test-banner1.jpg', '/images/test-banner2.jpg'],
    storeBanner: '/images/test-banner-main.jpg',
    address: '456 Full Test Ave',
    subscriptionStatus: 'active',
    accountStatus: 'active',
    isActive: true,
    category: 'electronics',
    reviewCount: 5,
    isOpen: true,
    deliveryTime: '2-4 days',
    deliveryFee: 250,
    minimumOrder: 500,
    phone: '9876543210',
    email: 'fulltest@store.com'
  });
  console.log('Inserted:', store);
  await mongoose.disconnect();
}

main().catch(console.error);