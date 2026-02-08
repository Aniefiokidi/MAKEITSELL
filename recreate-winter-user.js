const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test"

async function recreateWinterUser() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB...\n')

    const db = mongoose.connection.db

    // First, find the WINTER store to get the vendor ID it expects
    const winterStore = await db.collection('stores').findOne({ storeName: 'WINTER' })
    if (!winterStore) {
      console.log('❌ WINTER store not found!')
      return
    }

    console.log('Found WINTER store:')
    console.log(`- Store ID: ${winterStore._id}`)
    console.log(`- Expected Vendor ID: ${winterStore.vendorId}`)
    console.log(`- Store Name: ${winterStore.storeName}`)

    // Check if user already exists with this email
    const existingUser = await db.collection('users').findOne({ email: 'mellowalex1@icloud.com' })
    if (existingUser) {
      console.log('\n⚠️ User with this email already exists!')
      console.log(`Existing user ID: ${existingUser._id}`)
      console.log('Do you want to update the existing user? (continuing for now...)')
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('123456', 10)

    // Use the vendor ID that the WINTER store expects
    const targetVendorId = winterStore.vendorId

    // Create/update the user to match the WINTER store's vendor ID
    const userResult = await db.collection('users').replaceOne(
      { _id: targetVendorId }, // Use the exact vendor ID the store expects
      {
        _id: targetVendorId,
        email: 'mellowalex1@icloud.com',
        name: 'Alex Mellow',
        displayName: 'Alex Mellow', 
        password: hashedPassword,
        role: 'vendor',
        vendorInfo: {
          businessName: 'WINTER',
          businessType: 'both',
          storeName: 'WINTER'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { upsert: true }
    )

    console.log('\n✅ User created/updated:')
    console.log(`- User ID: ${targetVendorId}`)
    console.log(`- Email: mellowalex1@icloud.com`) 
    console.log(`- Password: 123456`)
    console.log(`- Linked to store: ${winterStore.storeName}`)

    // Create subscription payment for this month (paid today)
    const today = new Date()
    const oneMonthFromToday = new Date()
    oneMonthFromToday.setMonth(today.getMonth() + 1)

    const subscriptionId = uuidv4()
    const reference = `${subscriptionId}-${Date.now()}`

    const subscriptionPayment = {
      vendorId: targetVendorId,
      subscriptionId: subscriptionId,
      reference: reference,
      amount: 2500,
      status: 'completed',
      paymentDate: today,
      subscriptionPeriod: {
        start: today,
        end: oneMonthFromToday
      },
      gateway: 'paystack',
      gatewayResponse: {
        id: Date.now(),
        domain: 'test',
        status: 'success',
        reference: reference,
        amount: 250000, // Paystack uses kobo
        gateway_response: 'Successful',
        paid_at: today,
        created_at: today,
        channel: 'card',
        currency: 'NGN',
        customer: {
          email: 'mellowalex1@icloud.com'
        },
        metadata: {
          orderId: subscriptionId,
          customerId: subscriptionId,
          items: JSON.stringify([{
            productId: 'vendor-subscription-signup',
            title: 'Vendor Account Setup + Monthly Subscription',
            quantity: 1,
            price: 2500,
            vendorId: 'makeitsell',
            vendorName: 'Make It Sell'
          }]),
          type: 'vendor_signup'
        }
      },
      type: 'signup'
    }

    const subscriptionResult = await db.collection('subscription_payments').insertOne(subscriptionPayment)

    console.log('\n✅ Subscription payment created:')
    console.log(`- Subscription ID: ${subscriptionId}`)
    console.log(`- Amount: ₦2,500`)
    console.log(`- Start Date: ${today.toLocaleDateString()}`)
    console.log(`- Expiry Date: ${oneMonthFromToday.toLocaleDateString()}`)
    console.log(`- Status: completed`)

    // Verify the setup
    console.log('\n=== VERIFICATION ===')
    const user = await db.collection('users').findOne({ _id: targetVendorId })
    const store = await db.collection('stores').findOne({ vendorId: targetVendorId })
    const subscription = await db.collection('subscription_payments').findOne({ vendorId: targetVendorId, status: 'completed' })

    console.log(`✅ User found: ${user ? 'YES' : 'NO'}`)
    console.log(`✅ Store linked: ${store ? 'YES' : 'NO'} (${store?.storeName || 'N/A'})`)
    console.log(`✅ Subscription active: ${subscription ? 'YES' : 'NO'}`)

    if (user && store && subscription) {
      console.log('\n🎉 SUCCESS! Everything is properly linked:')
      console.log(`👤 User: ${user.displayName} (${user.email})`)
      console.log(`🏪 Store: ${store.storeName}`)
      console.log(`💳 Subscription: Active until ${new Date(subscription.subscriptionPeriod.end).toLocaleDateString()}`)
      console.log('\n📱 The admin panel should now show this vendor with active subscription!')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await mongoose.disconnect()
  }
}

recreateWinterUser()