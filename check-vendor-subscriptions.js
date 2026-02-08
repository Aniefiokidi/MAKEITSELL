const mongoose = require('mongoose');

async function checkVendorSubscriptions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/gote-marketplace');
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Check vendors
    const vendors = await db.collection('users').find({ role: 'vendor' }).toArray();
    console.log('=== VENDORS ===');
    vendors.forEach(v => {
      console.log(`- ${v.displayName || v.name} (${v.email})`);
      console.log(`  ID: ${v._id}`);
      console.log(`  Created: ${v.createdAt}`);
      console.log('');
    });

    // Check stores
    const stores = await db.collection('stores').find({}).toArray();
    console.log('=== STORES ===');
    stores.forEach(s => {
      console.log(`- ${s.storeName}`);
      console.log(`  VendorId: ${s.vendorId}`);
      console.log(`  Subscription Status: ${s.subscriptionStatus}`);
      console.log(`  Subscription Expiry: ${s.subscriptionExpiry}`);
      console.log(`  Account Status: ${s.accountStatus}`);
      console.log(`  Created: ${s.createdAt}`);
      console.log('');
    });

    // Check subscription payments
    const payments = await db.collection('subscription_payments').find({}).toArray();
    console.log('=== SUBSCRIPTION PAYMENTS ===');
    if (payments.length === 0) {
      console.log('No subscription payments found');
    } else {
      payments.forEach(p => {
        console.log(`- Vendor: ${p.vendorId}`);
        console.log(`  Amount: ${p.amount}`);
        console.log(`  Payment Date: ${p.paymentDate}`);
        console.log(`  Period: ${p.subscriptionPeriod?.start} to ${p.subscriptionPeriod?.end}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkVendorSubscriptions();