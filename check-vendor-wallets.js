/**
 * Check vendor wallet balances
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
  walletBalance: { type: Number, default: 0 },
  vendorInfo: mongoose.Schema.Types.Mixed,
});

const StoreSchema = new mongoose.Schema({
  storeName: String,
  vendorId: String,
  linkedWalletUserId: String,
  walletBalance: { type: Number, default: 0 },
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Store = mongoose.models.Store || mongoose.model('Store', StoreSchema);

async function checkVendorWallets() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');
    console.log('=== Vendor Wallet Balances ===\n');

    const vendors = await User.find({ role: 'vendor' }).sort({ createdAt: -1 });

    for (const vendor of vendors) {
      const stores = await Store.find({ 
        $or: [
          { linkedWalletUserId: vendor._id.toString() },
          { vendorId: vendor.vendorInfo?.businessId }
        ]
      });

      console.log(`Vendor: ${vendor.name || vendor.email}`);
      console.log(`  User ID: ${vendor._id}`);
      console.log(`  Wallet Balance: ₦${vendor.walletBalance || 0}`);
      console.log(`  Business: ${vendor.vendorInfo?.businessName || 'N/A'}`);
      
      if (stores.length > 0) {
        console.log(`  Stores (${stores.length}):`);
        stores.forEach(store => {
          console.log(`    - ${store.storeName}: ₦${store.walletBalance || 0} (${store.linkedWalletUserId ? 'linked' : 'NOT LINKED'})`);
        });
      } else {
        console.log(`  Stores: None found`);
      }
      console.log('');
    }

    console.log(`\nTotal vendors: ${vendors.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkVendorWallets();
