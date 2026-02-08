import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionManagementService } from '@/lib/subscription-management'
import connectToDatabase from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, vendorId, adminSecret } = body
    
    // Security check
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const db = require('mongoose').connection.db

    switch (action) {
      case 'send_expiry_warnings':
        const expiryResult = await SubscriptionManagementService.sendExpiryWarnings()
        return NextResponse.json({ 
          success: true, 
          message: 'Expiry warnings sent',
          processed: expiryResult.processed 
        })

      case 'send_grace_period_warnings':
        const graceResult = await SubscriptionManagementService.sendGracePeriodWarnings()
        return NextResponse.json({ 
          success: true, 
          message: 'Grace period warnings sent',
          processed: graceResult.processed 
        })

      case 'process_expired_grace_periods':
        const expiredResult = await SubscriptionManagementService.processExpiredGracePeriods()
        return NextResponse.json({ 
          success: true, 
          message: 'Expired grace periods processed',
          frozen: expiredResult.frozen 
        })

      case 'freeze_vendor':
        if (!vendorId) {
          return NextResponse.json({ error: 'vendorId required' }, { status: 400 })
        }
        await SubscriptionManagementService.freezeVendorAccount(vendorId)
        return NextResponse.json({ 
          success: true, 
          message: `Vendor ${vendorId} account frozen` 
        })

      case 'get_vendor_status':
        if (!vendorId) {
          return NextResponse.json({ error: 'vendorId required' }, { status: 400 })
        }
        
        const vendor = await db.collection('users').findOne({ 
          $or: [{ _id: vendorId }, { uid: vendorId }] 
        })
        const store = await db.collection('stores').findOne({ vendorId })
        
        return NextResponse.json({
          success: true,
          vendor: {
            id: vendor?._id,
            email: vendor?.email,
            name: vendor?.displayName || vendor?.name
          },
          store: store ? {
            storeName: store.storeName,
            subscriptionStatus: store.subscriptionStatus,
            subscriptionExpiry: store.subscriptionExpiry,
            accountStatus: store.accountStatus,
            isActive: store.isActive,
            frozen: store.frozen,
            gracePeriodEnd: store.gracePeriodEnd
          } : null
        })

      case 'get_all_subscription_status':
        const allStores = await db.collection('stores').find({}).toArray()
        const subscriptionOverview = await Promise.all(
          allStores.map(async (store) => {
            const vendor = await db.collection('users').findOne({ 
              $or: [{ _id: store.vendorId }, { uid: store.vendorId }] 
            })
            
            const now = new Date()
            const expiry = store.subscriptionExpiry ? new Date(store.subscriptionExpiry) : null
            const daysUntilExpiry = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
            
            return {
              vendorId: store.vendorId,
              vendorName: vendor?.displayName || vendor?.name || 'Unknown',
              vendorEmail: vendor?.email,
              storeName: store.storeName,
              subscriptionStatus: store.subscriptionStatus || 'unknown',
              subscriptionExpiry: store.subscriptionExpiry,
              daysUntilExpiry,
              accountStatus: store.accountStatus || 'unknown',
              isActive: store.isActive ?? true,
              frozen: store.frozen ?? false,
              gracePeriodEnd: store.gracePeriodEnd
            }
          })
        )
        
        return NextResponse.json({
          success: true,
          totalVendors: subscriptionOverview.length,
          overview: subscriptionOverview
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Subscription admin error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}