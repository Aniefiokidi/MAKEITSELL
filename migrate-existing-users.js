// Migration script to send verification emails to existing users
const path = require('path');

// Add the project root to the module path
const projectRoot = __dirname;
process.env.NODE_PATH = process.env.NODE_PATH ? `${process.env.NODE_PATH}:${projectRoot}` : projectRoot;
require('module')._initPaths();

// Set up environment for Next.js compatibility
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

async function loadModules() {
  try {
    // Try different import paths
    let connectToDatabase, User, emailService;
    
    try {
      const mongodb = require('./lib/mongodb');
      connectToDatabase = mongodb.connectToDatabase || mongodb.default;
    } catch (e) {
      console.log('Could not load mongodb module:', e.message);
      throw new Error('Failed to load database connection');
    }

    try {
      const userModel = require('./lib/models/User');
      User = userModel.User || userModel.default;
    } catch (e) {
      console.log('Could not load User model:', e.message);
      throw new Error('Failed to load User model');
    }

    try {
      const email = require('./lib/email');
      emailService = email.emailService || email.default;
    } catch (e) {
      console.log('Could not load email service:', e.message);
      throw new Error('Failed to load email service');
    }

    return { connectToDatabase, User, emailService };
  } catch (error) {
    console.error('❌ Module loading failed:', error.message);
    console.error('');
    console.error('This script needs to be run from the project root directory.');
    console.error('Make sure you are in the MakeItSell directory and try again.');
    console.error('');
    console.error('Alternative: Use the Next.js dev server API endpoints instead:');
    console.error('1. Start dev server: npm run dev');
    console.error('2. Visit: http://localhost:3000/admin/migrate-users');
    throw error;
  }
}

async function migrateExistingUsers() {
  console.log('\n🔄 Starting migration for existing users...\n');
  
  try {
    console.log('📦 Loading required modules...');
    const { connectToDatabase, User, emailService } = await loadModules();
    const crypto = require('crypto');

    await connectToDatabase();
    console.log('✅ Connected to database');

    // Find all users who don't have email verification set (existing users)
    const unverifiedUsers = await User.find({
      $or: [
        { isEmailVerified: { $exists: false } },
        { isEmailVerified: false }
      ]
    });

    console.log(`📊 Found ${unverifiedUsers.length} unverified users`);

    if (unverifiedUsers.length === 0) {
      console.log('✅ No unverified users found - all users are already verified!');
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const failedEmails = [];

    console.log('\n📧 Sending verification emails...\n');

    for (let i = 0; i < unverifiedUsers.length; i++) {
      const user = unverifiedUsers[i];
      
      try {
        // Generate verification token
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Update user with verification fields
        user.isEmailVerified = false; // Explicitly set to false
        user.emailVerificationToken = emailVerificationToken;
        user.emailVerificationTokenExpiry = emailVerificationTokenExpiry;
        user.updatedAt = new Date();
        
        await user.save();

        // Send verification email
        const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/verify-email?token=${emailVerificationToken}`;
        
        const emailSent = await emailService.sendEmailVerification({
          email: user.email,
          name: user.name || user.displayName || 'User',
          verificationUrl
        });

        if (emailSent) {
          console.log(`✅ ${i + 1}/${unverifiedUsers.length} - Sent to: ${user.email}`);
          successCount++;
        } else {
          console.log(`❌ ${i + 1}/${unverifiedUsers.length} - Failed to send to: ${user.email}`);
          failCount++;
          failedEmails.push(user.email);
        }

        // Add small delay to avoid overwhelming email service
        if (i < unverifiedUsers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }

      } catch (error) {
        console.log(`❌ ${i + 1}/${unverifiedUsers.length} - Error for ${user.email}: ${error.message}`);
        failCount++;
        failedEmails.push(user.email);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully sent: ${successCount} emails`);
    console.log(`❌ Failed to send: ${failCount} emails`);
    
    if (failedEmails.length > 0) {
      console.log('\n❌ Failed emails:');
      failedEmails.forEach(email => console.log(`  - ${email}`));
    }

    console.log('\n🎉 Migration completed!');
    console.log('\nNext steps:');
    console.log('1. Check your email server logs for any delivery issues');
    console.log('2. Monitor user feedback about verification emails');
    console.log('3. Users can now verify their accounts and sign in normally');
    console.log('4. Consider sending a follow-up email in 24-48 hours for unverified users');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Allow running with specific email filter
async function migrateSpecificUsers(emailFilter) {
  console.log(`\n🔄 Starting targeted migration for emails containing: "${emailFilter}"\n`);
  
  try {
    console.log('📦 Loading required modules...');
    const { connectToDatabase, User, emailService } = await loadModules();
    const crypto = require('crypto');

    await connectToDatabase();
    console.log('✅ Connected to database');

    // Find specific users
    const users = await User.find({
      email: { $regex: emailFilter, $options: 'i' },
      $or: [
        { isEmailVerified: { $exists: false } },
        { isEmailVerified: false }
      ]
    });

    console.log(`📊 Found ${users.length} matching unverified users`);

    if (users.length === 0) {
      console.log('✅ No matching unverified users found!');
      return;
    }

    // Process users (same logic as above)
    for (const user of users) {
      try {
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        user.isEmailVerified = false;
        user.emailVerificationToken = emailVerificationToken;
        user.emailVerificationTokenExpiry = emailVerificationTokenExpiry;
        user.updatedAt = new Date();
        
        await user.save();

        const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/verify-email?token=${emailVerificationToken}`;
        
        const emailSent = await emailService.sendEmailVerification({
          email: user.email,
          name: user.name || user.displayName || 'User',
          verificationUrl
        });

        console.log(`${emailSent ? '✅' : '❌'} ${user.email}`);
        
        if (!emailSent) {
          console.log(`❌ Failed to send verification email to: ${user.email}`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.log(`❌ Error for ${user.email}: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Targeted migration failed:', error.message);
  }
}

// Command line interface
const args = process.argv.slice(2);

if (args.length > 0) {
  const emailFilter = args[0];
  migrateSpecificUsers(emailFilter)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  migrateExistingUsers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}