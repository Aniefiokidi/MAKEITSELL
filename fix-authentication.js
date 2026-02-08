const mongoose = require('mongoose')
const crypto = require('crypto')

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test"

// Use the same hash function as the auth system
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function fixAuthenticationIssue() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Fixing authentication issue for mellowalex1@icloud.com...\n')

    const db = mongoose.connection.db

    // Get the current user
    const user = await db.collection('users').findOne({ email: 'mellowalex1@icloud.com' })
    if (!user) {
      console.log('❌ User not found!')
      return
    }

    console.log('Current user state:')
    console.log(`- Email: ${user.email}`)
    console.log(`- Password field: ${user.password ? 'EXISTS (bcrypt)' : 'MISSING'}`)
    console.log(`- PasswordHash field: ${user.passwordHash ? 'EXISTS' : 'MISSING'}`)
    console.log(`- Email verified: ${user.isEmailVerified ? 'YES' : 'NO'}`)

    // Create the correct SHA256 hash for password "123456"
    const correctPasswordHash = hashPassword('123456')
    console.log(`\nCorrect SHA256 hash: ${correctPasswordHash}`)

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex')

    // Update the user with correct authentication fields
    const updateResult = await db.collection('users').updateOne(
      { email: 'mellowalex1@icloud.com' },
      {
        $set: {
          passwordHash: correctPasswordHash,  // Use SHA256 hash instead of bcrypt
          isEmailVerified: true,              // Mark email as verified
          sessionToken: sessionToken,         // Add session token
          updatedAt: new Date()
        },
        $unset: {
          password: ""  // Remove the bcrypt password field
        }
      }
    )

    console.log('✅ User updated successfully!')
    console.log(`- Password hash: Updated to SHA256`)
    console.log(`- Email verification: Set to true`)
    console.log(`- Session token: Generated`)

    // Verify the fix
    const updatedUser = await db.collection('users').findOne({ email: 'mellowalex1@icloud.com' })
    console.log('\n=== VERIFICATION ===')
    console.log(`✅ Password hash updated: ${updatedUser.passwordHash === correctPasswordHash ? 'YES' : 'NO'}`)
    console.log(`✅ Email verified: ${updatedUser.isEmailVerified ? 'YES' : 'NO'}`)
    console.log(`✅ Session token: ${updatedUser.sessionToken ? 'EXISTS' : 'MISSING'}`)

    // Test the authentication logic manually
    console.log('\n=== TESTING AUTHENTICATION LOGIC ===')
    const inputPassword = '123456'
    const inputPasswordHash = hashPassword(inputPassword)
    const authWillSucceed = (updatedUser.passwordHash === inputPasswordHash) && updatedUser.isEmailVerified
    
    console.log(`Input password: ${inputPassword}`)
    console.log(`Input password hash: ${inputPasswordHash}`)
    console.log(`Stored password hash: ${updatedUser.passwordHash}`)
    console.log(`Hashes match: ${updatedUser.passwordHash === inputPasswordHash ? '✅ YES' : '❌ NO'}`)
    console.log(`Email verified: ${updatedUser.isEmailVerified ? '✅ YES' : '❌ NO'}`) 
    console.log(`Authentication will: ${authWillSucceed ? '✅ SUCCEED' : '❌ FAIL'}`)

    if (authWillSucceed) {
      console.log('\n🎉 SUCCESS! Authentication is now fixed.')
      console.log('📱 Try logging in again with:')
      console.log('   Email: mellowalex1@icloud.com')
      console.log('   Password: 123456')
    } else {
      console.log('\n❌ Something is still wrong. Check the logs above.')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await mongoose.disconnect()
  }
}

fixAuthenticationIssue()