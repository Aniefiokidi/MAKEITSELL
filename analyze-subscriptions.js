const mongoose = require('mongoose')

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test"

async function analyzeSubscriptionStructure() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Analyzing subscription payment structure...\n')

    const db = mongoose.connection.db
    
    // Get a sample subscription to understand the structure
    const subscriptions = await db.collection('subscription_payments').find({}).limit(3).toArray()
    
    console.log('Sample subscription structures:')
    subscriptions.forEach((sub, i) => {
      console.log(`\n=== Subscription ${i + 1} ===`)
      console.log(JSON.stringify(sub, null, 2))
    })
    
    // Look for any field that might link to stores or vendors
    console.log('\n=== Looking for store/vendor linkage fields ===')
    const allSubscriptions = await db.collection('subscription_payments').find({}).toArray()
    
    const fieldAnalysis = {}
    allSubscriptions.forEach(sub => {
      Object.keys(sub).forEach(key => {
        if (!fieldAnalysis[key]) {
          fieldAnalysis[key] = { count: 0, samples: [] }
        }
        fieldAnalysis[key].count++
        if (fieldAnalysis[key].samples.length < 3) {
          fieldAnalysis[key].samples.push(sub[key])
        }
      })
    })
    
    console.log('\nField analysis across all subscriptions:')
    Object.entries(fieldAnalysis).forEach(([field, data]) => {
      console.log(`${field}: appears in ${data.count}/${allSubscriptions.length} records`)
      console.log(`  Sample values: ${data.samples.slice(0, 2).map(v => JSON.stringify(v)).join(', ')}`)
    })

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.disconnect()
  }
}

analyzeSubscriptionStructure()