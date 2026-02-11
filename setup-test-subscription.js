/**
 * Set up test subscription scenario for a vendor
 * This will create an expired or expiring subscription for testing
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test';

async function setupTestSubscription() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔍 Connecting to MongoDB...\n');
    await client.connect();
    const db = client.db('test');
    
    const email = process.argv[2] || 'idiong.arnold@stu.cu.edu.ng';
    const scenario = process.argv[3] || 'expired'; // Options: active, expiring-7days, expiring-3days, expired, grace-5days, grace-1day, past-grace
    
    // Find user
    const user = await db.collection('users').findOne({ email });
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return;
    }
    
    console.log(`✅ User found: ${user.name} (${user.email})\n`);
    
    // Calculate dates based on scenario
    const now = new Date();
    let subscriptionStartedAt, subscriptionExpiresAt, subscriptionStatus;
    
    switch(scenario) {
      case 'active':
        // Active subscription with 15 days remaining
        subscriptionStartedAt = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
        subscriptionExpiresAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
        subscriptionStatus = 'active';
        console.log(`📋 Scenario: ACTIVE subscription (15 days remaining)`);
        break;
        
      case 'expiring-7days':
        // Subscription expiring in 7 days (should trigger 7-day warning)
        subscriptionStartedAt = new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000);
        subscriptionExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        subscriptionStatus = 'active';
        console.log(`📋 Scenario: Subscription expiring in 7 DAYS (should send 7-day warning)`);
        break;
        
      case 'expiring-3days':
        // Subscription expiring in 3 days (should trigger 3-day warning)
        subscriptionStartedAt = new Date(now.getTime() - 27 * 24 * 60 * 60 * 1000);
        subscriptionExpiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        subscriptionStatus = 'active';
        console.log(`📋 Scenario: Subscription expiring in 3 DAYS (should send 3-day warning)`);
        break;
        
      case 'expired':
        // Just expired (1 day ago) - should trigger expired notification
        subscriptionStartedAt = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
        subscriptionExpiresAt = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        subscriptionStatus = 'expired';
        console.log(`📋 Scenario: EXPIRED 1 day ago (grace period: 6 days left)`);
        break;
        
      case 'grace-5days':
        // Expired 2 days ago, 5 days of grace left
        subscriptionStartedAt = new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000);
        subscriptionExpiresAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        subscriptionStatus = 'expired';
        console.log(`📋 Scenario: EXPIRED 2 days ago (grace period: 5 days left)`);
        break;
        
      case 'grace-1day':
        // Expired 6 days ago, 1 day of grace left
        subscriptionStartedAt = new Date(now.getTime() - 36 * 24 * 60 * 60 * 1000);
        subscriptionExpiresAt = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        subscriptionStatus = 'expired';
        console.log(`📋 Scenario: EXPIRED 6 days ago (grace period: 1 day left - URGENT!)`);
        break;
        
      case 'past-grace':
        // Expired 10 days ago, past grace period
        subscriptionStartedAt = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
        subscriptionExpiresAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
        subscriptionStatus = 'expired';
        console.log(`📋 Scenario: EXPIRED 10 days ago (PAST grace period - should unpublish store)`);
        break;
        
      default:
        console.log(`❌ Invalid scenario: ${scenario}`);
        console.log(`\n💡 Valid scenarios:`);
        console.log(`   - active (15 days remaining)`);
        console.log(`   - expiring-7days (triggers 7-day warning)`);
        console.log(`   - expiring-3days (triggers 3-day warning)`);
        console.log(`   - expired (1 day ago, 6 days grace left)`);
        console.log(`   - grace-5days (2 days ago, 5 days grace left)`);
        console.log(`   - grace-1day (6 days ago, 1 day grace left)`);
        console.log(`   - past-grace (10 days ago, should unpublish)`);
        return;
    }
    
    console.log(`   Start date: ${subscriptionStartedAt.toLocaleString()}`);
    console.log(`   Expiry date: ${subscriptionExpiresAt.toLocaleString()}`);
    console.log(`   Status: ${subscriptionStatus}\n`);
    
    // Update user with subscription info
    const updateResult = await db.collection('users').updateOne(
      { email: email },
      {
        $set: {
          subscriptionStatus: subscriptionStatus,
          subscriptionPlan: 'monthly',
          subscriptionAmount: 3000,
          subscriptionStartedAt: subscriptionStartedAt,
          subscriptionExpiresAt: subscriptionExpiresAt,
          // Reset notification flags so they can be sent again
          subscriptionReminderSent: null,
          subscriptionWarning7DaysSent: null,
          subscriptionWarning3DaysSent: null,
          subscriptionExpiredNotificationSent: null,
          updatedAt: new Date()
        }
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log(`✅ Successfully set up test subscription!`);
      console.log(`\n📊 Current State:`);
      console.log(`   Status: ${subscriptionStatus}`);
      console.log(`   Plan: monthly (₦3,000)`);
      console.log(`   Started: ${subscriptionStartedAt.toLocaleDateString()}`);
      console.log(`   Expires: ${subscriptionExpiresAt.toLocaleDateString()}`);
      
      if (subscriptionStatus === 'expired') {
        const daysExpired = Math.floor((now - subscriptionExpiresAt) / (1000 * 60 * 60 * 24));
        const graceDaysLeft = Math.max(0, 7 - daysExpired);
        console.log(`   Days expired: ${daysExpired}`);
        console.log(`   Grace days left: ${graceDaysLeft} of 7`);
      }
      
      console.log(`\n🔔 Notification Flags (all reset to trigger emails):`);
      console.log(`   ❌ Reminder sent: NO`);
      console.log(`   ❌ 7-day warning sent: NO`);
      console.log(`   ❌ 3-day warning sent: NO`);
      console.log(`   ❌ Expired notification sent: NO`);
      
      console.log(`\n🧪 Next Steps to Test:`);
      console.log(`   1. Run subscription check cron job to trigger emails`);
      console.log(`   2. Check vendor's email inbox for notifications`);
      console.log(`   3. Verify store publication status`);
      console.log(`\n💡 To run subscription check:`);
      console.log(`   node run-subscription-check.js`);
      
    } else {
      console.log(`❌ Failed to update subscription`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

console.log('🧪 Test Subscription Setup Tool\n');
console.log('Usage: node setup-test-subscription.js <email> <scenario>\n');
console.log('Available scenarios:');
console.log('  active          - Active subscription (15 days left)');
console.log('  expiring-7days  - Expires in 7 days (triggers warning)');
console.log('  expiring-3days  - Expires in 3 days (triggers warning)');
console.log('  expired         - Expired 1 day ago (6 days grace)');
console.log('  grace-5days     - Expired 2 days ago (5 days grace)');
console.log('  grace-1day      - Expired 6 days ago (1 day grace - urgent!)');
console.log('  past-grace      - Expired 10 days ago (should unpublish)\n');

setupTestSubscription().catch(console.error);
