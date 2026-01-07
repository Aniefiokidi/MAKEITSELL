const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gote-marketplace'

async function createMrWaveAccount() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB\n')

    const db = mongoose.connection.db

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email: 'arnoldeee123+testt1@gmail.com' })
    if (existingUser) {
      console.log('User already exists:', existingUser._id)
      return
    }

    // Create user ID
    const userId = new mongoose.Types.ObjectId().toString()
    console.log('Creating user with ID:', userId)

    // Hash a default password
    const hashedPassword = await bcrypt.hash('password123', 10)

    // Create user
    const userResult = await db.collection('users').insertOne({
      _id: userId,
      email: 'arnoldeee123+testt1@gmail.com',
      name: 'Mr Wave',
      displayName: 'Mr Wave',
      password: hashedPassword,
      role: 'vendor',
      phone: '+234 812 938 0869',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    console.log('✓ User created')

    // Create store
    const storeResult = await db.collection('stores').insertOne({
      vendorId: userId,
      storeName: 'Mr Wave Store',
      storeDescription: 'Quality products and services',
      storeImage: '/images/default-store.jpg',
      category: 'fashion',
      rating: 0,
      reviewCount: 0,
      isOpen: true,
      deliveryTime: '30-45 mins',
      deliveryFee: 500,
      minimumOrder: 1000,
      address: '16 olu akerele street',
      city: 'Lagos',
      location: { type: 'Point', coordinates: [0, 0] },
      phone: '+234 812 938 0869',
      email: 'arnoldeee123+testt1@gmail.com',
      subscriptionStatus: 'active',
      subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      isActive: true,
      accountStatus: 'active',
      productCount: 0,
      logoImage: '/images/default-store.jpg',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    console.log('✓ Store created:', storeResult.insertedId)
    console.log('\nAccount setup complete!')
    console.log('Email: arnoldeee123+testt1@gmail.com')
    console.log('Password: password123')
    console.log('Role: vendor')

    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

createMrWaveAccount()
