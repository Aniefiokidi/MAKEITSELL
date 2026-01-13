#!/usr/bin/env node

const mongoose = require('mongoose');
const crypto = require('crypto');

// Connect to MongoDB
async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/makeittsell';
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // User schema
    const userSchema = new mongoose.Schema({
      email: { type: String, unique: true },
      passwordHash: String,
      name: String,
      role: { type: String, default: 'customer' },
      vendorInfo: Object,
      sessionToken: String,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    });

    const User = mongoose.models.User || mongoose.model('User', userSchema);

    function hashPassword(password) {
      return crypto.createHash('sha256').update(password).digest('hex');
    }

    // Find users with undefined passwordHash
    const usersWithoutHash = await User.find({ passwordHash: { $exists: false } });
    console.log(`Found ${usersWithoutHash.length} users without password hash`);

    if (usersWithoutHash.length === 0) {
      console.log('No users need to be fixed');
      await mongoose.connection.close();
      return;
    }

    // For each user, generate a temporary password and hash
    for (const user of usersWithoutHash) {
      // Generate a temporary password (6 random words would be better in production)
      const tempPassword = crypto.randomBytes(8).toString('hex');
      const passwordHash = hashPassword(tempPassword);

      user.passwordHash = passwordHash;
      await user.save();

      console.log(`Fixed user ${user.email} - Temporary password: ${tempPassword}`);
      console.log(`  Please use "Forgot Password" feature or contact the user to set a new password`);
    }

    console.log(`\nFixed ${usersWithoutHash.length} users`);
    console.log('Users will need to use the "Forgot Password" feature to set their own password');

    await mongoose.connection.close();
    console.log('Migration complete');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

main();
