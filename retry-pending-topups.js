const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test';

const WalletTransactionSchema = new mongoose.Schema({}, { strict: false, collection: 'wallettransactions' });
const WalletTransaction = mongoose.model('WalletTransaction', WalletTransactionSchema);

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', UserSchema);

async function retryPendingTopups() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!\n');

    // Find pending top-up transactions
    const pendingTopups = await WalletTransaction.find({
      type: 'topup',
      status: 'pending'
    }).sort({ createdAt: -1 }).lean();

    console.log(`Found ${pendingTopups.length} pending top-up transaction(s)\n`);

    if (pendingTopups.length === 0) {
      console.log('No pending top-ups to process');
      process.exit(0);
    }

    for (const tx of pendingTopups) {
      console.log(`\nProcessing transaction:`);
      console.log(`  Reference: ${tx.reference}`);
      console.log(`  Amount: ₦${tx.amount}`);
      console.log(`  User ID: ${tx.userId}`);
      console.log(`  Created: ${tx.createdAt}`);

      // Mark as completed
      const updateResult = await WalletTransaction.updateOne(
        { _id: tx._id, status: 'pending' },
        {
          $set: {
            status: 'completed',
            updatedAt: new Date()
          }
        }
      );

      if (updateResult.modifiedCount > 0) {
        console.log('  ✅ Transaction marked as completed');

        // Credit user wallet
        const userIdObject = mongoose.Types.ObjectId.isValid(tx.userId)
          ? new mongoose.Types.ObjectId(tx.userId)
          : tx.userId;

        const userUpdateResult = await User.updateOne(
          { _id: userIdObject },
          {
            $inc: { walletBalance: tx.amount },
            $set: { updatedAt: new Date() }
          }
        );

        if (userUpdateResult.modifiedCount > 0) {
          console.log(`  ✅ Credited ₦${tx.amount} to user wallet`);

          // Show updated balance
          const updatedUser = await User.findById(userIdObject).select('email walletBalance role').lean();
          if (updatedUser) {
            console.log(`  📊 New balance: ₦${updatedUser.walletBalance || 0} (${updatedUser.role})`);
          }
        } else {
          console.log('  ⚠️  User wallet not updated (user not found or no change)');
        }
      } else {
        console.log('  ℹ️  Transaction already completed or not found');
      }
    }

    console.log('\n✅ All pending top-ups processed!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

retryPendingTopups();
