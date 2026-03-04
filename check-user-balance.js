const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test';

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', UserSchema);

const StoreSchema = new mongoose.Schema({}, { strict: false, collection: 'stores' });
const Store = mongoose.model('Store', StoreSchema);

async function checkBalance() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!\n');

    // Find all vendors
    const vendors = await User.find({ role: 'vendor' }).select('_id email walletBalance').lean();
    
    console.log(`Found ${vendors.length} vendor(s):\n`);

    for (const vendor of vendors) {
      console.log(`Vendor: ${vendor.email}`);
      console.log(`  User ID: ${vendor._id}`);
      console.log(`  User Wallet Balance: ₦${vendor.walletBalance || 0}`);
      
      // Check if they have a store
      const store = await Store.findOne({ linkedWalletUserId: vendor._id }).select('storeName walletBalance').lean();
      if (store) {
        console.log(`  Store: ${store.storeName}`);
        console.log(`  Store Wallet Balance: ₦${store.walletBalance || 0}`);
        console.log(`  Combined Balance: ₦${(vendor.walletBalance || 0) + (store.walletBalance || 0)}`);
      }
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkBalance();
