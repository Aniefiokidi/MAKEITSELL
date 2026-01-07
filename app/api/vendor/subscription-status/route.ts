import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { connectToDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const sessionToken = authHeader?.replace('Bearer ', '')

    if (!sessionToken) {
      return NextResponse.json({ error: 'No session token provided' }, { status: 401 })
    }

    // For now, we'll extract the user ID from the session token
    // In a real implementation, you'd validate the session token against the database
    let vendorId: string
    try {
      // Simple approach: decode the session token to get user ID
      // This assumes the session token contains the user ID
      // In production, you'd validate this against a sessions collection
      const decoded = JSON.parse(atob(sessionToken.split('.')[1] || sessionToken))
      vendorId = decoded.uid || decoded.userId || decoded.id
      
      if (!vendorId) {
        throw new Error('Invalid session token')
      }
    } catch (error) {
      // If token decoding fails, return 401
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 })
    }

    const { db } = await connectToDatabase()
    
    // Find the vendor's store to get subscription status
    const store = await db.collection('stores').findOne({
      vendorId: vendorId
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Calculate days until expiry
    const now = new Date()
    const expiryDate = new Date(store.subscriptionExpiry)
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return NextResponse.json({
      subscriptionStatus: store.subscriptionStatus || 'active',
      subscriptionExpiry: store.subscriptionExpiry,
      expiryDate: store.subscriptionExpiry,
      accountStatus: store.accountStatus || 'active',
      isActive: store.isActive !== false,
      daysUntilExpiry,
      warningEmailSent: store.warningEmailSent || false,
      suspendedAt: store.suspendedAt
    })

  } catch (error) {
    console.error('Subscription status error:', error)
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    )
  }
}