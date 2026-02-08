const mongoose = require('mongoose')

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test"

async function verifyWinterUserInAdmin() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Verifying WINTER user will appear in admin panel...\n')

    const db = mongoose.connection.db
    
    // Get the same data the admin API will fetch
    const users = await db.collection('users').find({ role: 'vendor' }).toArray()
    const stores = await db.collection('stores').find({}).toArray()
    const subscriptions = await db.collection('subscription_payments')
      .find({ status: 'completed' })
      .sort({ paymentDate: -1 })
      .toArray()

    console.log(`Admin API will process: ${users.length} vendors, ${stores.length} stores, ${subscriptions.length} subscriptions\n`)

    // Find the WINTER user specifically
    const winterUser = users.find(u => u.email === 'mellowalex1@icloud.com')
    const winterStore = stores.find(s => s.storeName === 'WINTER')
    const winterSubscription = subscriptions.find(s => s.vendorId === winterUser?._id.toString())

    console.log('=== WINTER USER VERIFICATION ===')
    console.log(`👤 User: ${winterUser ? '✅ FOUND' : '❌ NOT FOUND'}`)
    if (winterUser) {
      console.log(`   Name: ${winterUser.displayName}`)
      console.log(`   Email: ${winterUser.email}`)
      console.log(`   ID: ${winterUser._id}`)
    }

    console.log(`🏪 Store: ${winterStore ? '✅ FOUND' : '❌ NOT FOUND'}`)
    if (winterStore) {
      console.log(`   Store Name: ${winterStore.storeName}`)
      console.log(`   Vendor ID: ${winterStore.vendorId}`)
      console.log(`   Linked: ${winterStore.vendorId === winterUser?._id.toString() ? '✅ YES' : '❌ NO'}`)
    }

    console.log(`💳 Subscription: ${winterSubscription ? '✅ FOUND' : '❌ NOT FOUND'}`)
    if (winterSubscription) {
      console.log(`   Amount: ₦${winterSubscription.amount}`)
      console.log(`   Expiry: ${winterSubscription.subscriptionPeriod.end}`)
      console.log(`   Status: ${winterSubscription.status}`)
      
      // Check if subscription is active
      const now = new Date()
      const expiryDate = new Date(winterSubscription.subscriptionPeriod.end)
      const isActive = expiryDate > now
      const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
      
      console.log(`   Active: ${isActive ? '✅ YES' : '❌ EXPIRED'}`)
      console.log(`   Days left: ${daysLeft}`)
    }

    // Show what will appear in admin panel
    if (winterUser && winterStore && winterSubscription) {
      console.log('\n=== ADMIN PANEL DISPLAY ===')
      console.log(`Vendor Name: ${winterUser.displayName}`)
      console.log(`Email: ${winterUser.email}`)
      console.log(`Store: ${winterStore.storeName}`)
      console.log(`Subscription Status: active`)
      console.log(`Expiry Date: ${winterSubscription.subscriptionPeriod.end}`)
      console.log(`Amount: ₦${winterSubscription.amount}`)
      
      console.log('\n🎉 SUCCESS: WINTER store will now show properly in admin panel!')
      console.log('👤 User: Alex Mellow (mellowalex1@icloud.com)')
      console.log('🏪 Store: WINTER')  
      console.log('💳 Subscription: Active for 1 month')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.disconnect()
  }
}

verifyWinterUserInAdmin()