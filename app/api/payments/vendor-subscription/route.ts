import { NextRequest, NextResponse } from 'next/server'
import { paystackService } from '@/lib/payment'
import connectToDatabase from '@/lib/mongodb'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vendorId, email } = body
    
    console.log('Vendor subscription payment received:', { vendorId, email })

    // Validate required fields
    if (!vendorId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: vendorId and email' },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const db = require('mongoose').connection.db
    
    // Check if vendor exists
    const vendor = await db.collection('users').findOne({ uid: vendorId })
    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      )
    }

    // Generate unique subscription ID
    const subscriptionId = uuidv4()
    
    // Initialize Paystack payment
    const paymentResult = await paystackService.initializePayment({
      email: email,
      amount: 2500, // ₦2,500
      orderId: subscriptionId,
      customerId: vendorId,
      items: [{
        productId: 'vendor-subscription',
        title: 'Monthly Vendor Subscription',
        quantity: 1,
        price: 2500,
        vendorId: 'makeitsell',
        vendorName: 'Make It Sell'
      }]
    })

    console.log('Paystack result for subscription:', paymentResult)

    if (paymentResult.success) {
      // Store subscription attempt for tracking
      await db.collection('subscription_attempts').insertOne({
        subscriptionId,
        vendorId,
        email,
        amount: 2500,
        status: 'pending',
        reference: paymentResult.data?.reference,
        createdAt: new Date()
      })

      return NextResponse.json({
        success: true,
        subscriptionId,
        authorization_url: paymentResult.authUrl,
        reference: paymentResult.data?.reference
      })
    }

    return NextResponse.json(
      { error: paymentResult.message || 'Payment initialization failed' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Subscription payment error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize subscription payment' },
      { status: 500 }
    )
  }
}

// GET endpoint to redirect to payment
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get('vendorId')
    const email = searchParams.get('email')
    
    if (!vendorId || !email) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/vendor/dashboard?error=missing_params`)
    }

    // Initialize payment
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/payments/vendor-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vendorId, email }),
    })

    if (!response.ok) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/vendor/dashboard?error=payment_init_failed`)
    }

    const result = await response.json()
    
    if (result.success && result.authorization_url) {
      return NextResponse.redirect(result.authorization_url)
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/vendor/dashboard?error=payment_failed`)

  } catch (error) {
    console.error('Subscription redirect error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/vendor/dashboard?error=system_error`)
  }
}