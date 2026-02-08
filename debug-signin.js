const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test"

async function debugSignInIssue() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Debugging sign-in issue for mellowalex1@icloud.com...\n')

    const db = mongoose.connection.db

    // Check the user record
    const user = await db.collection('users').findOne({ email: 'mellowalex1@icloud.com' })
    
    if (!user) {
      console.log('❌ User not found in database!')
      return
    }

    console.log('✅ User found in database:')
    console.log(`- Email: ${user.email}`)
    console.log(`- Name: ${user.displayName || user.name}`)
    console.log(`- Role: ${user.role}`)
    console.log(`- Password field: ${user.password ? 'EXISTS' : 'MISSING'}`)
    console.log(`- Password hash: ${user.password ? user.password.substring(0, 20) + '...' : 'N/A'}`)

    // Test password verification
    if (user.password) {
      console.log('\n=== TESTING PASSWORD VERIFICATION ===')
      const testPassword = '123456'
      
      try {
        const isValid = await bcrypt.compare(testPassword, user.password)
        console.log(`Password verification result: ${isValid ? '✅ VALID' : '❌ INVALID'}`)
        
        if (!isValid) {
          console.log('🔧 Password hash mismatch. Let me fix this...')
          
          // Rehash the password correctly
          const newHashedPassword = await bcrypt.hash(testPassword, 10)
          console.log(`New hash: ${newHashedPassword.substring(0, 20)}...`)
          
          // Update the user with correct password hash
          await db.collection('users').updateOne(
            { email: 'mellowalex1@icloud.com' },
            { $set: { password: newHashedPassword, updatedAt: new Date() } }
          )
          
          console.log('✅ Password hash updated successfully!')
          
          // Verify the fix
          const updatedUser = await db.collection('users').findOne({ email: 'mellowalex1@icloud.com' })
          const isNowValid = await bcrypt.compare(testPassword, updatedUser.password)
          console.log(`Verification after fix: ${isNowValid ? '✅ VALID' : '❌ STILL INVALID'}`)
        }
      } catch (error) {
        console.log(`❌ Password verification error: ${error.message}`)
      }
    }

    // Check if there are any other users with similar issues
    console.log('\n=== CHECKING OTHER USERS ===')
    const allUsers = await db.collection('users').find({ role: 'vendor' }).toArray()
    
    for (const u of allUsers) {
      console.log(`${u.email}: password ${u.password ? 'EXISTS' : 'MISSING'}`)
    }

    console.log('\n✅ Try logging in again with:')
    console.log('Email: mellowalex1@icloud.com')
    console.log('Password: 123456')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await mongoose.disconnect()
  }
}

debugSignInIssue()