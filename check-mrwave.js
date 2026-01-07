const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gote-marketplace'

async function checkMrWave() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB\n')

    const db = mongoose.connection.db

    // Find user
    const user = await db.collection('users').findOne({ email: 'arnoldeee123+testt1@gmail.com' })
    console.log('User:', user ? {
      _id: user._id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
      role: user.role
    } : 'NOT FOUND')

    if (user) {
      // Check if store exists for this user
      const store = await db.collection('stores').findOne({ vendorId: user._id.toString() })
      console.log('\nStore by vendorId:', store ? {
        _id: store._id,
        storeName: store.storeName,
        vendorId: store.vendorId,
        email: store.email,
        category: store.category
      } : 'NOT FOUND')

      // Check by email
      const storeByEmail = await db.collection('stores').findOne({ email: user.email })
      console.log('\nStore by email:', storeByEmail ? {
        _id: storeByEmail._id,
        storeName: storeByEmail.storeName,
        vendorId: storeByEmail.vendorId
      } : 'NOT FOUND')
    }

    // Check all stores
    console.log('\n--- All Stores ---')
    const allStores = await db.collection('stores').find({}).toArray()
    console.log(`Total: ${allStores.length} stores`)
    allStores.forEach(s => {
      console.log(`- ${s.storeName} (${s.email}) vendorId: ${s.vendorId}`)
    })

    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

checkMrWave()
