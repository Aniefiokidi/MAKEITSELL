const mongoose = require('mongoose')

// Use the actual cloud database from .env.local
const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/"

async function checkRealDatabase() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to REAL MongoDB Atlas database\n')

    const db = mongoose.connection.db

    // Check what databases are available
    const admin = db.admin()
    const databases = await admin.listDatabases()
    console.log('Available databases:')
    databases.databases.forEach(db => {
      console.log(`- ${db.name}`)
    })
    
    // Try different database names
    const possibleDatabases = ['makeitsell', 'gote-marketplace', 'test', 'branda']
    
    for (const dbName of possibleDatabases) {
      console.log(`\n=== Checking database: ${dbName} ===`)
      const targetDb = mongoose.connection.client.db(dbName)
      
      try {
        const users = await targetDb.collection('users').find({ role: 'vendor' }).limit(5).toArray()
        const stores = await targetDb.collection('stores').find({}).limit(5).toArray()
        const subscriptions = await targetDb.collection('subscription_payments').find({}).limit(5).toArray()
        
        console.log(`${dbName} - Vendors: ${users.length}`)
        console.log(`${dbName} - Stores: ${stores.length}`) 
        console.log(`${dbName} - Subscriptions: ${subscriptions.length}`)
        
        if (users.length > 0 || stores.length > 0 || subscriptions.length > 0) {
          console.log('\nFound data! Sample vendors:')
          users.forEach(user => {
            console.log(`- ${user.displayName || user.name} (${user.email}) [ID: ${user._id}]`)
          })
          
          if (stores.length > 0) {
            console.log('\nSample stores:')
            stores.forEach(store => {
              console.log(`- ${store.storeName} (Vendor: ${store.vendorId}) [ID: ${store._id}]`)
            })
          }
          
          if (subscriptions.length > 0) {
            console.log('\nSample subscriptions:')
            subscriptions.forEach(sub => {
              console.log(`- Store: ${sub.storeId} Amount: ${sub.amount} Status: ${sub.status}`)
            })
          }
        }
      } catch (err) {
        console.log(`${dbName} - Error accessing collections: ${err.message}`)
      }
    }

  } catch (error) {
    console.error('Connection error:', error)
  } finally {
    await mongoose.disconnect()
  }
}

checkRealDatabase()