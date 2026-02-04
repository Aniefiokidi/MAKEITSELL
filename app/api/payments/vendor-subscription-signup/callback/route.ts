import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { paystackService } from '@/lib/payment'
import connectToDatabase from '@/lib/mongodb'
import { sendEmail } from '@/lib/email'
import { signUp as mongoSignUp } from '@/lib/mongodb-auth'
import { createStore, createService } from '@/lib/database-client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reference = searchParams.get('reference')
    
    if (!reference) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/signup?error=no_reference`)
    }

    console.log('Processing signup payment callback for reference:', reference)

    // Verify payment with Paystack
    const verificationResult = await paystackService.verifyPayment(reference)
    
    if (!verificationResult.success) {
      console.error('Payment verification failed:', verificationResult)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/signup?error=verification_failed`)
    }

    const paymentData = verificationResult.data
    const metadata = paymentData.metadata
    
    if (!metadata.orderId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/signup?error=invalid_metadata`)
    }

    await connectToDatabase()
    const db = require('mongoose').connection.db
    
    // Find the pending signup
    const pendingSignup = await db.collection('pending_signups').findOne({
      signupId: metadata.orderId
    })
    
    if (!pendingSignup) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/signup?error=signup_not_found`)
    }

    if (pendingSignup.status === 'completed') {
      // Already processed, redirect to success
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/vendor/dashboard?signup_success=true`)
    }

    const signupData = pendingSignup.signupData

    console.log('Creating vendor account after successful payment:', signupData.email)

    // Create user account now that payment is successful
    const userResult = await mongoSignUp({
      email: signupData.email,
      password: signupData.password,
      name: signupData.displayName,
      role: 'vendor',
      vendorInfo: {
        businessName: signupData.storeName,
        businessType: signupData.vendorType || 'both'
      }
    })

    if (!userResult.success) {
      console.error('Failed to create user account:', userResult.error)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/signup?error=account_creation_failed`)
    }

    const userId = userResult.user.id

    // Update user with profile image if logo was uploaded
    if (signupData.storeLogoUrl && signupData.storeLogoUrl !== "/placeholder.svg") {
      await db.collection('users').updateOne(
        { _id: new (require('mongodb').ObjectId)(userId) },
        { 
          $set: { 
            profileImage: signupData.storeLogoUrl,
            logo: signupData.storeLogoUrl
          } 
        }
      )
      console.log('Updated user profile image:', signupData.storeLogoUrl)
    }

    // Calculate subscription expiry (1 month from now)
    const subscriptionExpiry = new Date()
    subscriptionExpiry.setMonth(subscriptionExpiry.getMonth() + 1)

    // Extract city from location or address
    const storeCity = signupData.storeCity || signupData.storeAddress?.split(',')[0] || 'Lagos'

    // Create store with active subscription
    const storeData = {
      vendorId: userId,
      storeName: signupData.storeName,
      storeDescription: signupData.storeDescription,
      storeImage: signupData.storeLogoUrl || "/placeholder.svg",
      logoImage: signupData.storeLogoUrl || "/placeholder.svg",
      category: signupData.storeCategory, // Fixed: was signupData.category
      address: signupData.storeAddress, // Fixed: was signupData.address
      city: storeCity || signupData.storeCity || signupData.storeAddress,
      location: signupData.storeAddress, // Fixed: was signupData.address
      phone: signupData.storePhone || '',
      email: signupData.email,
      reviewCount: 0,
      productCount: 0,
      isOpen: true,
      deliveryTime: "1-3 days",
      deliveryFee: 0,
      minimumOrder: 0,
      // Subscription fields
      subscriptionStatus: 'active',
      subscriptionExpiry: subscriptionExpiry,
      isActive: true,
      accountStatus: 'active',
      suspendedAt: null,
      warningEmailSent: false,
      lastWarningEmail: null
    }

    try {
      await createStore(storeData)
      console.log('Store created successfully for vendor:', userId)
    } catch (storeError) {
      console.error('Failed to create store:', storeError)
      // Continue even if store creation fails - user can create it later
    }

    // If vendor also offers services, create service profile
    if (signupData.vendorType === "services" || signupData.vendorType === "both") {
      const serviceData = {
        providerId: userId,
        providerName: signupData.displayName,
        providerImage: signupData.storeLogoUrl || "/placeholder.svg",
        title: `${signupData.storeName} Services`,
        description: signupData.storeDescription,
        category: signupData.storeCategory, // Fixed: was signupData.category
        price: 0,
        pricingType: "custom" as const,
        images: [signupData.storeLogoUrl || "/placeholder.svg"],
        location: signupData.storeAddress, // Fixed: was signupData.address
        locationType: "both" as const,
        availability: {
          monday: { start: "09:00", end: "17:00", available: true },
          tuesday: { start: "09:00", end: "17:00", available: true },
          wednesday: { start: "09:00", end: "17:00", available: true },
          thursday: { start: "09:00", end: "17:00", available: true },
          friday: { start: "09:00", end: "17:00", available: true },
          saturday: { start: "09:00", end: "13:00", available: true },
          sunday: { start: "", end: "", available: false }
        },
        reviewCount: 0,
        featured: false,
        status: "active" as const,
        tags: []
      }

      try {
        await createService(serviceData)
        console.log('Service profile created successfully for vendor:', userId)
      } catch (serviceError) {
        console.error('Failed to create service profile:', serviceError)
        // Continue even if service creation fails
      }
    }

    // Mark signup as completed
    await db.collection('pending_signups').updateOne(
      { signupId: metadata.orderId },
      {
        $set: {
          status: 'completed',
          userId: userId,
          completedAt: new Date()
        }
      }
    )

    // Log payment record
    await db.collection('subscription_payments').insertOne({
      vendorId: userId,
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
      gatewayResponse: paymentData,
      type: 'signup'
    })

    // Send welcome email
    try {
      await sendEmail(
        signupData.email,
        'Welcome to Make It Sell - Account Created Successfully!',
        'subscription-confirmed',
        {
          amount: '₦2,500',
          subscriptionPeriod: `${new Date().toLocaleDateString('en-NG')} - ${subscriptionExpiry.toLocaleDateString('en-NG')}`,
          reference: reference
        }
      )
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError)
      // Don't fail the whole process if email fails
    }

    // Send email verification email (separate from welcome email)
    try {
      // Fetch the user to get the verification token
      const user = await db.collection('users').findOne({ 
        _id: new (require('mongodb').ObjectId)(userId) 
      })
      
      if (user && user.emailVerificationToken && !user.isEmailVerified) {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
        const verificationUrl = `${baseUrl}/verify-email?token=${user.emailVerificationToken}`
        
        const { emailService } = require('@/lib/email')
        await emailService.sendEmailVerification({
          email: signupData.email,
          name: signupData.displayName || 'Vendor',
          verificationUrl
        })
        
        console.log(`[vendor-signup] Verification email sent to: ${signupData.email}`)
      } else {
        console.log(`[vendor-signup] User already verified or no token found for: ${signupData.email}`)
      }
    } catch (emailError) {
      console.error('[vendor-signup] Failed to send verification email:', emailError)
      // Don't fail the whole process if email verification email fails
    }

    console.log('Vendor signup completed successfully for:', signupData.email)

    // Create a secure one-time login token
    const tokenData = {
      token: reference, // Use payment reference as token
      email: signupData.email,
      userId: userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (10 * 60 * 1000)), // 10 minutes
      used: false
    }
    
    console.log('Creating login token:', {
      token: reference.substring(0, 30) + '...',
      userId: userId,
      email: signupData.email,
      expiresAt: tokenData.expiresAt
    })
    
    await db.collection('login_tokens').insertOne(tokenData)
    console.log('Login token created successfully')

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/signup/success?vendor=true&reference=${reference}&login_token=${reference}`)

  } catch (error) {
    console.error('Signup callback error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/signup?error=processing_failed`)
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

    // Handle successful payment webhook for signup
    if (payload.event === 'charge.success') {
      const reference = payload.data.reference
      const metadata = payload.data.metadata
      
      // Only process signup payments
      if (metadata.orderId && payload.data.metadata.items?.includes('vendor-subscription-signup')) {
        await connectToDatabase()
        const db = require('mongoose').connection.db
        
        const pendingSignup = await db.collection('pending_signups').findOne({
          signupId: metadata.orderId
        })
        
        if (pendingSignup && pendingSignup.status !== 'completed') {
          // Mark as paid - the GET callback will handle account creation
          await db.collection('pending_signups').updateOne(
            { signupId: metadata.orderId },
            { $set: { status: 'payment_confirmed', paidAt: new Date() } }
          )
        }
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Signup webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}