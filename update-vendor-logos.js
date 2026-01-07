const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');

mongoose.connect('mongodb://localhost:27017/gote-marketplace')
  .then(async () => {
    const db = mongoose.connection.db;
    
    // Get pending signups with logos
    const pendingSignups = await db.collection('pending_signups').find({ status: 'completed' }).toArray();
    
    console.log('Updating vendor profile images from pending signups...\n');
    
    for (const signup of pendingSignups) {
      const email = signup.signupData?.email;
      const logoUrl = signup.signupData?.storeLogoUrl;
      
      if (!email || !logoUrl || logoUrl === '/placeholder.svg') {
        continue;
      }
      
      // Find user by email
      const user = await db.collection('users').findOne({ email: email.toLowerCase() });
      
      if (user) {
        // Update user with logo
        const result = await db.collection('users').updateOne(
          { _id: user._id },
          { 
            $set: { 
              profileImage: logoUrl,
              logo: logoUrl
            } 
          }
        );
        
        console.log(`✓ Updated ${user.name || email}`);
        console.log(`  Logo: ${logoUrl.substring(0, 70)}...`);
      } else {
        console.log(`✗ User not found for: ${email}`);
      }
    }
    
    console.log('\n========== VERIFICATION ==========');
    const vendors = await db.collection('users').find({ role: 'vendor' }).toArray();
    vendors.forEach(v => {
      console.log(`\n${v.name || v.displayName}`);
      console.log(`  Email: ${v.email}`);
      console.log(`  Logo: ${v.profileImage || v.logo || 'NONE'}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
