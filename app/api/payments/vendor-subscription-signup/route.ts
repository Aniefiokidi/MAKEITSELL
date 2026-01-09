import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { paystackService } from '@/lib/payment'
import connectToDatabase from '@/lib/mongodb'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, signupData } = body
    
    console.log('Vendor signup payment received:', { email })

    // Validate required fields
    if (!email || !signupData) {
      return NextResponse.json(
        { error: 'Missing required fields: email and signupData' },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const db = require('mongoose').connection.db
    
    // Check if email is already in use
    const existingUser = await db.collection('users').findOne({ email })
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 400 }
      )
    }

    // Generate unique signup ID
    const signupId = uuidv4()
    
    // Store pending signup data temporarily
    await db.collection('pending_signups').insertOne({
      signupId,
      email,
      signupData,
      status: 'pending_payment',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // Expires in 30 minutes
    })

    // Initialize Paystack payment
    const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).trim()
    const paymentResult = await paystackService.initializePayment({
      email: email,
      amount: 2500, // ₦2,500
      orderId: signupId,
      customerId: signupId, // Use signup ID as customer ID since no user exists yet
      callbackUrl: `${origin}/api/payments/vendor-subscription-signup/callback`,
      items: [{
        productId: 'vendor-subscription-signup',
        title: 'Vendor Account Setup + Monthly Subscription',
        quantity: 1,
        price: 2500,
        vendorId: 'makeitsell',
        vendorName: 'Make It Sell'
      }]
    })

    console.log('Paystack result for signup payment:', paymentResult)

    if (paymentResult.success) {
      // Update pending signup with payment reference
      await db.collection('pending_signups').updateOne(
        { signupId },
        {
          $set: {
            paymentReference: paymentResult.data?.reference,
            status: 'payment_initiated'
          }
        }
      )

      return NextResponse.json({
        success: true,
        signupId,
        authorization_url: paymentResult.authUrl,
        reference: paymentResult.data?.reference
      })
    }

    return NextResponse.json(
      { error: paymentResult.message || 'Payment initialization failed' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Signup payment error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize signup payment' },
      { status: 500 }
    )
  }
}