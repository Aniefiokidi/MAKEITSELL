const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gote-marketplace'

async function createMissingStores() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB\n')

    const db = mongoose.connection.db

    // Get users who are vendors
    const mrWave = await db.collection('users').findOne({ _id: '69538baa4573f00d8f60f02c' })
    const mrYati = await db.collection('users').findOne({ _id: '695391694573f00d8f60f033' })

    console.log('Mr Wave:', mrWave ? mrWave.email : 'NOT FOUND')
    console.log('Mr Yati:', mrYati ? mrYati.email : 'NOT FOUND')

    // Create store for Mr Wave
    if (mrWave) {
      const existing = await db.collection('stores').findOne({ vendorId: mrWave._id })
      if (!existing) {
        await db.collection('stores').insertOne({
          vendorId: mrWave._id,
          storeName: mrWave.displayName || mrWave.name || 'Mr Wave Store',
          storeDescription: 'Quality products and services',
          storeImage: '/images/default-store.jpg',
          logoImage: '/images/default-store.jpg',
          category: 'fashion',
          address: mrWave.address || '16 olu akerele street',
          city: mrWave.city || 'Lagos',
          location: mrWave.location || '16 olu akerele street',
          phone: mrWave.phone || '',
          email: mrWave.email,
          rating: 0,
          reviewCount: 0,
          productCount: 0,
          isOpen: true,
          deliveryTime: '1-3 days',
          deliveryFee: 500,
          minimumOrder: 1000,
          subscriptionStatus: 'active',
          subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isActive: true,
          accountStatus: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        console.log('\n✓ Created store for Mr Wave')
      } else {
        console.log('\n⚠ Store already exists for Mr Wave')
      }
    }

    // Create store for Mr Yati
    if (mrYati) {
      const existing = await db.collection('stores').findOne({ vendorId: mrYati._id })
      if (!existing) {
        await db.collection('stores').insertOne({
          vendorId: mrYati._id,
          storeName: mrYati.displayName || mrYati.name || 'Mr Yati Store',
          storeDescription: 'Quality products and services',
          storeImage: '/images/default-store.jpg',
          logoImage: '/images/default-store.jpg',
          category: 'fashion',
          address: mrYati.address || '16 olu akerele street',
          city: mrYati.city || 'Lagos',
          location: mrYati.location || '16 olu akerele street',
          phone: mrYati.phone || '',
          email: mrYati.email,
          rating: 0,
          reviewCount: 0,
          productCount: 0,
          isOpen: true,
          deliveryTime: '1-3 days',
          deliveryFee: 500,
          minimumOrder: 1000,
          subscriptionStatus: 'active',
          subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isActive: true,
          accountStatus: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        console.log('✓ Created store for Mr Yati')
      } else {
        console.log('⚠ Store already exists for Mr Yati')
      }
    }

    console.log('\n✅ Done! Check /shop page')

    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

createMissingStores()
