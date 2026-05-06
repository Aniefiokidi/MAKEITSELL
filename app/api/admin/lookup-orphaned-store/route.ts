import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { requireAdminAccess } from '@/lib/server-route-auth'

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const { vendorId, email } = await request.json()

    if (!vendorId && !email) {
      return NextResponse.json(
        { found: false, error: 'vendorId or email is required' },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const db = mongoose.connection.db

    const storeQuery: any = {}
    if (vendorId) storeQuery.vendorId = vendorId
    else storeQuery.email = { $regex: `^${String(email).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }

    const store = await db.collection('stores').findOne(storeQuery)

    if (!store) {
      return NextResponse.json({ found: false })
    }

    const storeEmail = String(store.email || '').trim().toLowerCase()
    const resolvedVendorId = String(store.vendorId)

    // Check if a user already exists
    let userExists = false
    const existingByEmail = storeEmail ? await User.findOne({ email: storeEmail }) : null
    if (existingByEmail) {
      userExists = true
    } else {
      try {
        const existingById = await User.findById(resolvedVendorId)
        if (existingById) userExists = true
      } catch {
        // invalid ObjectId
      }
    }

    return NextResponse.json({
      found: true,
      userExists,
      store: {
        storeId: String(store._id),
        storeName: store.storeName || '',
        email: storeEmail,
        phone: store.phone || '',
        vendorId: resolvedVendorId,
        category: store.category || '',
      },
    })
  } catch (error: any) {
    console.error('[admin/lookup-orphaned-store] Error:', error)
    return NextResponse.json(
      { found: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
