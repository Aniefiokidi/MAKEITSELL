const mongoose = require('mongoose')

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test"

async function verifyBothUsers() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Verifying both recreated users in admin panel...\n')

    const db = mongoose.connection.db
    
    // Get the same data the admin API will fetch
    const users = await db.collection('users').find({ role: 'vendor' }).toArray()
    const stores = await db.collection('stores').find({}).toArray()
    const subscriptions = await db.collection('subscription_payments')
      .find({ status: 'completed' })
      .sort({ paymentDate: -1 })
      .toArray()

    console.log(`Admin API will process: ${users.length} vendors, ${stores.length} stores, ${subscriptions.length} subscriptions\n`)

    // Find both recreated users
    const alexUser = users.find(u => u.email === 'mellowalex1@icloud.com')
    const jonathanUser = users.find(u => u.email === 'jonathandavngeri@gmail.com')

    console.log('=== BOTH USERS VERIFICATION ===')
    
    // Alex (WINTER store)
    console.log('\n👤 ALEX IDIONG (WINTER):')
    if (alexUser) {
      const winterStore = stores.find(s => s.vendorId === alexUser._id.toString())
      const alexSubscription = subscriptions.find(s => s.vendorId === alexUser._id.toString())
      
      console.log(`   ✅ User: Found (${alexUser.displayName})`)
      console.log(`   ✅ Store: ${winterStore ? winterStore.storeName : 'NOT FOUND'}`)
      console.log(`   ✅ Subscription: ${alexSubscription ? '✓ Active' : '✗ Missing'}`)
      if (alexSubscription) {
        const expiryDate = new Date(alexSubscription.subscriptionPeriod.end)
        const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24))
        console.log(`   💳 Expiry: ${expiryDate.toLocaleDateString()} (${daysLeft} days left)`)
      }
    } else {
      console.log('   ❌ User: NOT FOUND')
    }

    // Jonathan (Abstra Tech store) 
    console.log('\n👤 JONATHAN DAVID (ABSTRA TECH):')
    if (jonathanUser) {
      const abstraStore = stores.find(s => s.vendorId === jonathanUser._id.toString())
      const jonathanSubscription = subscriptions.find(s => s.vendorId === jonathanUser._id.toString())
      
      console.log(`   ✅ User: Found (${jonathanUser.displayName})`)
      console.log(`   ✅ Store: ${abstraStore ? abstraStore.storeName : 'NOT FOUND'}`)
      console.log(`   ✅ Subscription: ${jonathanSubscription ? '✓ Active' : '✗ Missing'}`)
      if (jonathanSubscription) {
        const expiryDate = new Date(jonathanSubscription.subscriptionPeriod.end)
        const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24))
        console.log(`   💳 Expiry: ${expiryDate.toLocaleDateString()} (${daysLeft} days left)`)
      }
    } else {
      console.log('   ❌ User: NOT FOUND')
    }

    // Show what will appear in admin panel for both
    console.log('\n=== ADMIN PANEL PREVIEW ===')
    
    const allVendorUsers = users.filter(u => u.role === 'vendor')
    
    allVendorUsers.forEach((user, i) => {
      const store = stores.find(s => s.vendorId === user._id.toString())
      const subscription = subscriptions.find(s => s.vendorId === user._id.toString())
      
      if (store) { // Only show users with stores
        let status = 'inactive'
        let expiryDisplay = 'N/A'
        
        if (subscription) {
          const now = new Date()
          const expiryDate = new Date(subscription.subscriptionPeriod.end)
          status = expiryDate > now ? 'active' : 'expired'
          expiryDisplay = expiryDate.toLocaleDateString()
        }
        
        console.log(`\n${i + 1}. Vendor: ${user.displayName || user.name}`)
        console.log(`   Email: ${user.email}`)
        console.log(`   Store: ${store.storeName}`)
        console.log(`   Status: ${status} ${status === 'active' ? '🟢' : '🔴'}`)
        console.log(`   Expiry: ${expiryDisplay}`)
        console.log(`   Amount: ₦${subscription?.amount || 'N/A'}`)
      }
    })

    console.log('\n🎉 Both users are ready!')
    console.log('\n📱 Login Credentials:')
    console.log('   👤 Alex (WINTER): mellowalex1@icloud.com / 123456')
    console.log('   👤 Jonathan (Abstra Tech): jonathandavngeri@gmail.com / 123456')
    
    console.log('\n🔄 Refresh your admin panel to see both vendors with active subscriptions!')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.disconnect()
  }
}

verifyBothUsers()