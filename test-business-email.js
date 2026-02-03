// Test email functionality using Next.js environment
const { emailService } = require('./lib/email.ts');

async function testEmailWithBusinessEmail() {
  console.log('🧪 Testing Make It Sell Email Configuration...\n');

  // Test order data
  const testOrderData = {
    orderId: 'TEST_' + Date.now().toString(),
    customerName: 'Test Customer',
    customerEmail: 'customer@example.com',
    vendorName: 'Test Vendor',
    vendorEmail: 'vendor@example.com',
    items: [
      {
        title: 'Test Product',
        price: 5000,
        quantity: 1,
        images: ['https://via.placeholder.com/100'],
        sku: 'TST001'
      }
    ],
    total: 5000,
    shippingAddress: {
      firstName: 'Test',
      lastName: 'Customer',
      email: 'customer@example.com',
      address: '123 Test Street',
      city: 'Lagos',
      state: 'Lagos',
      zipCode: '100001',
      country: 'Nigeria',
      phone: '+234 123 456 7890'
    }
  };

  try {
    console.log('📧 Sending test order confirmation emails...');
    console.log('From:', process.env.SMTP_FROM_EMAIL || 'Not configured');
    console.log('SMTP Host:', process.env.SMTP_HOST || 'Not configured');
    
    const result = await emailService.sendOrderConfirmationEmails(testOrderData);
    
    if (result) {
      console.log('✅ Email test SUCCESSFUL!');
      console.log('✅ Customer and vendor notification emails sent successfully');
      console.log('\n🎯 Your email system is now ready for production!');
    } else {
      console.log('❌ Email test FAILED');
      console.log('Check your email configuration in .env.local');
    }
  } catch (error) {
    console.error('❌ Email test error:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Verify your SMTP credentials are correct');
    console.log('2. Check if your hosting provider allows SMTP on port 587');
    console.log('3. Ensure firewall/security settings allow outbound SMTP');
  }
}

// For NameCheap business email, we might need different SMTP settings
console.log('🔧 If the current settings don\'t work, try these alternatives:');
console.log('');
console.log('NameCheap Business Email Alternative Settings:');
console.log('SMTP_HOST=smtp.privateemail.com (for NameCheap Business Email)');
console.log('or');
console.log('SMTP_HOST=mail.makeitsell.org (if using cPanel)');
console.log('');

testEmailWithBusinessEmail();