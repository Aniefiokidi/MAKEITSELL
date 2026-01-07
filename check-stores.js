const { connectToDatabase } = require('./lib/mongodb-operations')
const { Store } = require('./lib/models')

async function checkStores() {
  try {
    await connectToDatabase()
    
    console.log('Checking stores in database...')
    const storeCount = await Store.countDocuments()
    console.log('Total stores:', storeCount)
    
    const stores = await Store.find().limit(5).lean()
    console.log('Sample stores:')
    stores.forEach((store, index) => {
      console.log(`${index + 1}. Store ID: ${store._id}`)
      console.log(`   Name: ${store.name || 'No name'}`)
      console.log(`   Vendor ID: ${store.vendorId || 'No vendor ID'}`)
      console.log(`   Category: ${store.category || 'No category'}`)
      console.log(`   Is Open: ${store.isOpen}`)
      console.log('   ---')
    })

    // Also check if there are any documents in the stores collection
    const allDocs = await Store.find({}, { _id: 1, name: 1, vendorId: 1 }).limit(10)
    console.log('All store documents:', allDocs)

  } catch (error) {
    console.error('Error checking stores:', error)
  }
}

checkStores()