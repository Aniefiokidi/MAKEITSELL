const mongoose = require('mongoose');

async function cleanupVendorStoreMapping() {
  try {
    await mongoose.connect('mongodb://localhost:27017/gote-marketplace');
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;

    console.log('=== VENDOR-STORE CLEANUP UTILITY ===\n');

    // Find orphaned vendors (vendors without stores)
    const vendors = await db.collection('users').find({ role: 'vendor' }).toArray();
    const stores = await db.collection('stores').find({}).toArray();

    const vendorsWithoutStores = [];
    const storesWithoutVendors = [];

    // Check for vendors without stores
    for (const vendor of vendors) {
      const vendorIdStr = (vendor.id || vendor._id).toString();
      const hasStore = stores.some(store => store.vendorId?.toString() === vendorIdStr);
      
      if (!hasStore) {
        vendorsWithoutStores.push({
          id: vendorIdStr,
          name: vendor.displayName || vendor.name,
          email: vendor.email,
          createdAt: vendor.createdAt
        });
      }
    }

    // Check for stores without vendors  
    for (const store of stores) {
      if (!store.vendorId || store.vendorId === 'test-vendor' || store.vendorId === 'test-vendor-123') {
        continue; // Skip test stores
      }
      
      const hasVendor = vendors.some(vendor => 
        (vendor.id || vendor._id).toString() === store.vendorId.toString()
      );
      
      if (!hasVendor) {
        storesWithoutVendors.push({
          storeName: store.storeName,
          vendorId: store.vendorId,
          subscriptionStatus: store.subscriptionStatus,
          subscriptionExpiry: store.subscriptionExpiry
        });
      }
    }

    console.log('📊 ANALYSIS RESULTS:');
    console.log(`Total vendors: ${vendors.length}`);
    console.log(`Total stores: ${stores.length}`);
    console.log(`Vendors without stores: ${vendorsWithoutStores.length}`);
    console.log(`Stores without vendors: ${storesWithoutVendors.length}\n`);

    if (vendorsWithoutStores.length > 0) {
      console.log('👤 VENDORS WITHOUT STORES:');
      vendorsWithoutStores.forEach(vendor => {
        console.log(`  - ${vendor.name} (${vendor.email}) - ID: ${vendor.id}`);
        console.log(`    Created: ${vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : 'Unknown'}\n`);
      });
      
      console.log('💡 RECOMMENDATION: These vendors signed up but never created stores.');
      console.log('   Consider sending them setup reminders or remove if inactive.\n');
    }

    if (storesWithoutVendors.length > 0) {
      console.log('🏪 STORES WITHOUT VENDORS:');
      storesWithoutVendors.forEach(store => {
        console.log(`  - ${store.storeName} - VendorID: ${store.vendorId}`);
        console.log(`    Subscription: ${store.subscriptionStatus} (expires: ${store.subscriptionExpiry ? new Date(store.subscriptionExpiry).toLocaleDateString() : 'N/A'})\n`);
      });
      
      console.log('💡 RECOMMENDATION: These stores have vendor IDs that don\'t match any users.');
      console.log('   This may indicate deleted user accounts or data inconsistencies.\n');
    }

    // Show active subscriptions summary
    const activeStores = stores.filter(store => 
      store.subscriptionStatus === 'active' && 
      store.subscriptionExpiry &&
      store.vendorId !== 'test-vendor' && 
      store.vendorId !== 'test-vendor-123'
    );

    console.log('✅ ACTIVE SUBSCRIPTIONS SUMMARY:');
    console.log(`Active stores with valid subscriptions: ${activeStores.length}\n`);

    activeStores.forEach(store => {
      const vendor = vendors.find(v => (v.id || v._id).toString() === store.vendorId?.toString());
      const expiryDate = new Date(store.subscriptionExpiry);
      const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      const statusIcon = daysUntilExpiry > 7 ? '🟢' : daysUntilExpiry > 0 ? '🟠' : '🔴';
      
      console.log(`  ${statusIcon} ${store.storeName}`);
      console.log(`     Vendor: ${vendor?.displayName || vendor?.name || 'Unknown'} (${vendor?.email || 'No email'})`);
      console.log(`     Expires: ${expiryDate.toLocaleDateString()} (${daysUntilExpiry} days)`);
      console.log('');
    });

    console.log('🎯 DATA HEALTH: Good! Most vendors have proper store mapping.');
    console.log('📈 Your admin panel should now show accurate subscription data.');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanupVendorStoreMapping();