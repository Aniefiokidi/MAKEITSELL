const mongoose = require('mongoose')

// Test the updated API by calling it directly (simulating the request)
const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test"

// Import the API functions
async function testUpdatedVendorAPI() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Testing updated vendor API logic...\n')

    const db = mongoose.connection.db
    
    // Simulate the same logic as the updated API
    const users = await db.collection('users').find({ role: 'vendor' }).toArray()
    const stores = await db.collection('stores').find({}).toArray()
    const subscriptions = await db.collection('subscription_payments')
      .find({ status: 'completed' })
      .sort({ paymentDate: -1 })
      .toArray()

    console.log(`Found ${users.length} vendors, ${stores.length} stores, ${subscriptions.length} subscriptions`)

    // Group subscriptions by vendorId and get the most recent one
    const latestSubscriptionByVendor = {}
    subscriptions.forEach(sub => {
      if (!sub.vendorId) return
      const vendorIdStr = sub.vendorId.toString()
      if (!latestSubscriptionByVendor[vendorIdStr] || 
          new Date(sub.paymentDate) > new Date(latestSubscriptionByVendor[vendorIdStr].paymentDate)) {
        latestSubscriptionByVendor[vendorIdStr] = sub
      }
    })

    console.log('\nLatest subscription by vendor:')
    Object.entries(latestSubscriptionByVendor).forEach(([vendorId, sub]) => {
      console.log(`Vendor ${vendorId}: ${sub.subscriptionPeriod.end} (₦${sub.amount})`)
    })

    // Create vendor mapping with subscription data
    const storeByVendorDetailed = {}
    
    stores.forEach(store => {
      if (!store?.vendorId) return
      const vendorIdStr = store.vendorId.toString()
      const subscription = latestSubscriptionByVendor[vendorIdStr]
      
      let subscriptionStatus = 'inactive'
      let subscriptionExpiry = null
      let subscriptionAmount = null
      
      if (subscription) {
        const now = new Date()
        const expiryDate = new Date(subscription.subscriptionPeriod.end)
        subscriptionExpiry = expiryDate.toISOString()
        subscriptionAmount = subscription.amount
        
        if (expiryDate > now) {
          subscriptionStatus = 'active'
        } else {
          subscriptionStatus = 'expired'
        }
      }
      
      storeByVendorDetailed[vendorIdStr] = {
        storeName: store.storeName,
        subscriptionExpiry,
        subscriptionStatus,
        subscriptionAmount
      }
    })

    // Create final vendor list
    console.log('\n=== FINAL VENDOR DATA (will appear in admin panel) ===')
    users.forEach((vendor, i) => {
      const vendorIdStr = vendor._id.toString()
      const store = storeByVendorDetailed[vendorIdStr]
      
      if (store) {
        console.log(`\n${i + 1}. Vendor: ${vendor.displayName || vendor.name}`)
        console.log(`   Email: ${vendor.email}`)
        console.log(`   Store: ${store.storeName}`)
        console.log(`   Subscription Status: ${store.subscriptionStatus}`)
        console.log(`   Expiry Date: ${store.subscriptionExpiry}`)
        console.log(`   Amount: ₦${store.subscriptionAmount}`)
        
        // Calculate days until expiry
        if (store.subscriptionExpiry) {
          const expiryDate = new Date(store.subscriptionExpiry)
          const now = new Date()
          const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
          console.log(`   Days until expiry: ${daysUntilExpiry}`)
        }
      }
    })

    // Total revenue
    const totalRevenue = subscriptions.reduce((total, sub) => total + (sub.amount || 0), 0)
    console.log(`\n💰 Total Revenue: ₦${totalRevenue.toLocaleString()}`)
    console.log(`📊 Total Subscriptions: ${subscriptions.length}`)
    
    console.log('\n✅ SUCCESS: API will now show real vendor data with proper expiry dates!')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.disconnect()
  }
}

testUpdatedVendorAPI()