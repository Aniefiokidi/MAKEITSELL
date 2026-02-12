#!/usr/bin/env node

// Simple CLI helper for email verification migration
console.log('\n📧 Email Verification Migration Helper\n');

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
  console.log('Available commands:');
  console.log('');
  console.log('  node migrate-existing-users.js          - Migrate all unverified users');
  console.log('  node migrate-existing-users.js @gmail   - Migrate users with @gmail in email');
  console.log('  node run-migration.js count              - Count unverified users');
  console.log('  node run-migration.js migrate            - Run migration via script');
  console.log('  node run-migration.js test-email         - Test email sending');
  console.log('');
  console.log('Examples:');
  console.log('  node migrate-existing-users.js                    # All users');
  console.log('  node migrate-existing-users.js @company.com       # Specific domain');
  console.log('  node migrate-existing-users.js user@example.com   # Specific user');
  console.log('');
  process.exit(0);
}

const { connectToDatabase } = require('./lib/mongodb');
const { User } = require('./lib/models/User');
const { emailService } = require('./lib/email');

async function countUsers(filter) {
  try {
    await connectToDatabase();
    
    let query = {
      $or: [
        { isEmailVerified: { $exists: false } },
        { isEmailVerified: false }
      ]
    };

    if (filter) {
      query.email = { $regex: filter, $options: 'i' };
    }

    const count = await User.countDocuments(query);
    const sample = await User.find(query, { email: 1, name: 1, createdAt: 1 }).limit(5);

    console.log(`📊 Found ${count} unverified users`);
    
    if (sample.length > 0) {
      console.log('\nSample users:');
      sample.forEach(user => {
        console.log(`  - ${user.email} (${user.name || 'No name'}) - ${new Date(user.createdAt).toLocaleDateString()}`);
      });
    }

    if (count > 5) {
      console.log(`  ... and ${count - 5} more`);
    }

    console.log('\nTo migrate these users, run:');
    console.log(filter ? 
      `  node migrate-existing-users.js "${filter}"` : 
      '  node migrate-existing-users.js'
    );

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testEmail() {
  try {
    console.log('🧪 Testing email service...');
    
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    console.log(`Sending test email to: ${testEmail}`);

    const success = await emailService.sendEmailVerification({
      email: testEmail,
      name: 'Test User',
      verificationUrl: 'https://www.makeitsell.org/verify-email?token=test-token'
    });

    if (success) {
      console.log('✅ Test email sent successfully!');
    } else {
      console.log('❌ Test email failed to send');
    }

  } catch (error) {
    console.error('❌ Email test failed:', error.message);
  }
}

async function runMigration(filter) {
  console.log('🚀 Starting migration...');
  console.log('⚠️  This will send emails to unverified users');
  console.log('');

  // Simple confirmation
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Are you sure you want to continue? (yes/no): ', (answer) => {
    rl.close();
    
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      // Run the existing migration script
      const { spawn } = require('child_process');
      const args = filter ? ['migrate-existing-users.js', filter] : ['migrate-existing-users.js'];
      const child = spawn('node', args, { stdio: 'inherit' });
      
      child.on('close', (code) => {
        process.exit(code);
      });
    } else {
      console.log('Migration cancelled.');
      process.exit(0);
    }
  });
}

// Handle commands
switch (command) {
  case 'count':
    countUsers(args[1])
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    break;

  case 'migrate':
    runMigration(args[1]);
    break;

  case 'test-email':
    testEmail()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    break;

  default:
    console.log(`❌ Unknown command: ${command}`);
    console.log('Run "node run-migration.js help" for available commands');
    process.exit(1);
}