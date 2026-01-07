const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/gote-marketplace')
  .then(async () => {
    const db = mongoose.connection.db;
    
    // Check pending signups for logo URLs
    const pendingSignups = await db.collection('pending_signups').find({}).toArray();
    
    console.log('Pending Signups with Logo URLs:');
    pendingSignups.forEach(p => {
      console.log('\n========================================');
      console.log(`Email: ${p.signupData?.email}`);
      console.log(`Store Name: ${p.signupData?.storeName}`);
      console.log(`Store Logo URL: ${p.signupData?.storeLogoUrl || 'NONE'}`);
      console.log(`Status: ${p.status}`);
      console.log(`Signup ID: ${p.signupId}`);
    });
    
    // Check for Mr Wave, Mr Yati, Mr JLC specifically
    const mrWave = pendingSignups.find(p => p.signupData?.email === 'arnoldeee123+test11@gmail.com');
    const mrYati = pendingSignups.find(p => p.signupData?.email === 'arnoldeee123+test12@gmail.com');
    const mrJLC = pendingSignups.find(p => p.signupData?.email === 'arnoldeee123+test13@gmail.com');
    
    console.log('\n\n========== SPECIFIC VENDORS ==========');
    if (mrWave) {
      console.log('\nMr Wave Logo:', mrWave.signupData?.storeLogoUrl);
    } else {
      console.log('\nMr Wave: NOT FOUND in pending_signups');
    }
    
    if (mrYati) {
      console.log('Mr Yati Logo:', mrYati.signupData?.storeLogoUrl);
    } else {
      console.log('Mr Yati: NOT FOUND in pending_signups');
    }
    
    if (mrJLC) {
      console.log('Mr JLC Logo:', mrJLC.signupData?.storeLogoUrl);
    } else {
      console.log('Mr JLC: NOT FOUND in pending_signups');
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
