// Script to fix existing stores with missing or incorrect fields
// Run with: node fix-existing-stores.js

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gote-marketplace';

async function fixStores() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const storesCollection = db.collection('stores');
    
    // Find all stores
    const stores = await storesCollection.find({}).toArray();
    console.log(`Found ${stores.length} stores to check`);
    
    let updatedCount = 0;
    
    for (const store of stores) {
      const updates = {};
      
      // Fix missing logoImage - use storeImage if available
      if (!store.logoImage && store.storeImage) {
        updates.logoImage = store.storeImage;
      }
      
      // Fix missing location field - use address if available
      if (!store.location && store.address) {
        updates.location = store.address;
      }
      
      // Fix missing city - try to extract from address or location
      if (!store.city) {
        const addressText = store.address || store.location || '';
        // Try to extract city (usually first part before comma)
        const cityMatch = addressText.split(',')[0];
        if (cityMatch) {
          updates.city = cityMatch.trim();
        } else {
          updates.city = 'Lagos'; // Default
        }
      }
      
      // Ensure productCount exists
      if (store.productCount === undefined || store.productCount === null) {
        updates.productCount = 0;
      }
      
      // Ensure rating and reviewCount exist
      if (store.rating === undefined || store.rating === null) {
        updates.rating = 0;
      }
      if (store.reviewCount === undefined || store.reviewCount === null) {
        updates.reviewCount = 0;
      }
      
      // Ensure isOpen exists
      if (store.isOpen === undefined || store.isOpen === null) {
        updates.isOpen = true;
      }
      
      // Update if there are any changes
      if (Object.keys(updates).length > 0) {
        await storesCollection.updateOne(
          { _id: store._id },
          { $set: updates }
        );
        updatedCount++;
        console.log(`Updated store: ${store.storeName || store.name} (ID: ${store._id})`);
        console.log('  Applied updates:', updates);
      }
    }
    
    console.log(`\n✅ Fixed ${updatedCount} stores`);
    console.log(`✅ ${stores.length - updatedCount} stores were already correct`);
    
  } catch (error) {
    console.error('Error fixing stores:', error);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
}

fixStores();
