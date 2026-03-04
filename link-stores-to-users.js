/**
 * Link stores to their vendor user accounts
 * This populates the linkedWalletUserId field in stores
 */

const mongoose = require('mongoose');
const dns = require('dns');

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test";

// Configure DNS for MongoDB SRV lookup
if (MONGODB_URI.startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  console.log('[DNS] Using Google/Cloudflare DNS for SRV lookup');
}

const UserSchema = new mongoose.Schema({
  email: String,
  name: String,
  role: String,
  vendorInfo: mongoose.Schema.Types.Mixed,
  walletBalance: { type: Number, default: 0 },
});

const StoreSchema = new mongoose.Schema({
  storeName: String,
  vendorId: String,
  linkedWalletUserId: String,
  walletBalance: { type: Number, default: 0 },
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Store = mongoose.models.Store || mongoose.model('Store', StoreSchema);

async function linkStoresToUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Get all stores
    const stores = await Store.find({});
    console.log(`\nFound ${stores.length} stores`);

    let linked = 0;
    let alreadyLinked = 0;
    let notFound = 0;

    for (const store of stores) {
      if (store.linkedWalletUserId) {
        console.log(`  ✓ Store "${store.storeName}" already linked to user ${store.linkedWalletUserId}`);
        alreadyLinked++;
        continue;
      }

      // Try to find user by vendorId match
      // Check vendorInfo.businessName, storeName, or custom matching
      const user = await User.findOne({
        role: 'vendor',
        $or: [
          { 'vendorInfo.businessName': store.storeName },
          { 'vendorInfo.storeName': store.storeName },
          { name: { $regex: new RegExp(store.storeName, 'i') } }
        ]
      });

      if (user) {
        await Store.updateOne(
          { _id: store._id },
          { 
            $set: { 
              linkedWalletUserId: user._id.toString(),
              updatedAt: new Date()
            } 
          }
        );
        console.log(`  ✓ Linked store "${store.storeName}" (vendorId: ${store.vendorId}) to user ${user.email} (${user._id})`);
        linked++;
      } else {
        console.log(`  ✗ No user found for store "${store.storeName}" (vendorId: ${store.vendorId})`);
        notFound++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Newly linked: ${linked}`);
    console.log(`Already linked: ${alreadyLinked}`);
    console.log(`Not found: ${notFound}`);

    // Show all vendor users for manual matching if needed
    if (notFound > 0) {
      console.log('\n=== Vendor Users ===');
      const vendors = await User.find({ role: 'vendor' }).select('_id email name vendorInfo');
      vendors.forEach(v => {
        console.log(`  User ID: ${v._id}`);
        console.log(`    Email: ${v.email}`);
        console.log(`    Name: ${v.name}`);
        console.log(`    Business: ${v.vendorInfo?.businessName || 'N/A'}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

linkStoresToUsers();
