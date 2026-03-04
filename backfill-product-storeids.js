/**
 * Backfill storeId on existing products
 * Links products to their stores via vendorId
 */

const mongoose = require('mongoose');
const dns = require('dns');

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test";

// Configure DNS for MongoDB SRV lookup
if (MONGODB_URI.startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  console.log('[DNS] Using Google/Cloudflare DNS for SRV lookup');
}

const ProductSchema = new mongoose.Schema({
  name: String,
  vendorId: String,
  storeId: String,
});

const StoreSchema = new mongoose.Schema({
  storeName: String,
  vendorId: String,
});

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
const Store = mongoose.models.Store || mongoose.model('Store', StoreSchema);

async function backfillProductStoreIds() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Get all products without storeId
    const products = await Product.find({ 
      $or: [
        { storeId: { $exists: false } },
        { storeId: null },
        { storeId: '' }
      ]
    });

    console.log(`Found ${products.length} products to update\n`);

    let updated = 0;
    let notFound = 0;

    for (const product of products) {
      const vendorId = product.vendorId;
      
      if (!vendorId) {
        console.log(`  ✗ Product "${product.name}" has no vendorId`);
        notFound++;
        continue;
      }

      // Find store by vendorId
      const store = await Store.findOne({ vendorId }).sort({ createdAt: -1 });

      if (store) {
        await Product.updateOne(
          { _id: product._id },
          { $set: { storeId: store._id.toString() } }
        );
        console.log(`  ✓ Updated "${product.name}" → Store: ${store.storeName} (${store._id})`);
        updated++;
      } else {
        console.log(`  ✗ No store found for product "${product.name}" (vendorId: ${vendorId})`);
        notFound++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Updated: ${updated}`);
    console.log(`Not found: ${notFound}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

backfillProductStoreIds();
