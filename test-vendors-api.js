const fetch = require('node-fetch');

async function testVendorsAPI() {
  try {
    console.log('Testing Admin Vendors API...\n');

    const response = await fetch('http://localhost:3000/api/admin/vendors');
    const data = await response.json();

    if (data.success) {
      console.log(`✅ API call successful - Found ${data.vendors.length} vendors\n`);
      
      console.log('=== VENDOR SUBSCRIPTION STATUS ===');
      data.vendors.forEach(vendor => {
        const expiryDate = vendor.subscriptionExpiry ? new Date(vendor.subscriptionExpiry) : null;
        const now = new Date();
        let status = 'N/A';
        let color = 'gray';
        
        if (expiryDate) {
          if (expiryDate < now) {
            status = 'EXPIRED';
            color = 'red';
          } else if (expiryDate < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
            status = 'EXPIRING SOON';
            color = 'orange';
          } else {
            status = 'ACTIVE';
            color = 'green';
          }
        }

        console.log(`📊 ${vendor.storeName || 'N/A'} (${vendor.name})`);
        console.log(`   📧 ${vendor.email}`);
        console.log(`   📅 Expires: ${expiryDate ? expiryDate.toLocaleDateString() : 'N/A'} (${status})`);
        console.log(`   🏪 Status: ${vendor.status}`);
        console.log(`   📈 Subscription: ${vendor.subscriptionStatus || 'unknown'}`);
        console.log('');
      });
      
      // Count by status
      const totalVendors = data.vendors.length;
      const withExpiry = data.vendors.filter(v => v.subscriptionExpiry).length;
      const expired = data.vendors.filter(v => 
        v.subscriptionExpiry && new Date(v.subscriptionExpiry) < new Date()
      ).length;
      const expiringSoon = data.vendors.filter(v => {
        if (!v.subscriptionExpiry) return false;
        const expiry = new Date(v.subscriptionExpiry);
        const now = new Date();
        const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        return expiry >= now && expiry <= weekFromNow;
      }).length;
      
      console.log('=== SUMMARY ===');
      console.log(`Total vendors: ${totalVendors}`);
      console.log(`With subscription data: ${withExpiry}`);
      console.log(`Expired: ${expired}`);
      console.log(`Expiring within 7 days: ${expiringSoon}`);
      console.log(`Active: ${withExpiry - expired - expiringSoon}`);
      
    } else {
      console.error('❌ API call failed:', data.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testVendorsAPI();