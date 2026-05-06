import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { hashPassword } from '@/lib/password'

function generateTemporaryPassword() {
  const raw = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `MIS-${raw}`
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const { vendorId, email } = await request.json()

    if (!vendorId && !email) {
      return NextResponse.json(
        { success: false, error: 'vendorId or email is required' },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const db = mongoose.connection.db!

    // Look up the orphaned store
    const storeQuery: any = {}
    if (vendorId) storeQuery.vendorId = vendorId
    else storeQuery.email = { $regex: `^${String(email).trim()}$`, $options: 'i' }

    const store = await db.collection('stores').findOne(storeQuery)
    if (!store) {
      return NextResponse.json(
        { success: false, error: 'No store found matching that vendorId or email' },
        { status: 404 }
      )
    }

    const resolvedVendorId = String(store.vendorId)
    const storeEmail = String(store.email || '').trim().toLowerCase()

    if (!storeEmail) {
      return NextResponse.json(
        { success: false, error: 'Store has no email address — cannot restore account' },
        { status: 422 }
      )
    }

    // Confirm user does not already exist
    const existingByEmail = await User.findOne({ email: storeEmail })
    if (existingByEmail) {
      return NextResponse.json(
        {
          success: false,
          error: `A user with email ${storeEmail} already exists (id: ${existingByEmail._id}). No action taken.`,
        },
        { status: 409 }
      )
    }

    let existingById: any = null
    try {
      existingById = await User.findById(resolvedVendorId)
    } catch {
      // invalid ObjectId — treat as not found
    }
    if (existingById) {
      return NextResponse.json(
        {
          success: false,
          error: `A user with _id ${resolvedVendorId} already exists. No action taken.`,
        },
        { status: 409 }
      )
    }

    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = hashPassword(temporaryPassword)
    const sessionToken = crypto.randomBytes(32).toString('hex')

    // Rebuild the user document using the original vendorId as _id so all
    // existing store/product/order references remain valid without any migration.
    const restoredUser = await User.create({
      _id: new mongoose.Types.ObjectId(resolvedVendorId),
      email: storeEmail,
      name: store.storeName || 'Vendor',
      phone: store.phone || undefined,
      phone_number: store.phone || undefined,
      role: 'vendor',
      vendorInfo: {
        businessType: store.category === 'services' ? 'services' : 'goods',
        businessName: store.storeName || '',
        isApproved: true,
      },
      passwordHash,
      sessionToken,
      isEmailVerified: true,
      mustChangePassword: true,
      temporaryPasswordIssuedAt: new Date(),
      walletBalance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      message: 'Vendor account restored. Share the temporary password with the vendor and ask them to log in and change it immediately.',
      restoredUser: {
        id: String(restoredUser._id),
        email: restoredUser.email,
        name: restoredUser.name,
        role: restoredUser.role,
      },
      storeLinked: {
        storeId: String(store._id),
        storeName: store.storeName,
        vendorId: resolvedVendorId,
      },
      temporaryPassword,
    })
  } catch (error: any) {
    console.error('[admin/restore-vendor-account] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
