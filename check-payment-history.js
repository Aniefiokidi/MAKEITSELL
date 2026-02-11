/**
 * Check vendor subscription payment history
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test';

async function checkPaymentHistory() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔍 Connecting to MongoDB...\n');
    await client.connect();
    const db = client.db('test');
    
    const email = process.argv[2] || 'idiong.arnold@stu.cu.edu.ng';
    
    console.log(`📧 Checking payment history for: ${email}\n`);
    
    // Find user
    const user = await db.collection('users').findOne({ email });
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return;
    }
    
    console.log(`✅ User found: ${user.name} (${user.email})`);
    console.log(`   Role: ${user.role}`);
    console.log(`   User ID: ${user._id}\n`);
    
    // Check for subscription payments
    console.log(`💰 Checking payment records...`);
    const payments = await db.collection('payments').find({
      $or: [
        { userId: user._id },
        { userId: user._id.toString() },
        { email: user.email }
      ]
    }).sort({ createdAt: -1 }).toArray();
    
    if (payments.length > 0) {
      console.log(`\n✅ Found ${payments.length} payment(s):\n`);
      payments.forEach((payment, index) => {
        console.log(`${index + 1}. Payment - ${payment.reference || 'No reference'}`);
        console.log(`   Amount: ₦${payment.amount?.toLocaleString() || 'N/A'}`);
        console.log(`   Status: ${payment.status || 'Unknown'}`);
        console.log(`   Type: ${payment.type || payment.paymentType || 'Unknown'}`);
        console.log(`   Date: ${payment.createdAt ? new Date(payment.createdAt).toLocaleString() : 'Unknown'}`);
        console.log(`   Plan: ${payment.plan || 'N/A'}`);
        console.log(``);
      });
    } else {
      console.log(`\n❌ No payment records found`);
    }
    
    // Check for subscription records
    console.log(`\n📋 Checking subscription records...`);
    const subscriptions = await db.collection('subscriptions').find({
      $or: [
        { userId: user._id },
        { userId: user._id.toString() },
        { email: user.email }
      ]
    }).sort({ createdAt: -1 }).toArray();
    
    if (subscriptions.length > 0) {
      console.log(`\n✅ Found ${subscriptions.length} subscription(s):\n`);
      subscriptions.forEach((sub, index) => {
        console.log(`${index + 1}. Subscription`);
        console.log(`   Status: ${sub.status || 'Unknown'}`);
        console.log(`   Plan: ${sub.plan || 'Unknown'}`);
        console.log(`   Start: ${sub.startDate ? new Date(sub.startDate).toLocaleString() : 'N/A'}`);
        console.log(`   End: ${sub.endDate ? new Date(sub.endDate).toLocaleString() : 'N/A'}`);
        console.log(``);
      });
    } else {
      console.log(`\n❌ No subscription records found`);
    }
    
    // Check user subscription fields
    console.log(`\n📊 User Subscription Fields:`);
    console.log(`   subscriptionStatus: ${user.subscriptionStatus || 'NOT SET'}`);
    console.log(`   subscriptionPlan: ${user.subscriptionPlan || 'NOT SET'}`);
    console.log(`   subscriptionExpiresAt: ${user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleString() : 'NOT SET'}`);
    console.log(`   subscriptionStartedAt: ${user.subscriptionStartedAt ? new Date(user.subscriptionStartedAt).toLocaleString() : 'NOT SET'}`);
    
    console.log(`\n💡 Analysis:`);
    if (!user.subscriptionStatus && !user.subscriptionExpiresAt) {
      console.log(`   ⚠️  This vendor has NEVER activated a subscription`);
      console.log(`   📝 They created an account but did not complete payment`);
      console.log(`   🎯 They need to:`);
      console.log(`      1. Go to vendor dashboard`);
      console.log(`      2. Click "Subscribe" or "Activate Subscription"`);
      console.log(`      3. Complete payment via Paystack`);
    } else if (user.subscriptionStatus === 'expired') {
      console.log(`   ⚠️  Subscription has expired`);
      console.log(`   🔄 They need to renew their subscription`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkPaymentHistory().catch(console.error);
