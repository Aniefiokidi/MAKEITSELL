import { NextRequest, NextResponse } from 'next/server'
import { paystackService } from '@/lib/payment'
import connectToDatabase from '@/lib/mongodb'
import { sendEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reference = searchParams.get('reference')
    
    if (!reference) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/vendor/dashboard?error=no_reference`)
    }

    // Verify payment with Paystack
    const verificationResult = await paystackService.verifyPayment(reference)
    
    if (!verificationResult.success) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/vendor/dashboard?error=verification_failed`)
    }

    const paymentData = verificationResult.data
    const metadata = paymentData.metadata
    
    if (!metadata.orderId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/vendor/dashboard?error=invalid_metadata`)
    }

    await connectToDatabase()
    const db = require('mongoose').connection.db
    
    // Find the subscription attempt
    const subscriptionAttempt = await db.collection('subscription_attempts').findOne({
      subscriptionId: metadata.orderId
    })
    
    if (!subscriptionAttempt) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/vendor/dashboard?error=subscription_not_found`)
    }

    // Calculate new subscription expiry
    const subscriptionExpiry = new Date()
    subscriptionExpiry.setMonth(subscriptionExpiry.getMonth() + 1) // Add 1 month

    // Update or create store with active subscription
    await db.collection('stores').updateOne(
      { vendorId: subscriptionAttempt.vendorId },
      {
        $set: {
          subscriptionStatus: 'active',
          subscriptionExpiry: subscriptionExpiry,
          isActive: true,
          accountStatus: 'active',
          suspendedAt: null,
          warningEmailSent: false,
          lastWarningEmail: null,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    )

    // Update subscription attempt status
    await db.collection('subscription_attempts').updateOne(
      { subscriptionId: metadata.orderId },
      {
        $set: {
          status: 'completed',
          paymentReference: reference,
          completedAt: new Date()
        }
      }
    )

    // Log payment record
    await db.collection('subscription_payments').insertOne({
      vendorId: subscriptionAttempt.vendorId,
      subscriptionId: metadata.orderId,
      reference: reference,
      amount: paymentData.amount / 100, // Convert from kobo to naira
      status: 'completed',
      paymentDate: new Date(paymentData.paid_at),
      subscriptionPeriod: {
        start: new Date(),
        end: subscriptionExpiry
      },
      gateway: 'paystack',
      gatewayResponse: paymentData
    })

    // Send confirmation email
    try {
      await sendEmail(
        subscriptionAttempt.email,
        'Subscription Payment Confirmed - Make It Sell',
        'subscription-confirmed',
        {
          amount: '₦2,500',
          subscriptionPeriod: `${new Date().toLocaleDateString('en-NG')} - ${subscriptionExpiry.toLocaleDateString('en-NG')}`,
          reference: reference
        }
      )
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError)
      // Don't fail the whole process if email fails
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/vendor/subscription-success?reference=${reference}`)

  } catch (error) {
    console.error('Subscription callback error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/vendor/dashboard?error=processing_failed`)
  }
}

// POST endpoint for webhook handling
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature')
    
    if (!signature) {
      return NextResponse.json({ error: 'No signature provided' }, { status: 400 })
    }

    // Verify webhook signature
    const payload = JSON.parse(body)
    const isValid = paystackService.verifyWebhook(payload, signature)
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Handle successful payment webhook
    if (payload.event === 'charge.success') {
      const reference = payload.data.reference
      
      // Process the payment (similar to GET handler above)
      // This ensures webhook processing even if redirect callback fails
      await connectToDatabase()
      const db = require('mongoose').connection.db
      
      const subscriptionAttempt = await db.collection('subscription_attempts').findOne({
        reference: reference
      })
      
      if (subscriptionAttempt && subscriptionAttempt.status === 'pending') {
        // Update subscription similar to GET handler
        const subscriptionExpiry = new Date()
        subscriptionExpiry.setMonth(subscriptionExpiry.getMonth() + 1)

        await db.collection('stores').updateOne(
          { vendorId: subscriptionAttempt.vendorId },
          {
            $set: {
              subscriptionStatus: 'active',
              subscriptionExpiry: subscriptionExpiry,
              isActive: true,
              accountStatus: 'active',
              suspendedAt: null,
              warningEmailSent: false,
              updatedAt: new Date()
            }
          },
          { upsert: true }
        )

        await db.collection('subscription_attempts').updateOne(
          { reference: reference },
          { $set: { status: 'completed', completedAt: new Date() } }
        )
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}