const mongoose = require('mongoose')
const crypto = require('crypto')

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test"

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function fixUserModelIssue() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Fixing User model issue...\n')

    const db = mongoose.connection.db

    // Check current user state
    const user = await db.collection('users').findOne({ email: 'mellowalex1@icloud.com' })
    if (!user) {
      console.log('❌ User not found!')
      return
    }

    console.log('Current user found:')
    console.log(`- ID: ${user._id}`)
    console.log(`- Email: ${user.email}`)
    console.log(`- Name: ${user.name || user.displayName}`)
    console.log(`- Collection: users`)

    // The issue is that the auth system tries to save through Mongoose User model
    // but the user was created with a different structure. Let's ensure compatibility.
    
    const passwordHash = hashPassword('123456')
    const sessionToken = crypto.randomBytes(32).toString('hex')

    // Update user with proper structure that matches both raw MongoDB and Mongoose User model
    const updateResult = await db.collection('users').updateOne(
      { email: 'mellowalex1@icloud.com' },
      {
        $set: {
          // Core fields expected by User model
          name: 'Alex Idiong',              // Updated name as requested
          displayName: 'Alex Idiong',       // Keep both for compatibility
          email: 'mellowalex1@icloud.com',
          passwordHash: passwordHash,
          role: 'vendor',
          
          // Authentication fields
          sessionToken: sessionToken,
          isEmailVerified: true,
          
          // Vendor info
          vendorInfo: {
            businessName: 'WINTER',
            businessType: 'both',
            storeName: 'WINTER'
          },
          
          // Timestamps
          createdAt: user.createdAt || new Date(),
          updatedAt: new Date()
        },
        
        // Remove any fields that might cause conflicts
        $unset: {
          password: ""  // Remove old bcrypt password
        }
      }
    )

    console.log('\n✅ User updated with Mongoose-compatible structure')
    console.log(`- Name updated to: Alex Idiong`)
    console.log(`- Password hash: SHA256 format`)
    console.log(`- Session token: Generated`)
    console.log(`- Email verified: true`)

    // Verify the updated structure
    const updatedUser = await db.collection('users').findOne({ email: 'mellowalex1@icloud.com' })
    console.log('\n=== UPDATED USER STRUCTURE ===')
    console.log('Fields present:')
    Object.keys(updatedUser).forEach(field => {
      console.log(`  ✓ ${field}: ${typeof updatedUser[field]}`)
    })

    // Test that the user structure now matches what Mongoose expects
    console.log('\n=== MONGOOSE COMPATIBILITY CHECK ===')
    const requiredFields = ['_id', 'email', 'passwordHash', 'name', 'role', 'sessionToken']
    const allFieldsPresent = requiredFields.every(field => updatedUser[field] !== undefined)
    
    console.log(`Required fields present: ${allFieldsPresent ? '✅ YES' : '❌ NO'}`)
    requiredFields.forEach(field => {
      console.log(`  ${field}: ${updatedUser[field] ? '✓' : '✗'}`)
    })

    // Also check that the WINTER store is still properly linked
    const store = await db.collection('stores').findOne({ vendorId: updatedUser._id.toString() })
    console.log(`\nStore linkage: ${store ? '✅ MAINTAINED' : '❌ BROKEN'}`)
    if (store) {
      console.log(`  Store: ${store.storeName}`)
      console.log(`  Vendor ID: ${store.vendorId}`)
    }

    console.log('\n🎉 Try logging in again! The User model should now work properly.')
    console.log('📱 Credentials:')
    console.log('   Email: mellowalex1@icloud.com')
    console.log('   Password: 123456')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await mongoose.disconnect()
  }
}

fixUserModelIssue()