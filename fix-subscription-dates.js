const mongoose = require('mongoose');

async function updateVendorSubscriptionDates() {
  try {
    await mongoose.connect('mongodb://localhost:27017/gote-marketplace');
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Find all stores that have active subscriptions but might need date corrections
    const stores = await db.collection('stores').find({
      subscriptionStatus: 'active'
    }).toArray();

    console.log(`Found ${stores.length} active stores to check\n`);

    let updated = 0;

    for (const store of stores) {
      let needsUpdate = false;
      let updateData = {};

      // If no subscription expiry date, calculate from created date + 1 month
      if (!store.subscriptionExpiry && store.createdAt) {
        const expiryDate = new Date(store.createdAt);
        expiryDate.setMonth(expiryDate.getMonth() + 1);
        
        updateData.subscriptionExpiry = expiryDate;
        needsUpdate = true;
        
        console.log(`Store: ${store.storeName}`);
        console.log(`  Created: ${store.createdAt}`);
        console.log(`  Setting expiry: ${expiryDate}`);
      }

      // Check for subscription payment records to get accurate dates
      const paymentRecord = await db.collection('subscription_payments').findOne({
        vendorId: store.vendorId
      }, { sort: { paymentDate: -1 } }); // Get most recent payment

      if (paymentRecord && paymentRecord.subscriptionPeriod?.end) {
        const paymentExpiryDate = new Date(paymentRecord.subscriptionPeriod.end);
        
        // Update if payment record has a different (more recent) expiry date
        if (!store.subscriptionExpiry || 
            Math.abs(paymentExpiryDate.getTime() - new Date(store.subscriptionExpiry).getTime()) > 24 * 60 * 60 * 1000) {
          
          updateData.subscriptionExpiry = paymentExpiryDate;
          needsUpdate = true;
          
          console.log(`Store: ${store.storeName}`);
          console.log(`  Payment date: ${paymentRecord.paymentDate}`);
          console.log(`  Correcting expiry to: ${paymentExpiryDate}`);
        }
      }

      // Ensure all active stores have proper subscription fields
      if (store.subscriptionStatus === 'active' && (!store.accountStatus || store.accountStatus !== 'active')) {
        updateData.accountStatus = 'active';
        updateData.isActive = true;
        updateData.frozen = false;
        needsUpdate = true;
      }

      if (needsUpdate) {
        updateData.updatedAt = new Date();
        
        await db.collection('stores').updateOne(
          { _id: store._id },
          { $set: updateData }
        );
        
        updated++;
        console.log(`  ✓ Updated\n`);
      }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Stores checked: ${stores.length}`);
    console.log(`Stores updated: ${updated}`);

    // Show current status
    console.log('\n=== CURRENT ACTIVE VENDORS ===');
    const activeStores = await db.collection('stores').find({
      subscriptionStatus: 'active'
    }).toArray();

    for (const store of activeStores) {
      console.log(`- ${store.storeName}`);
      console.log(`  Vendor ID: ${store.vendorId}`);
      console.log(`  Subscription Expires: ${store.subscriptionExpiry ? new Date(store.subscriptionExpiry).toLocaleDateString() : 'N/A'}`);
      console.log(`  Account Status: ${store.accountStatus}`);
      console.log(`  Active: ${store.isActive}`);
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateVendorSubscriptionDates();