/**
 * Manually link a specific store to a user account
 * Usage: node manual-store-link.js <storeId> <userId>
 */

const mongoose = require('mongoose');
const dns = require('dns');

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test";

// Configure DNS for MongoDB SRV lookup
if (MONGODB_URI.startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  console.log('[DNS] Using Google/Cloudflare DNS for SRV lookup');
}

const StoreSchema = new mongoose.Schema({
  storeName: String,
  vendorId: String,
  linkedWalletUserId: String,
});

const UserSchema = new mongoose.Schema({
  email: String,
  name: String,
  role: String,
  walletBalance: Number,
});

const Store = mongoose.models.Store || mongoose.model('Store', StoreSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function linkStore() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node manual-store-link.js <storeId> <userId>');
    console.log('   OR: node manual-store-link.js <vendorId-string> <userId>');
    console.log('\nThis will link a store to a user wallet account.');
    process.exit(1);
  }

  const [storeIdentifier, userIdStr] = args;

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Find store by ObjectId or vendorId
    let store;
    if (mongoose.Types.ObjectId.isValid(storeIdentifier)) {
      store = await Store.findById(storeIdentifier);
    } else {
      store = await Store.findOne({ vendorId: storeIdentifier });
    }

    if (!store) {
      console.error(`✗ Store not found: ${storeIdentifier}`);
      process.exit(1);
    }

    // Find user
    const user = await User.findById(userIdStr);
    if (!user) {
      console.error(`✗ User not found: ${userIdStr}`);
      process.exit(1);
    }

    if (user.role !== 'vendor') {
      console.error(`✗ User ${userIdStr} is not a vendor (role: ${user.role})`);
      process.exit(1);
    }

    // Link store to user
    await Store.updateOne(
      { _id: store._id },
      { 
        $set: { 
          linkedWalletUserId: user._id.toString(),
          updatedAt: new Date()
        } 
      }
    );

    console.log('✓ Successfully linked:');
    console.log(`  Store: ${store.storeName} (${store._id})`);
    console.log(`  VendorId: ${store.vendorId}`);
    console.log(`  User: ${user.email} (${user._id})`);
    console.log(`  User Wallet: ₦${user.walletBalance || 0}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

linkStore();
