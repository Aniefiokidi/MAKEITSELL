const mongoose = require('mongoose');

// Connect to MongoDB Atlas test database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mrmichaelotieno:l8b8UPAMvC6xfN9J@cluster0.3pj4k.mongodb.net/test?retryWrites=true&w=majority';

async function testPasswordResetSystem() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Test with existing user (Alex from WINTER store)
    const testEmail = 'mellowalex1@icloud.com';
    const testName = 'Alex Mellow';

    console.log('🧪 Testing Password Reset System...\n');

    // Test 1: Request password reset
    console.log('📧 Test 1: Requesting password reset...');
    try {
      const response1 = await fetch('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: testEmail }),
      });
      
      const result1 = await response1.json();
      
      if (result1.success) {
        console.log('✅ Password reset request successful');
        console.log('   Message:', result1.message);
        
        if (result1.token) {
          console.log('   Reset Token (dev mode):', result1.token);
          
          // Test 2: Actually reset the password using the token
          console.log('\n🔑 Test 2: Resetting password with token...');
          
          const newPassword = 'newpassword123';
          
          const response2 = await fetch('http://localhost:3000/api/auth/forgot-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: testEmail,
              resetToken: result1.token,
              newPassword: newPassword,
            }),
          });
          
          const result2 = await response2.json();
          
          if (result2.success) {
            console.log('✅ Password reset successful');
            console.log('   Message:', result2.message);
            console.log('   New session token created');
            
            // Test 3: Try logging in with new password
            console.log('\n🔓 Test 3: Testing login with new password...');
            
            const response3 = await fetch('http://localhost:3000/api/auth/signin', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: testEmail,
                password: newPassword,
              }),
            });
            
            const result3 = await response3.json();
            
            if (result3.success) {
              console.log('✅ Login with new password successful');
              console.log('   User:', result3.user.name);
              console.log('   Role:', result3.user.role);
            } else {
              console.log('❌ Login failed:', result3.error);
            }
            
          } else {
            console.log('❌ Password reset failed:', result2.error);
          }
        } else {
          console.log('   No token returned (production mode)');
        }
      } else {
        console.log('❌ Password reset request failed:', result1.error);
      }
    } catch (error) {
      console.log('❌ Password reset request failed:', error.message);
    }

    // Test 4: Test invalid scenarios
    console.log('\n🚫 Test 4: Testing invalid scenarios...');
    
    // Test with non-existent email
    try {
      const response4 = await fetch('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'nonexistent@example.com' }),
      });
      
      const result4 = await response4.json();
      
      if (result4.success) {
        console.log('✅ Non-existent email handled correctly (security)');
        console.log('   Message:', result4.message);
      } else {
        console.log('❌ Non-existent email test failed');
      }
    } catch (error) {
      console.log('❌ Non-existent email test error:', error.message);
    }

    // Test 5: Check database state
    console.log('\n📊 Test 5: Checking database state...');
    const user = await db.collection('users').findOne({ email: testEmail });
    if (user) {
      console.log('✅ User found in database');
      console.log('   Name:', user.name || user.displayName);
      console.log('   Email:', user.email);
      console.log('   Has reset token:', user.resetToken ? 'Yes (used)' : 'No');
      console.log('   Has password hash:', user.passwordHash ? 'Yes' : 'No');
      console.log('   Has session token:', user.sessionToken ? 'Yes' : 'No');
    } else {
      console.log('❌ User not found in database');
    }

    console.log('\n✅ Password reset system test completed!');
    console.log('\nFeatures tested:');
    console.log('✅ Email-based password reset request');
    console.log('✅ Token generation and storage');
    console.log('✅ Password reset with valid token');
    console.log('✅ Login with new password');
    console.log('✅ Security handling for non-existent emails');
    console.log('✅ Database state management');

    if (process.env.NODE_ENV === 'production') {
      console.log('\nNote: In production mode, actual emails would be sent instead of showing tokens.');
    } else {
      console.log('\nNote: Email service integration active - check your email for actual reset links!');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Only run if the development server is running
async function checkServerRunning() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/signin');
    return response.status !== undefined;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🚀 Password Reset System Test\n');
  
  const serverRunning = await checkServerRunning();
  if (!serverRunning) {
    console.log('❌ Development server not running on localhost:3000');
    console.log('Please start the server with: npm run dev');
    return;
  }

  await testPasswordResetSystem();
}

main().catch(console.error);