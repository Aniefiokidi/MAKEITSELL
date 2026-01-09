const mongoose = require('mongoose');
const { Store } = require('./lib/models/Store');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gote-marketplace';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const store = await Store.create({
    vendorId: 'test-vendor',
    storeName: 'Test Store',
    storeDescription: 'A test store for debugging',
    category: 'fashion',
    isOpen: true,
    isActive: true,
    address: '123 Test St',
    deliveryTime: '1-3 days',
    deliveryFee: 500,
    minimumOrder: 1000,
    phone: '1234567890',
    email: 'test@store.com'
  });
  console.log('Inserted:', store);
  await mongoose.disconnect();
}

main().catch(console.error);