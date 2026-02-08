const mongoose = require('mongoose')

// Use the updated connection string with database name
const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test"

async function testRealDatabaseConnection() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to real MongoDB Atlas database: test\n')

    const db = mongoose.connection.db

    // Get real vendor data 
    const vendors = await db.collection('users').find({ role: 'vendor' }).toArray()
    const stores = await db.collection('stores').find({}).toArray()
    const subscriptions = await db.collection('subscription_payments').find({ status: 'completed' }).toArray()

    console.log(`Found ${vendors.length} real vendors:`)
    vendors.forEach((vendor, i) => {
      console.log(`${i+1}. ${vendor.displayName || vendor.name} (${vendor.email})`)
      console.log(`   ID: ${vendor._id}`)
    })

    console.log(`\nFound ${stores.length} real stores:`)
    stores.forEach((store, i) => {
      console.log(`${i+1}. ${store.storeName} (Vendor: ${store.vendorId})`)
      console.log(`   ID: ${store._id}`)
    })

    console.log(`\nFound ${subscriptions.length} completed subscriptions:`)
    subscriptions.forEach((sub, i) => {
      console.log(`${i+1}. Amount: ₦${sub.amount} Status: ${sub.status}`)
      console.log(`   Transaction: ${sub.reference}`)
    })

    // Now test vendor-store mapping with real data
    console.log('\n=== REAL VENDOR-STORE MAPPING ===')
    const vendorData = []
    
    for (const store of stores) {
      const vendor = vendors.find(v => v._id.toString() === store.vendorId.toString())
      if (vendor) {
        // Find subscription for this store  
        const subscription = subscriptions.find(s => s.reference && s.metadata?.storeId === store._id.toString())
        
        vendorData.push({
          name: vendor.displayName || vendor.name,
          email: vendor.email,
          storeName: store.storeName,
          storeId: store._id.toString(),
          subscriptionStatus: subscription ? 'active' : 'inactive',
          subscriptionAmount: subscription ? subscription.amount : 'N/A'
        })
      }
    }
    
    console.log('\nMapped vendor data (what should appear in admin panel):')
    vendorData.forEach((vendor, i) => {
      console.log(`${i+1}. ${vendor.name}`)
      console.log(`   Store: ${vendor.storeName}`)
      console.log(`   Status: ${vendor.subscriptionStatus}`) 
      console.log(`   Amount: ₦${vendor.subscriptionAmount}`)
    })

    console.log('\n🎉 Your admin panel should now show this REAL data!')
    console.log('📱 Please refresh your browser to see the updated vendor information.')

  } catch (error) {
    console.error('❌ Database connection error:', error.message)
  } finally {
    await mongoose.disconnect()
  }
}

testRealDatabaseConnection()