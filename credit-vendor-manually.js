const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test';

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', UserSchema);

async function getAllVendorIds() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!\n');

    const vendors = await User.find({ role: 'vendor' }).select('_id email walletBalance').lean();
    
    console.log(`Found ${vendors.length} vendor(s):\n`);

    for (const vendor of vendors) {
      console.log(`Email: ${vendor.email}`);
      console.log(`  _id object: ${JSON.stringify(vendor._id)}`);
      console.log(`  _id.toString(): ${vendor._id.toString()}`);
      console.log(`  _id type: ${typeof vendor._id}`);
      console.log(`  Wallet Balance: ₦${vendor.walletBalance || 0}`);
      
      // Check if this matches our transaction userId
      if (vendor._id.toString() === '69674e4c291bec6dcd759a1b') {
        console.log('  🎯 THIS IS THE USER FROM THE TRANSACTIONS!');
        console.log(`  Let's credit this user...`);
        console.log(`  Current walletBalance field: ${vendor.walletBalance}`);
        console.log(`  _id type is: ${typeof vendor._id}`);
        console.log(`  _id value: ${JSON.stringify(vendor._id)}`);
        
        // Try findOneAndUpdate instead
        const updated = await User.findOneAndUpdate(
          { _id: vendor._id },
          { $set: { walletBalance: (vendor.walletBalance || 0) + 10800000 } },
          { new: true }
        ).select('walletBalance email').lean();
        
        if (updated) {
          console.log(`  ✅ SUCCESS! New Balance: ₦${updated.walletBalance || 0}`);
          console.log(`  Email: ${updated.email}`);
        } else {
          console.log('  ❌ findOneAndUpdate returned null');
          
          // Last resort - try with string filter
          console.log('  Trying with email filter instead...');
          const updated2 = await User.findOneAndUpdate(
            { email: 'jonathandavngeri@gmail.com' },
            { $set: { walletBalance: (vendor.walletBalance || 0) + 10800000 } },
            { new: true }
          ).select('walletBalance').lean();
          
          if (updated2) {
            console.log(`  ✅ SUCCESS VIA EMAIL! New Balance: ₦${updated2.walletBalance || 0}`);
          }
        }
      }
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

getAllVendorIds();
