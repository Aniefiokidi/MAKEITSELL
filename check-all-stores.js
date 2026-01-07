const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gote-marketplace'

async function checkStores() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB\n')

    const db = mongoose.connection.db

    // Get all stores
    const stores = await db.collection('stores').find({}).toArray()
    console.log(`Total stores: ${stores.length}\n`)
    
    console.log('All stores:')
    stores.forEach(store => {
      console.log(`- ${store.storeName}`)
      console.log(`  Email: ${store.email}`)
      console.log(`  VendorId: ${store.vendorId}`)
      console.log(`  Category: ${store.category}`)
      console.log('')
    })

    // Check for specific vendors
    console.log('\nChecking for Mr Wave (vendorId: 69538baa4573f00d8f60f02c):')
    const mrWaveStore = await db.collection('stores').findOne({ vendorId: '69538baa4573f00d8f60f02c' })
    console.log(mrWaveStore ? `✓ FOUND: ${mrWaveStore.storeName}` : '✗ NOT FOUND')

    console.log('\nChecking for Mr Yati (vendorId: 695391694573f00d8f60f033):')
    const mrYatiStore = await db.collection('stores').findOne({ vendorId: '695391694573f00d8f60f033' })
    console.log(mrYatiStore ? `✓ FOUND: ${mrYatiStore.storeName}` : '✗ NOT FOUND')

    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

checkStores()
