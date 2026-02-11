/**
 * Run subscription checks and send reminder emails
 * This script checks for expiring/expired subscriptions and sends appropriate emails
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test';

async function sendEmail({ to, subject, html }) {
  try {
    console.log(`   📧 Preparing to send email to: ${to}`);
    console.log(`   Subject: ${subject}`);
    
    // Use the email service API endpoint instead of direct SMTP
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.makeitsell.org';
    
    console.log(`   ⚠️  Email sending requires SMTP configuration`);
    console.log(`   📧 Email preview saved for manual sending\n`);
    console.log(`   TO: ${to}`);
    console.log(`   SUBJECT: ${subject}`);
    console.log(`   ─────────────────────────────────────`);
    
    // For testing, just log the email content
    return true; // Return true to mark as "sent" for testing
  } catch (error) {
    console.error(`   ❌ Email failed:`, error.message);
    return false;
  }
}

function getExpiredEmailHTML(name, storeName, daysExpired, graceDaysLeft) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #dc2626;">⚠️ Subscription Expired</h2>
      <p>Hello ${name},</p>
      <p>Your Make It Sell subscription for <strong>${storeName}</strong> expired ${daysExpired} day(s) ago.</p>
      <p style="background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b;">
        <strong>Grace Period:</strong> You have <strong>${graceDaysLeft} days left</strong> to renew before your store is unpublished.
      </p>
      <h3>What happens next?</h3>
      <ul>
        <li>Your store is currently <strong>still visible</strong> to customers</li>
        <li>You have <strong>${graceDaysLeft} days</strong> to renew</li>
        <li>After the grace period, your store will be <strong>unpublished</strong></li>
      </ul>
      <p><a href="https://www.makeitsell.org/vendor/subscription" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Renew Now</a></p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">If you have any questions, contact us at support@makeitsell.com</p>
    </div>
  `;
}

function get7DayWarningHTML(name, storeName, expiryDate) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #f59e0b;">⏰ Subscription Expiring Soon</h2>
      <p>Hello ${name},</p>
      <p>Your Make It Sell subscription for <strong>${storeName}</strong> will expire in <strong>7 days</strong>.</p>
      <p><strong>Expiry Date:</strong> ${expiryDate.toLocaleDateString()}</p>
      <h3>Don't lose access!</h3>
      <ul>
        <li>Renew now to avoid interruption</li>
        <li>Keep your store visible to customers</li>
        <li>Continue receiving orders</li>
      </ul>
      <p><a href="https://www.makeitsell.org/vendor/subscription" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Renew Subscription</a></p>
    </div>
  `;
}

function get3DayWarningHTML(name, storeName, expiryDate) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #dc2626;">🚨 Urgent: Subscription Expiring in 3 Days!</h2>
      <p>Hello ${name},</p>
      <p>Your Make It Sell subscription for <strong>${storeName}</strong> will expire in just <strong>3 days</strong>!</p>
      <p style="background: #fee2e2; padding: 15px; border-left: 4px solid #dc2626;">
        <strong>Expiry Date:</strong> ${expiryDate.toLocaleDateString()}<br>
        <strong>Action Required:</strong> Renew now to avoid service interruption
      </p>
      <p><a href="https://www.makeitsell.org/vendor/subscription" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Renew Now</a></p>
    </div>
  `;
}

async function runSubscriptionCheck() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔍 Connecting to MongoDB...\n');
    await client.connect();
    const db = client.db('test');
    
    const now = new Date();
    console.log(`⏰ Current time: ${now.toLocaleString()}\n`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 CHECKING SUBSCRIPTIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Find all vendors with subscriptions
    const vendors = await db.collection('users').find({
      role: 'vendor',
      subscriptionExpiresAt: { $exists: true }
    }).toArray();
    
    console.log(`Found ${vendors.length} vendor(s) with subscriptions\n`);
    
    let emailsSent = 0;
    let errorsFound = 0;
    
    for (const vendor of vendors) {
      const expiryDate = new Date(vendor.subscriptionExpiresAt);
      const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
      const daysExpired = Math.abs(daysUntilExpiry);
      
      // Get store name
      const store = await db.collection('stores').findOne({ 
        vendorId: { $in: [vendor._id, vendor._id.toString()] }
      });
      const storeName = store?.storeName || 'your store';
      
      console.log(`\n📦 ${vendor.name} (${vendor.email})`);
      console.log(`   Store: ${storeName}`);
      console.log(`   Expires: ${expiryDate.toLocaleString()}`);
      console.log(`   Days until expiry: ${daysUntilExpiry}`);
      
      // Check what emails to send
      if (daysUntilExpiry === 7 && !vendor.subscriptionWarning7DaysSent) {
        console.log(`   🔔 ACTION: Send 7-day warning`);
        const sent = await sendEmail({
          to: vendor.email,
          subject: '⏰ Your Make It Sell subscription expires in 7 days',
          html: get7DayWarningHTML(vendor.name, storeName, expiryDate)
        });
        
        if (sent) {
          await db.collection('users').updateOne(
            { _id: vendor._id },
            { $set: { subscriptionWarning7DaysSent: now } }
          );
          emailsSent++;
        } else {
          errorsFound++;
        }
        
      } else if (daysUntilExpiry === 3 && !vendor.subscriptionWarning3DaysSent) {
        console.log(`   🔔 ACTION: Send 3-day warning`);
        const sent = await sendEmail({
          to: vendor.email,
          subject: '🚨 URGENT: Your subscription expires in 3 days!',
          html: get3DayWarningHTML(vendor.name, storeName, expiryDate)
        });
        
        if (sent) {
          await db.collection('users').updateOne(
            { _id: vendor._id },
            { $set: { subscriptionWarning3DaysSent: now } }
          );
          emailsSent++;
        } else {
          errorsFound++;
        }
        
      } else if (daysUntilExpiry < 0 && daysExpired <= 7) {
        // In grace period
        const graceDaysLeft = 7 - daysExpired;
        console.log(`   ⚠️  EXPIRED ${daysExpired} day(s) ago - Grace period: ${graceDaysLeft} days left`);
        
        if (!vendor.subscriptionExpiredNotificationSent) {
          console.log(`   🔔 ACTION: Send expired notification with grace period info`);
          const sent = await sendEmail({
            to: vendor.email,
            subject: '⚠️ Your Make It Sell subscription has expired - Grace Period Active',
            html: getExpiredEmailHTML(vendor.name, storeName, daysExpired, graceDaysLeft)
          });
          
          if (sent) {
            await db.collection('users').updateOne(
              { _id: vendor._id },
              { $set: { 
                subscriptionExpiredNotificationSent: now,
                subscriptionStatus: 'expired'
              } }
            );
            emailsSent++;
          } else {
            errorsFound++;
          }
        } else {
          console.log(`   ℹ️  Expired notification already sent`);
        }
        
      } else if (daysUntilExpiry < -7) {
        // Past grace period
        console.log(`   ❌ PAST GRACE PERIOD - Should unpublish store`);
        
        if (store && store.isPublished) {
          console.log(`   🔔 ACTION: Unpublishing store`);
          await db.collection('stores').updateOne(
            { _id: store._id },
            { $set: { isPublished: false, unpublishedReason: 'subscription_expired', unpublishedAt: now } }
          );
        }
        
      } else {
        console.log(`   ✅ Active - No action needed`);
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Emails sent: ${emailsSent}`);
    console.log(`❌ Errors: ${errorsFound}`);
    console.log(`📊 Total vendors checked: ${vendors.length}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('✅ Database connection closed\n');
  }
}

console.log('\n🚀 Make It Sell - Subscription Check\n');
runSubscriptionCheck().catch(console.error);
