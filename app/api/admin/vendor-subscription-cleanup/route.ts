import { NextRequest, NextResponse } from "next/server"
import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gote-marketplace'

let cachedClient: MongoClient | null = null

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient.db('gote-marketplace')
  }

  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  cachedClient = client
  return client.db('gote-marketplace')
}

export async function POST(request: NextRequest) {
  try {
    // This endpoint will be called daily by a cron job or scheduled task
    const authHeader = request.headers.get('authorization')
    
    // Basic security check - you should implement proper API authentication
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = await connectToDatabase()
    const now = new Date()
    
    console.log('Running vendor subscription cleanup job...')

    // Find vendors whose subscription expired more than 10 days ago but less than 20 days
    const suspensionDate = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000)) // 10 days ago
    const deletionDate = new Date(now.getTime() - (20 * 24 * 60 * 60 * 1000)) // 20 days ago

    // Step 1: Suspend accounts (10+ days overdue)
    const accountsToSuspend = await db.collection('stores').find({
      subscriptionStatus: 'active',
      subscriptionExpiry: { $lt: suspensionDate }
    }).toArray()

    if (accountsToSuspend.length > 0) {
      console.log(`Suspending ${accountsToSuspend.length} vendor accounts...`)
      
      await db.collection('stores').updateMany(
        {
          subscriptionStatus: 'active',
          subscriptionExpiry: { $lt: suspensionDate }
        },
        {
          $set: {
            subscriptionStatus: 'suspended',
            suspendedAt: now,
            isActive: false
          }
        }
      )

      // Also suspend associated services
      const vendorIds = accountsToSuspend.map(store => store.vendorId)
      await db.collection('services').updateMany(
        { providerId: { $in: vendorIds } },
        {
          $set: {
            status: 'suspended',
            suspendedAt: now
          }
        }
      )

      // Update user accounts
      await db.collection('users').updateMany(
        { uid: { $in: vendorIds } },
        {
          $set: {
            accountStatus: 'suspended',
            suspendedAt: now
          }
        }
      )

      console.log(`Suspended ${accountsToSuspend.length} vendor accounts`)
    }

    // Step 2: Delete accounts (20+ days overdue)
    const accountsToDelete = await db.collection('stores').find({
      subscriptionStatus: 'suspended',
      subscriptionExpiry: { $lt: deletionDate }
    }).toArray()

    if (accountsToDelete.length > 0) {
      console.log(`Deleting ${accountsToDelete.length} vendor accounts...`)
      
      const vendorIds = accountsToDelete.map(store => store.vendorId)

      // Delete all related data
      await Promise.all([
        // Delete stores
        db.collection('stores').deleteMany({ 
          vendorId: { $in: vendorIds } 
        }),
        
        // Delete services
        db.collection('services').deleteMany({ 
          providerId: { $in: vendorIds } 
        }),
        
        // Delete products
        db.collection('products').deleteMany({ 
          vendorId: { $in: vendorIds } 
        }),
        
        // Delete bookings
        db.collection('bookings').deleteMany({ 
          vendorId: { $in: vendorIds } 
        }),
        
        // Delete orders (keep for customer records but mark as vendor deleted)
        db.collection('orders').updateMany(
          { vendorId: { $in: vendorIds } },
          { 
            $set: { 
              vendorDeleted: true,
              vendorDeletedAt: now
            }
          }
        ),
        
        // Delete vendor conversations
        db.collection('conversations').deleteMany({
          participants: { $in: vendorIds }
        }),

        // Delete user accounts
        db.collection('users').deleteMany({
          uid: { $in: vendorIds }
        })
      ])

      console.log(`Deleted ${accountsToDelete.length} vendor accounts and all associated data`)
    }

    // Step 3: Send warning emails for accounts nearing suspension (7 days overdue)
    const warningDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)) // 7 days ago
    const accountsToWarn = await db.collection('stores').find({
      subscriptionStatus: 'active',
      subscriptionExpiry: { $lt: warningDate, $gte: suspensionDate },
      lastWarningEmail: { $ne: warningDate.toDateString() } // Don't send multiple warnings same day
    }).toArray()

    if (accountsToWarn.length > 0) {
      console.log(`Sending warning emails to ${accountsToWarn.length} vendors...`)
      
      // You would implement email sending here
      // For now, just mark that warnings were sent
      await db.collection('stores').updateMany(
        { _id: { $in: accountsToWarn.map(s => s._id) } },
        { 
          $set: { 
            lastWarningEmail: warningDate.toDateString(),
            warningEmailSent: true
          }
        }
      )
    }

    // Step 4: Clean up expired pending signups (older than 1 hour)
    const expiredSignupDate = new Date(now.getTime() - (60 * 60 * 1000)) // 1 hour ago
    const expiredSignups = await db.collection('pending_signups').find({
      createdAt: { $lt: expiredSignupDate },
      status: { $ne: 'completed' }
    }).toArray()

    if (expiredSignups.length > 0) {
      console.log(`Cleaning up ${expiredSignups.length} expired pending signups...`)
      
      await db.collection('pending_signups').deleteMany({
        createdAt: { $lt: expiredSignupDate },
        status: { $ne: 'completed' }
      })
    }

    return NextResponse.json({
      success: true,
      suspended: accountsToSuspend.length,
      deleted: accountsToDelete.length,
      warned: accountsToWarn.length,
      expiredSignupsCleanedUp: expiredSignups.length,
      timestamp: now.toISOString()
    })

  } catch (error) {
    console.error('Vendor subscription cleanup error:', error)
    return NextResponse.json(
      { error: 'Cleanup job failed' },
      { status: 500 }
    )
  }
}