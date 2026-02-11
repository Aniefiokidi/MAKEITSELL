/**
 * Check vendor subscription status and grace period
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test';

async function checkSubscriptionStatus() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔍 Connecting to MongoDB...\n');
    await client.connect();
    const db = client.db('test');
    
    // Search for vendor with "JLC" in name or store name
    const searchTerm = process.argv[2] || 'JLC';
    
    console.log(`📦 Searching for vendor: "${searchTerm}"\n`);
    
    // Find stores matching the search
    const stores = await db.collection('stores').find({
      $or: [
        { storeName: { $regex: searchTerm, $options: 'i' } },
        { businessName: { $regex: searchTerm, $options: 'i' } }
      ]
    }).toArray();
    
    if (stores.length === 0) {
      console.log(`❌ No stores found matching "${searchTerm}"`);
      console.log('\n💡 Available stores:');
      const allStores = await db.collection('stores').find({}).project({ storeName: 1, businessName: 1, vendorId: 1 }).toArray();
      allStores.forEach(s => console.log(`   - ${s.storeName || s.businessName} (ID: ${s.vendorId})`));
      return;
    }
    
    console.log(`✅ Found ${stores.length} store(s):\n`);
    
    for (const store of stores) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🏪 Store: ${store.storeName || store.businessName}`);
      console.log(`   Store ID: ${store._id}`);
      console.log(`   Vendor ID: ${store.vendorId}`);
      
      // Find the vendor user - try both string and ObjectId
      const { ObjectId } = require('mongodb');
      let vendor = await db.collection('users').findOne({ _id: store.vendorId });
      
      // If not found, try converting to ObjectId
      if (!vendor && typeof store.vendorId === 'string') {
        try {
          vendor = await db.collection('users').findOne({ _id: new ObjectId(store.vendorId) });
        } catch (e) {
          // Invalid ObjectId format
        }
      }
      
      // If still not found, try matching by email in vendorInfo
      if (!vendor && store.email) {
        vendor = await db.collection('users').findOne({ email: store.email });
      }
      
      if (vendor) {
        console.log(`\n👤 Vendor Details:`);
        console.log(`   Name: ${vendor.name}`);
        console.log(`   Email: ${vendor.email}`);
        console.log(`   Role: ${vendor.role}`);
        
        console.log(`\n💳 Subscription Status:`);
        
        if (vendor.subscriptionStatus) {
          console.log(`   Status: ${vendor.subscriptionStatus}`);
        } else {
          console.log(`   Status: ❌ NOT SET`);
        }
        
        if (vendor.subscriptionExpiresAt) {
          const expiryDate = new Date(vendor.subscriptionExpiresAt);
          const now = new Date();
          const daysRemaining = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
          
          console.log(`   Expires: ${expiryDate.toLocaleString()}`);
          console.log(`   Current time: ${now.toLocaleString()}`);
          
          if (daysRemaining > 0) {
            console.log(`   ✅ ACTIVE (${daysRemaining} days remaining)`);
          } else if (daysRemaining >= -7) {
            const graceDaysLeft = 7 + daysRemaining;
            console.log(`   ⚠️  EXPIRED but in GRACE PERIOD`);
            console.log(`   Grace days left: ${graceDaysLeft} of 7 days`);
            console.log(`   Grace period ends: ${new Date(expiryDate.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleString()}`);
          } else {
            console.log(`   ❌ EXPIRED (${Math.abs(daysRemaining)} days ago)`);
            console.log(`   Grace period ended: ${new Date(expiryDate.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleString()}`);
          }
        } else {
          console.log(`   Expires: ❌ NOT SET`);
        }
        
        console.log(`\n📧 Email Notifications:`);
        
        if (vendor.subscriptionReminderSent) {
          console.log(`   Reminder sent: ✅ YES (${new Date(vendor.subscriptionReminderSent).toLocaleString()})`);
        } else {
          console.log(`   Reminder sent: ❌ NO`);
        }
        
        if (vendor.subscriptionWarning7DaysSent) {
          console.log(`   7-day warning: ✅ YES (${new Date(vendor.subscriptionWarning7DaysSent).toLocaleString()})`);
        } else {
          console.log(`   7-day warning: ❌ NO`);
        }
        
        if (vendor.subscriptionWarning3DaysSent) {
          console.log(`   3-day warning: ✅ YES (${new Date(vendor.subscriptionWarning3DaysSent).toLocaleString()})`);
        } else {
          console.log(`   3-day warning: ❌ NO`);
        }
        
        if (vendor.subscriptionExpiredNotificationSent) {
          console.log(`   Expired notification: ✅ YES (${new Date(vendor.subscriptionExpiredNotificationSent).toLocaleString()})`);
        } else {
          console.log(`   Expired notification: ❌ NO`);
        }
        
        // Check if store is published
        console.log(`\n🏬 Store Status:`);
        console.log(`   Published: ${store.isPublished ? '✅ YES' : '❌ NO'}`);
        
        if (vendor.subscriptionExpiresAt) {
          const expiryDate = new Date(vendor.subscriptionExpiresAt);
          const now = new Date();
          const daysRemaining = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
          
          console.log(`\n💡 Recommended Actions:`);
          
          if (daysRemaining > 0) {
            // Active subscription
            if (daysRemaining <= 7 && !vendor.subscriptionWarning7DaysSent) {
              console.log(`   🔔 Send 7-day warning email`);
            }
            if (daysRemaining <= 3 && !vendor.subscriptionWarning3DaysSent) {
              console.log(`   🔔 Send 3-day warning email`);
            }
          } else if (daysRemaining >= -7) {
            // Grace period
            const graceDaysLeft = 7 + daysRemaining;
            console.log(`   ⚠️  Vendor is in grace period (${graceDaysLeft} days left)`);
            if (!vendor.subscriptionExpiredNotificationSent) {
              console.log(`   🔔 Send expired notification with grace period info`);
            }
            if (graceDaysLeft <= 2) {
              console.log(`   🔔 Send urgent grace period ending warning`);
            }
          } else {
            // Past grace period
            console.log(`   ❌ Subscription expired beyond grace period`);
            if (store.isPublished) {
              console.log(`   ⚠️  URGENT: Unpublish store immediately`);
            }
          }
        }
        
      } else {
        console.log(`\n❌ Vendor user not found for vendorId: ${store.vendorId}`);
      }
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkSubscriptionStatus().catch(console.error);
