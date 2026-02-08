import { NextRequest } from 'next/server'
import { getAllStores, getAllUsers } from '@/lib/mongodb-operations'
import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test'
let cachedClient: MongoClient | null = null

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient.db('test')
  }

  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  cachedClient = client
  return client.db('test')
}

export async function GET(_req: NextRequest) {
  try {
    const [users, stores, db] = await Promise.all([
      getAllUsers(), 
      getAllStores(),
      connectToDatabase()
    ])
    
    // Get all subscription payments to map to vendors
    const subscriptions = await db.collection('subscription_payments')
      .find({ status: 'completed' })
      .sort({ paymentDate: -1 })
      .toArray()

    // Group subscriptions by vendorId and get the most recent one
    const latestSubscriptionByVendor: Record<string, any> = {}
    subscriptions.forEach((sub: any) => {
      if (!sub.vendorId) return
      const vendorIdStr = sub.vendorId.toString()
      if (!latestSubscriptionByVendor[vendorIdStr] || 
          new Date(sub.paymentDate) > new Date(latestSubscriptionByVendor[vendorIdStr].paymentDate)) {
        latestSubscriptionByVendor[vendorIdStr] = sub
      }
    })

    // Create vendor mapping from stores (store-centric approach)
    const storeByVendorDetailed: Record<string, any> = {}
    const vendorIdToStore: Record<string, any> = {}
    
    stores.forEach((store: any) => {
      if (!store?.vendorId) return
      
      // Convert ObjectId to string if needed
      const vendorIdStr = store.vendorId.toString()
      
      // Get subscription data for this vendor
      const subscription = latestSubscriptionByVendor[vendorIdStr]
      let subscriptionStatus = 'inactive'
      let subscriptionExpiry = null
      let subscriptionAmount = null
      
      if (subscription) {
        const now = new Date()
        const expiryDate = new Date(subscription.subscriptionPeriod.end)
        subscriptionExpiry = expiryDate.toISOString()
        subscriptionAmount = subscription.amount
        
        if (expiryDate > now) {
          subscriptionStatus = 'active'
        } else {
          subscriptionStatus = 'expired'
        }
      }
      
      const storeData = {
        storeName: store.storeName,
        accountStatus: store.accountStatus || 'active', 
        subscriptionExpiry,
        subscriptionStatus,
        subscriptionAmount
      }
      
      storeByVendorDetailed[vendorIdStr] = storeData
      vendorIdToStore[vendorIdStr] = store
    })

    // Create vendor list from users but prioritize those with stores
    const allVendors = users.filter((u: any) => u.role === 'vendor')
    
    // Split vendors into those with stores and those without
    const vendorsWithStores = []
    const vendorsWithoutStores = []
    
    allVendors.forEach((vendor: any) => {
      const vendorIdStr = (vendor.id || vendor._id).toString()
      const store = storeByVendorDetailed[vendorIdStr]
      
      const vendorData = {
        id: vendor.id || vendor._id,
        email: vendor.email,
        name: vendor.name || vendor.displayName || 'N/A',
        vendorType: vendor.vendorInfo?.type || 'both',
        storeName: store?.storeName || vendor.vendorInfo?.storeName || 'N/A',
        status: store?.accountStatus || vendor.vendorInfo?.status || 'pending',
        subscriptionExpiry: store?.subscriptionExpiry,
        subscriptionStatus: store?.subscriptionStatus || 'unknown',
        subscriptionAmount: store?.subscriptionAmount,
        createdAt: vendor.createdAt,
        hasStore: !!store
      }
      
      if (store) {
        vendorsWithStores.push(vendorData)
      } else {
        vendorsWithoutStores.push(vendorData)
      }
    })
    
    // Return vendors with stores first, then those without
    const vendors = [...vendorsWithStores, ...vendorsWithoutStores]
    
    // Calculate total revenue from all completed subscriptions
    const totalRevenue = subscriptions.reduce((total: number, sub: any) => {
      return total + (sub.amount || 0)
    }, 0)

    return new Response(JSON.stringify({ 
      success: true, 
      vendors,
      totalRevenue,
      subscriptionCount: subscriptions.length
    }), { status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), { status: 500 })
  }
}
