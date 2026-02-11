/**
 * Debug script for password reset issues
 * Run with: node test-password-reset-debug.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test';

async function debugPasswordReset() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔍 Connecting to MongoDB...');
    await client.connect();
    const db = client.db('test');
    
    // Get the email from command line or use a default
    const emailToCheck = process.argv[2] || 'arnold@makeitsell.org';
    
    console.log(`\n📧 Checking password reset status for: ${emailToCheck}\n`);
    
    // Find the user
    const user = await db.collection('users').findOne({ email: emailToCheck });
    
    if (!user) {
      console.log('❌ User not found in database');
      console.log('\n💡 Available users:');
      const users = await db.collection('users').find({}).project({ email: 1, name: 1 }).toArray();
      users.forEach(u => console.log(`   - ${u.email} (${u.name || 'No name'})`));
      return;
    }
    
    console.log('✅ User found!');
    console.log('\n📊 User Details:');
    console.log(`   Name: ${user.name || 'Not set'}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role || 'customer'}`);
    console.log(`   Created: ${user.createdAt || 'Unknown'}`);
    
    console.log('\n🔑 Password Reset Status:');
    if (user.resetToken) {
      console.log(`   ✅ Reset token exists`);
      console.log(`   Token: ${user.resetToken}`);
      console.log(`   Token length: ${user.resetToken.length} characters`);
      console.log(`   Expected length: 64 characters (32 bytes hex)`);
      
      if (user.resetToken.length !== 64) {
        console.log(`   ⚠️  WARNING: Token length is incorrect!`);
      }
      
      if (user.resetTokenExpiry) {
        const expiry = new Date(user.resetTokenExpiry);
        const now = new Date();
        const minutesRemaining = Math.floor((expiry - now) / 1000 / 60);
        
        console.log(`   Expires: ${expiry.toLocaleString()}`);
        console.log(`   Current time: ${now.toLocaleString()}`);
        
        if (now > expiry) {
          console.log(`   ❌ Token is EXPIRED (expired ${Math.abs(minutesRemaining)} minutes ago)`);
        } else {
          console.log(`   ✅ Token is VALID (expires in ${minutesRemaining} minutes)`);
        }
      } else {
        console.log(`   ❌ No expiry set`);
      }
    } else {
      console.log(`   ❌ No reset token found`);
      console.log(`   💡 User needs to request a password reset first`);
    }
    
    console.log('\n🔗 To test password reset:');
    console.log(`   1. Visit: https://www.makeitsell.org/forgot-password`);
    console.log(`   2. Enter email: ${emailToCheck}`);
    console.log(`   3. Check email for reset link`);
    
    if (user.resetToken && user.resetTokenExpiry && new Date() < new Date(user.resetTokenExpiry)) {
      const resetUrl = `https://www.makeitsell.org/forgot-password?token=${user.resetToken}&email=${encodeURIComponent(emailToCheck)}`;
      console.log(`\n🔗 Current Reset URL:`);
      console.log(`   ${resetUrl}`);
      console.log(`\n   Token only: ${user.resetToken}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the debug
debugPasswordReset().catch(console.error);
