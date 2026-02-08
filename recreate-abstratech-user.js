const mongoose = require('mongoose')
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test"

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function recreateAbstraTechUser() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB...\n')

    const db = mongoose.connection.db

    // First, find the Abstra Tech store to get the vendor ID it expects
    const abstraTechStore = await db.collection('stores').findOne({ storeName: 'Abstra Tech' })
    if (!abstraTechStore) {
      console.log('❌ Abstra Tech store not found!')
      return
    }

    console.log('Found Abstra Tech store:')
    console.log(`- Store ID: ${abstraTechStore._id}`)
    console.log(`- Expected Vendor ID: ${abstraTechStore.vendorId}`)
    console.log(`- Store Name: ${abstraTechStore.storeName}`)

    // Check if user already exists with this email
    const existingUser = await db.collection('users').findOne({ email: 'jonathandavngeri@gmail.com' })
    if (existingUser) {
      console.log('\n⚠️ User with this email already exists!')
      console.log(`Existing user ID: ${existingUser._id}`)
      console.log('Continuing to update the existing user...')
    }

    // Hash the password with SHA256 (same as auth system)
    const passwordHash = hashPassword('123456')
    const sessionToken = crypto.randomBytes(32).toString('hex')

    // Use the vendor ID that the Abstra Tech store expects
    const targetVendorId = abstraTechStore.vendorId

    // Create/update the user to match the Abstra Tech store's vendor ID
    const userResult = await db.collection('users').replaceOne(
      { _id: targetVendorId }, // Use the exact vendor ID the store expects
      {
        _id: targetVendorId,
        email: 'jonathandavngeri@gmail.com',
        name: 'Jonathan David',
        displayName: 'Jonathan David', 
        passwordHash: passwordHash,  // Use SHA256 hash
        role: 'vendor',
        vendorInfo: {
          businessName: 'Abstra Tech',
          businessType: 'both',
          storeName: 'Abstra Tech'
        },
        sessionToken: sessionToken,
        isEmailVerified: true,  // Set email as verified
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { upsert: true }
    )

    console.log('\n✅ User created/updated:')
    console.log(`- User ID: ${targetVendorId}`)
    console.log(`- Email: jonathandavngeri@gmail.com`) 
    console.log(`- Name: Jonathan David`)
    console.log(`- Password: 123456 (SHA256 hashed)`)
    console.log(`- Email verified: true`)
    console.log(`- Linked to store: ${abstraTechStore.storeName}`)

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
          email: 'jonathandavngeri@gmail.com'
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
    if (user) {
      console.log(`   - Authentication ready: ${user.passwordHash && user.isEmailVerified ? 'YES' : 'NO'}`)
      console.log(`   - Password hash: ${user.passwordHash ? 'SHA256 ✓' : 'MISSING ✗'}`)
      console.log(`   - Email verified: ${user.isEmailVerified ? 'YES ✓' : 'NO ✗'}`)
    }
    console.log(`✅ Store linked: ${store ? 'YES' : 'NO'} (${store?.storeName || 'N/A'})`)
    console.log(`✅ Subscription active: ${subscription ? 'YES' : 'NO'}`)

    if (user && store && subscription) {
      console.log('\n🎉 SUCCESS! Everything is properly linked:')
      console.log(`👤 User: ${user.displayName} (${user.email})`)
      console.log(`🏪 Store: ${store.storeName}`)
      console.log(`💳 Subscription: Active until ${new Date(subscription.subscriptionPeriod.end).toLocaleDateString()}`)
      console.log(`🔐 Authentication: Ready for login`)
      
      console.log('\n📱 Login credentials:')
      console.log(`   Email: jonathandavngeri@gmail.com`)
      console.log(`   Password: 123456`)
      console.log('\n📊 The admin panel should now show this vendor with active subscription!')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await mongoose.disconnect()
  }
}

recreateAbstraTechUser()