// Test the updated API with real database connection
const fetch = require('node-fetch')

async function testRealAPI() {
  try {
    console.log('Testing updated vendors API with real database...\n')
    
    const response = await fetch('http://localhost:3000/api/admin/vendors')
    
    if (!response.ok) {
      console.error('API request failed:', response.status, response.statusText)
      const text = await response.text()
      console.error('Response:', text)
      return
    }
    
    const data = await response.json()
    
    console.log(`Total vendors returned: ${data.vendors?.length || 0}`)
    console.log(`Total subscription revenue: ₦${data.totalRevenue?.toLocaleString() || 0}`)
    
    if (data.vendors && data.vendors.length > 0) {
      console.log('\n=== REAL VENDOR DATA ===')
      data.vendors.forEach((vendor, index) => {
        console.log(`\n${index + 1}. Vendor: ${vendor.name}`)
        console.log(`   Email: ${vendor.email}`) 
        console.log(`   Store: ${vendor.storeName || 'N/A'}`)
        console.log(`   Subscription: ${vendor.subscriptionStatus}`)
        console.log(`   Expiry: ${vendor.subscriptionExpiry || 'N/A'}`)
        console.log(`   Amount: ₦${vendor.subscriptionAmount?.toLocaleString() || 'N/A'}`)
      })
      
      console.log('\n✅ SUCCESS: Now showing REAL vendor data from your MongoDB Atlas database!')
      console.log('🔄 Please refresh your admin panel to see the updated data.')
    } else {
      console.log('⚠️ No vendors found in response')
    }
    
  } catch (error) {
    console.error('Error:', error.message)
    console.log('\n💡 Make sure your Next.js server is running: pnpm dev')
  }
}

testRealAPI()