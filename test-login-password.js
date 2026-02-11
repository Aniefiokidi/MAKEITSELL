/**
 * Test password verification for a specific user
 */

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function testLogin() {
  const email = process.argv[2] || 'noreply@makeitsell.org';
  const password = process.argv[3] || '123456';
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔍 Testing login...\n');
    await client.connect();
    const db = client.db('test');
    
    // Find user
    const user = await db.collection('users').findOne({ email });
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return;
    }
    
    console.log(`✅ User found: ${email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Email Verified: ${user.isEmailVerified ? '✅ YES' : '❌ NO'}`);
    
    console.log(`\n🔑 Password Check:`);
    console.log(`   Input password: "${password}"`);
    
    const inputHash = hashPassword(password);
    console.log(`   Input hash: ${inputHash}`);
    console.log(`   Stored hash: ${user.passwordHash || 'NOT SET'}`);
    
    const matches = user.passwordHash === inputHash;
    console.log(`   Hashes match: ${matches ? '✅ YES' : '❌ NO'}`);
    
    if (!matches) {
      console.log(`\n❌ PASSWORD MISMATCH! This is why login fails.`);
      console.log(`\n💡 Solutions:`);
      console.log(`   1. Try a different password`);
      console.log(`   2. Reset the password using forgot-password flow`);
      console.log(`   3. Update the hash manually in database`);
      console.log(`\n🛠️  To set password to "${password}", run:`);
      console.log(`node set-user-password.js ${email} ${password}`);
    } else {
      console.log(`\n✅ Password is correct! Login should work.`);
      console.log(`\n❓ If login still fails, check:`);
      console.log(`   1. Browser console for errors`);
      console.log(`   2. Vercel logs for API errors`);
      console.log(`   3. Network tab for failed requests`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

testLogin().catch(console.error);
