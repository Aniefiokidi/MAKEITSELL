// API route for testing email functionality
import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/email'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing email configuration...')
    
    // Test order data
    const testOrderData = {
      orderId: 'TEST_' + Date.now().toString(),
      customerName: 'John Doe',
      customerEmail: 'customer@example.com', // Replace with your test email
      vendorName: 'Test Store',
      vendorEmail: 'vendor@example.com', // Replace with your test email
      items: [
        {
          title: 'Sample Product',
          price: 10000,
          quantity: 2,
          images: ['https://via.placeholder.com/100'],
          sku: 'SAMPLE001'
        }
      ],
      total: 20000,
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'customer@example.com',
        address: '123 Test Street',
        city: 'Lagos',
        state: 'Lagos',
        zipCode: '100001',
        country: 'Nigeria',
        phone: '+234 123 456 7890'
      }
    }

    console.log('📧 Attempting to send test emails...')
    console.log('SMTP Config:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      from: process.env.SMTP_FROM_EMAIL
    })

    const result = await emailService.sendOrderConfirmationEmails(testOrderData)
    
    if (result) {
      return NextResponse.json({ 
        success: true,
        message: 'Test emails sent successfully!',
        config: {
          from: process.env.SMTP_FROM_EMAIL,
          host: process.env.SMTP_HOST
        }
      })
    } else {
      return NextResponse.json({ 
        success: false,
        message: 'Failed to send test emails',
        config: {
          from: process.env.SMTP_FROM_EMAIL,
          host: process.env.SMTP_HOST
        }
      }, { status: 500 })
    }
    
  } catch (error: any) {
    console.error('Email test error:', error)
    
    return NextResponse.json({ 
      success: false,
      message: 'Email test failed',
      error: error.message,
      suggestions: [
        'Check if SMTP credentials are correct',
        'Verify SMTP host settings',
        'Ensure firewall allows SMTP connections',
        'Try alternative NameCheap SMTP settings'
      ]
    }, { status: 500 })
  }
}