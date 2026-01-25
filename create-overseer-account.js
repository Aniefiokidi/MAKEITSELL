const mongoose = require('mongoose');
const crypto = require('crypto');

// Use the actual MongoDB connection string
const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test";

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function createOverseerAccount() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const email = 'makeitsell@gmail.com';
    const password = '123456';
    const passwordHash = hashPassword(password);
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Check if user already exists
    const existing = await usersCollection.findOne({ email });
    if (existing) {
      console.log('⚠️  User already exists. Updating account...');
      await usersCollection.updateOne(
        { email },
        {
          $set: {
            passwordHash,
            role: 'admin',
            name: 'Overseer',
            displayName: 'Make It Sell Overseer',
            sessionToken,
            updatedAt: new Date()
          }
        }
      );
      console.log('✅ Account updated successfully');
    } else {
      console.log('Creating new overseer account...');
      await usersCollection.insertOne({
        email,
        passwordHash,
        role: 'admin',
        name: 'Overseer',
        displayName: 'Make It Sell Overseer',
        sessionToken,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Account created successfully');
    }

    console.log('\n📋 Account Details:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: admin`);
    console.log(`   Session Token: ${sessionToken.substring(0, 16)}...`);

    await mongoose.connection.close();
    console.log('\n✅ Done! You can now log in with the credentials above.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createOverseerAccount();
