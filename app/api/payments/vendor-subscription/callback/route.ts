import { NextRequest, NextResponse } from 'next/server'
import { paystackService } from '@/lib/payment'
import connectToDatabase from '@/lib/mongodb'
import { sendEmail } from '@/lib/email'
import { SubscriptionManagementService } from '@/lib/subscription-management'

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

    // Calculate new subscription expiry and process renewal using management service
    const renewalResult = await SubscriptionManagementService.processSubscriptionRenewal(
      subscriptionAttempt.vendorId,
      {
        reference: reference,
        amount: paymentData.amount / 100,
        paymentDate: paymentData.paid_at
      }
    )

    // Update subscription attempt status
    await db.collection('subscription_attempts').updateOne(
      { subscriptionId: metadata.orderId },
      {
        $set: {
          status: 'completed',
          paymentReference: reference,
          completedAt: new Date(),
          paymentVerified: true
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
        end: renewalResult.newExpiryDate
      },
      gateway: 'paystack',
      gatewayResponse: paymentData,
      type: 'renewal'
    })

    // Email confirmation is now handled by SubscriptionManagementService
    // No need for manual email sending here

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

    // Handle subscription webhook events
    const event = payload.event
    const eventData = payload.data

    console.log('Subscription webhook received:', event)

    switch (event) {
      case 'charge.success':
        // Handle successful subscription renewal
        const reference = eventData.reference
        if (reference) {
          const subscriptionAttempt = await db.collection('subscription_attempts').findOne({
            reference: reference,
            status: 'pending'
          })

          if (subscriptionAttempt) {
            await SubscriptionManagementService.processSubscriptionRenewal(
              subscriptionAttempt.vendorId,
              {
                reference: reference,
                amount: eventData.amount / 100,
                paymentDate: eventData.paid_at
              }
            )

            await db.collection('subscription_attempts').updateOne(
              { reference: reference },
              { $set: { status: 'completed', completedAt: new Date() } }
            )
          }
        }
        break

      case 'charge.failed':
        // Handle failed subscription renewal
        const failedReference = eventData.reference
        if (failedReference) {
          const subscriptionAttempt = await db.collection('subscription_attempts').findOne({
            reference: failedReference,
            status: 'pending'
          })

          if (subscriptionAttempt) {
            const reason = eventData.gateway_response || 'Insufficient funds or payment method issue'
            
            await SubscriptionManagementService.processFailedRenewal(
              subscriptionAttempt.vendorId,
              reason
            )

            await db.collection('subscription_attempts').updateOne(
              { reference: failedReference },
              { 
                $set: { 
                  status: 'failed', 
                  failedAt: new Date(),
                  failureReason: reason
                } 
              }
            )
          }
        }
        break

      case 'subscription.create':
        console.log('New subscription created:', eventData.subscription_code)
        break

      case 'subscription.disable':
        console.log('Subscription disabled:', eventData.subscription_code)
        break
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