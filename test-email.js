// This file can be used to test email functionality
// Run this with: node test-email.js

require('dotenv').config({ path: '.env.local' });
const { emailService } = require('./lib/email');

async function testEmail() {
  // Mock order data for testing
  const orderData = {
    customerEmail: 'customer@example.com',
    vendorEmail: 'vendor@example.com',
    orderId: 'TEST-' + Date.now(),
    customerName: 'John Doe',
    vendorName: 'Amazing Store',
    items: [
      {
        title: 'Test Product',
        price: 15000,
        quantity: 2,
        images: ['https://via.placeholder.com/300'],
        sku: 'TEST-001'
      },
      {
        title: 'Another Product',
        price: 25000,
        quantity: 1,
        images: ['https://via.placeholder.com/300'],
        sku: 'TEST-002'
      }
    ],
    total: 55000,
    shippingAddress: {
      firstName: 'John',
      lastName: 'Doe',
      address: '123 Test Street',
      city: 'Lagos',
      state: 'Lagos State',
      zipCode: '100001',
      country: 'Nigeria',
      phone: '+234 123 456 7890'
    }
  };

  try {
    console.log('Testing email functionality...');
    console.log('Order data:', JSON.stringify(orderData, null, 2));
    
    const result = await emailService.sendOrderConfirmationEmails(orderData);
    
    if (result) {
      console.log('✅ Email test successful!');
    } else {
      console.log('❌ Email test failed');
    }
  } catch (error) {
    console.error('Email test error:', error);
  }
}

testEmail();