/**
 * Check user email verification status
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test';

async function checkUsers() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔍 Connecting to MongoDB...\n');
    await client.connect();
    const db = client.db('test');
    
    // Get all users
    const users = await db.collection('users').find({}).toArray();
    
    console.log(`📊 Total users: ${users.length}\n`);
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.email}`);
      console.log(`   Name: ${user.name || 'Not set'}`);
      console.log(`   Role: ${user.role || 'customer'}`);
      console.log(`   Email Verified: ${user.isEmailVerified ? '✅ YES' : '❌ NO'}`);
      console.log(`   Has passwordHash: ${user.passwordHash ? '✅ YES' : '❌ NO'}`);
      console.log(`   Has sessionToken: ${user.sessionToken ? '✅ YES' : '❌ NO'}`);
      
      if (!user.isEmailVerified) {
        console.log(`   ⚠️  This user CANNOT login (email not verified)`);
      }
    });
    
    const unverifiedCount = users.filter(u => !u.isEmailVerified).length;
    
    console.log(`\n\n📈 Summary:`);
    console.log(`   Total users: ${users.length}`);
    console.log(`   Verified: ${users.length - unverifiedCount}`);
    console.log(`   Unverified: ${unverifiedCount}`);
    
    if (unverifiedCount > 0) {
      console.log(`\n⚠️  ${unverifiedCount} users cannot log in because they're not verified!`);
      console.log(`\n💡 To fix this, run: node fix-user-verification.js`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkUsers().catch(console.error);
