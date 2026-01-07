const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/gote-marketplace')
  .then(async () => {
    const db = mongoose.connection.db;
    const vendors = await db.collection('users').find({ role: 'vendor' }).toArray();
    
    console.log('Vendor accounts with all fields:');
    vendors.forEach(v => {
      console.log('\n========================================');
      console.log(`Name: ${v.displayName || v.name}`);
      console.log(`Email: ${v.email}`);
      console.log(`ID: ${v._id}`);
      console.log('\nImage Fields:');
      console.log(`  profileImage: ${v.profileImage || 'NONE'}`);
      console.log(`  logo: ${v.logo || 'NONE'}`);
      console.log(`  avatar: ${v.avatar || 'NONE'}`);
      console.log(`  businessLogo: ${v.businessLogo || 'NONE'}`);
      console.log(`  storeLogo: ${v.storeLogo || 'NONE'}`);
      console.log(`  storeImage: ${v.storeImage || 'NONE'}`);
      console.log(`  image: ${v.image || 'NONE'}`);
      console.log(`  photoURL: ${v.photoURL || 'NONE'}`);
      
      // Show all keys that might be images
      const allKeys = Object.keys(v);
      const imageRelatedKeys = allKeys.filter(k => 
        k.toLowerCase().includes('image') || 
        k.toLowerCase().includes('logo') || 
        k.toLowerCase().includes('photo') ||
        k.toLowerCase().includes('avatar') ||
        k.toLowerCase().includes('picture')
      );
      if (imageRelatedKeys.length > 0) {
        console.log('\nAll image-related fields found:');
        imageRelatedKeys.forEach(key => {
          console.log(`  ${key}: ${v[key]}`);
        });
      }
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
