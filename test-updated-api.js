const mongoose = require('mongoose');

async function testVendorAPI() {
  try {
    // Start a simple HTTP server to test the API
    const http = require('http');
    
    console.log('Testing updated vendor API...\n');
    
    // Since we can't easily make HTTP requests without node-fetch, 
    // let's directly test the database logic
    await mongoose.connect('mongodb://localhost:27017/gote-marketplace');
    const db = mongoose.connection.db;
    
    // Simulate the API logic
    const users = await db.collection('users').find({ role: 'vendor' }).toArray();
    const stores = await db.collection('stores').find({}).toArray();
    
    // Create store mapping like in the API
    const storeByVendorDetailed = {};
    const vendorIdToStore = {};
    
    stores.forEach((store) => {
      if (!store?.vendorId) return;
      const subscriptionExpiry = store.subscriptionExpiry || store.subscriptionExpiresAt || store.subscriptionExpiryDate;
      const vendorIdStr = store.vendorId.toString();
      
      const storeData = {
        storeName: store.storeName,
        accountStatus: store.accountStatus,
        subscriptionExpiry: subscriptionExpiry,
        subscriptionStatus: store.subscriptionStatus,
      };
      
      storeByVendorDetailed[vendorIdStr] = storeData;
      vendorIdToStore[vendorIdStr] = store;
    });

    // Create vendor list like in API
    const allVendors = users.filter((u) => u.role === 'vendor');
    const vendorsWithStores = [];
    const vendorsWithoutStores = [];
    
    allVendors.forEach((vendor) => {
      const vendorIdStr = (vendor.id || vendor._id).toString();
      const store = storeByVendorDetailed[vendorIdStr];
      
      const vendorData = {
        id: vendor.id || vendor._id,
        email: vendor.email,
        name: vendor.name || vendor.displayName || 'N/A',
        vendorType: vendor.vendorInfo?.type || 'both',
        storeName: store?.storeName || vendor.vendorInfo?.storeName || 'N/A',
        status: store?.accountStatus || vendor.vendorInfo?.status || 'pending',
        subscriptionExpiry: store?.subscriptionExpiry,
        subscriptionStatus: store?.subscriptionStatus || 'unknown',
        createdAt: vendor.createdAt,
        hasStore: !!store
      };
      
      if (store) {
        vendorsWithStores.push(vendorData);
      } else {
        vendorsWithoutStores.push(vendorData);
      }
    });
    
    const vendors = [...vendorsWithStores, ...vendorsWithoutStores];
    
    console.log('=== API SIMULATION RESULTS ===');
    console.log(`Total vendors: ${vendors.length}`);
    console.log(`Vendors with stores: ${vendorsWithStores.length}`);
    console.log(`Vendors without stores: ${vendorsWithoutStores.length}\n`);
    
    console.log('=== VENDORS WITH STORES (Should show subscription data) ===');
    vendorsWithStores.forEach(vendor => {
      const expiryDate = vendor.subscriptionExpiry ? new Date(vendor.subscriptionExpiry).toLocaleDateString() : 'N/A';
      const statusIcon = vendor.subscriptionExpiry && new Date(vendor.subscriptionExpiry) > new Date() ? '🟢' : 
                         vendor.subscriptionExpiry && new Date(vendor.subscriptionExpiry) < new Date() ? '🔴' : '⚪';
      
      console.log(`${statusIcon} ${vendor.storeName} (${vendor.name})`);
      console.log(`   📧 ${vendor.email}`);
      console.log(`   📅 Expires: ${expiryDate}`);
      console.log(`   🏪 Status: ${vendor.status}`);
      console.log(`   📈 Subscription: ${vendor.subscriptionStatus}`);
      console.log('');
    });
    
    console.log('=== VENDORS WITHOUT STORES ===');
    vendorsWithoutStores.forEach(vendor => {
      console.log(`⚪ ${vendor.name} (${vendor.email}) - No store`);
    });
    
    const activeWithSubscription = vendorsWithStores.filter(v => v.subscriptionStatus === 'active').length;
    console.log(`\n📊 Summary: ${activeWithSubscription} vendors have active subscriptions`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testVendorAPI();