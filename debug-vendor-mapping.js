const mongoose = require('mongoose');

async function debugVendorMapping() {
  try {
    await mongoose.connect('mongodb://localhost:27017/gote-marketplace');
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Get vendors and stores to check ID mapping
    const vendors = await db.collection('users').find({ role: 'vendor' }).toArray();
    const stores = await db.collection('stores').find({}).toArray();

    console.log('=== VENDOR-STORE ID MAPPING DEBUG ===\n');

    vendors.forEach(vendor => {
      const vendorIdStr = (vendor.id || vendor._id).toString();
      const matchingStore = stores.find(store => {
        const storeVendorIdStr = store.vendorId?.toString();
        return storeVendorIdStr === vendorIdStr;
      });

      console.log(`Vendor: ${vendor.displayName || vendor.name} (${vendor.email})`);
      console.log(`  Vendor ID: ${vendorIdStr}`);
      console.log(`  Vendor _id: ${vendor._id}`);
      console.log(`  Vendor uid: ${vendor.uid || 'N/A'}`);
      
      if (matchingStore) {
        console.log(`  ✅ MATCHED Store: ${matchingStore.storeName}`);
        console.log(`  Store VendorId: ${matchingStore.vendorId}`);
        console.log(`  Subscription Status: ${matchingStore.subscriptionStatus}`);
        console.log(`  Subscription Expiry: ${matchingStore.subscriptionExpiry}`);
        console.log(`  Account Status: ${matchingStore.accountStatus}`);
      } else {
        console.log(`  ❌ NO MATCHING STORE FOUND`);
        
        // Check if there's a store with similar ID
        const possibleMatches = stores.filter(store => {
          const storeVendorId = store.vendorId?.toString();
          return storeVendorId.includes(vendorIdStr.substring(8, 16)) || 
                 vendorIdStr.includes(storeVendorId.substring(0, 8));
        });
        
        if (possibleMatches.length > 0) {
          console.log(`  🔍 Possible matches found:`);
          possibleMatches.forEach(store => {
            console.log(`    - ${store.storeName} (vendorId: ${store.vendorId})`);
          });
        }
      }
      console.log('');
    });

    console.log('\n=== ALL STORES WITH VENDOR IDS ===');
    stores.forEach(store => {
      console.log(`Store: ${store.storeName}`);
      console.log(`  VendorId: ${store.vendorId} (type: ${typeof store.vendorId})`);
      console.log(`  Subscription: ${store.subscriptionStatus} - ${store.subscriptionExpiry}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugVendorMapping();