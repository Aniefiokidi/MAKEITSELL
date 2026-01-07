const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gote-marketplace'

async function deleteMrWave() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB\n')

    const db = mongoose.connection.db

    // Delete user
    const userResult = await db.collection('users').deleteOne({ email: 'arnoldeee123+testt1@gmail.com' })
    console.log(`✓ Deleted ${userResult.deletedCount} user(s)`)

    // Delete store
    const storeResult = await db.collection('stores').deleteOne({ email: 'arnoldeee123+testt1@gmail.com' })
    console.log(`✓ Deleted ${storeResult.deletedCount} store(s)`)

    // Delete any pending signups
    const pendingResult = await db.collection('pending_signups').deleteMany({ email: 'arnoldeee123+testt1@gmail.com' })
    console.log(`✓ Deleted ${pendingResult.deletedCount} pending signup(s)`)

    // Delete any login tokens
    const tokensResult = await db.collection('login_tokens').deleteMany({ 
      $or: [
        { email: 'arnoldeee123+testt1@gmail.com' },
        { userId: '695388d211a6918314a510d6' }
      ]
    })
    console.log(`✓ Deleted ${tokensResult.deletedCount} login token(s)`)

    console.log('\nMr Wave account completely removed. Ready for fresh signup!')

    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

deleteMrWave()
