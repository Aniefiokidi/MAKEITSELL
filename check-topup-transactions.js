const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test';

const WalletTransactionSchema = new mongoose.Schema({}, { strict: false, collection: 'wallettransactions' });
const WalletTransaction = mongoose.model('WalletTransaction', WalletTransactionSchema);

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', UserSchema);

async function checkTopups() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!\n');

    const topups = await WalletTransaction.find({
      type: 'topup',
      status: 'completed'
    }).sort({ createdAt: -1 }).limit(5).lean();

    console.log(`Found ${topups.length} completed top-up(s):\n`);

    for (const tx of topups) {
      console.log(`Transaction: ${tx.reference}`);
      console.log(`  Amount: ₦${tx.amount}`);
      console.log(`  User ID (from transaction): ${tx.userId}`);
      console.log(`  User ID type: ${typeof tx.userId}`);
      console.log(`  Created: ${tx.createdAt}`);
      console.log(`  Updated: ${tx.updatedAt}`);
      
      // Try to find the user
      try {
        const userIdObject = mongoose.Types.ObjectId.isValid(tx.userId)
          ? new mongoose.Types.ObjectId(tx.userId)
          : tx.userId;
        
        const user = await User.findById(userIdObject).select('email walletBalance role').lean();
        if (user) {
          console.log(`  ✅ User found: ${user.email} (${user.role})`);
          console.log(`  Current balance: ₦${user.walletBalance || 0}`);
        } else {
          console.log(`  ❌ User not found with ID: ${tx.userId}`);
        }
      } catch (err) {
        console.log(`  ❌ Error finding user: ${err.message}`);
      }
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTopups();
