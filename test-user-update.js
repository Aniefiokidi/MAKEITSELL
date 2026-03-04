const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test';

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', UserSchema);

async function testUserId() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!\n');

    const userId = '69674e4c291bec6dcd759a1b';
    
    console.log(`Testing userId: ${userId}`);
    console.log(`Is valid ObjectId: ${mongoose.Types.ObjectId.isValid(userId)}\n`);
    
    // Try as string
    console.log('1. Trying as string:');
    const user1 = await User.findOne({ _id: userId }).select('email walletBalance').lean();
    console.log(user1 ? `✅ Found: ${user1.email}, balance: ₦${user1.walletBalance}` : '❌ Not found\n');
    
    // Try as ObjectId
    console.log('2. Trying as new ObjectId:');
    const user2 = await User.findById(new mongoose.Types.ObjectId(userId)).select('email walletBalance').lean();
    console.log(user2 ? `✅ Found: ${user2.email}, balance: ₦${user2.walletBalance}` : '❌ Not found\n');
    
    // Try findById with string
    console.log('3. Trying findById with string:');
    const user3 = await User.findById(userId).select('email walletBalance').lean();
    console.log(user3 ? `✅ Found: ${user3.email}, balance: ₦${user3.walletBalance}` : '❌ Not found\n');

    // Now try to update
    console.log('4. Testing update with increment:');
    const updateResult = await User.updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $inc: { walletBalance: 10800000 } }
    );
    console.log(`Update result: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}\n`);
    
    // Check new balance
    const user4 = await User.findById(userId).select('email walletBalance').lean();
    console.log(user4 ? `New balance: ₦${user4.walletBalance}` : 'User not found');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testUserId();
