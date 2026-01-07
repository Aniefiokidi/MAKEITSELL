const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gote-marketplace'

async function autoLinkVendorsToStores() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB\n')

    const db = mongoose.connection.db

    // Find all vendor users
    const vendors = await db.collection('users').find({ role: 'vendor' }).toArray()
    console.log(`Found ${vendors.length} vendor accounts\n`)

    let created = 0
    let skipped = 0

    for (const vendor of vendors) {
      // Check if store already exists
      const existingStore = await db.collection('stores').findOne({ vendorId: vendor._id })
      
      if (existingStore) {
        console.log(`⚪ ${vendor.displayName || vendor.name} - Store already exists`)
        skipped++
        continue
      }

      // Create store from vendor account
      const storeName = vendor.displayName || vendor.name || `${vendor.email.split('@')[0]}'s Store`
      
      await db.collection('stores').insertOne({
        vendorId: vendor._id,
        storeName: storeName,
        storeDescription: `Welcome to ${storeName}! Browse our quality products and services.`,
        storeImage: vendor.profileImage || '/images/default-store.jpg',
        logoImage: vendor.profileImage || '/images/default-store.jpg',
        category: vendor.category || 'other',
        address: vendor.address || 'Lagos, Nigeria',
        city: vendor.city || 'Lagos',
        location: vendor.location || vendor.address || 'Lagos, Nigeria',
        phone: vendor.phone || '',
        email: vendor.email,
        rating: 0,
        reviewCount: 0,
        productCount: 0,
        isOpen: true,
        deliveryTime: '1-3 days',
        deliveryFee: 500,
        minimumOrder: 1000,
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        isActive: true,
        accountStatus: 'active',
        createdAt: vendor.createdAt || new Date(),
        updatedAt: new Date()
      })

      console.log(`✅ Created store for: ${storeName} (${vendor.email})`)
      created++
    }

    console.log(`\n📊 Summary:`)
    console.log(`   Created: ${created} stores`)
    console.log(`   Skipped: ${skipped} stores (already existed)`)
    console.log(`\n✅ Done! Refresh your /shop page to see the stores`)

    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

autoLinkVendorsToStores()
