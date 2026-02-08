const mongoose = require('mongoose');

// Connect to MongoDB Atlas test database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mrmichaelotieno:l8b8UPAMvC6xfN9J@cluster0.3pj4k.mongodb.net/test?retryWrites=true&w=majority';

async function quickPasswordResetTest() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const testEmail = 'arnoldeee123@gmail.com';

    console.log('🧪 Testing Password Reset (Quick Test)...\n');
    console.log('📧 Testing password reset request...');
    
    try {
      const response = await fetch('http://localhost:3001/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: testEmail }),
      });
      
      const result = await response.json();
      console.log('Response status:', response.status);
      console.log('Response body:', result);
      
      if (result.success) {
        console.log('✅ Password reset request successful');
        console.log('   Message:', result.message);
        if (result.token) {
          console.log('   Token generated:', result.token);
        }
      } else {
        console.log('❌ Password reset request failed:', result.error);
      }
    } catch (error) {
      console.log('❌ Request failed:', error.message);
    }

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

async function main() {
  console.log('🚀 Quick Password Reset Test (Port 3001)\n');
  await quickPasswordResetTest();
}

main().catch(console.error);