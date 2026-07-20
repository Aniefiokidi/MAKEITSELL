import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import mongoose from 'mongoose'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function DELETE(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Always the caller's own account — this used to take userId/email straight from the
    // body with no session check, and even fell back to an email-only lookup, meaning
    // just knowing someone's email address was enough to delete their account.
    const userId = sessionUser.id
    const email = sessionUser.email

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    await connectToDatabase()
    const db = mongoose.connection.db!
    const objectId = new mongoose.Types.ObjectId(userId)

    // Mongoose auto-casts string ids for its own queries, but this route uses the native
    // driver directly to reach the deleted_users/login_tokens/carts collections that
    // don't have models — so the id has to be cast to ObjectId by hand here.
    const user = await db.collection('users').findOne({ _id: objectId })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Don't allow deletion of vendor or admin accounts this way
    if (user.role === 'vendor' || user.role === 'admin') {
      return NextResponse.json(
        { success: false, error: 'Vendor and admin accounts must contact support for account deletion' },
        { status: 403 }
      )
    }

    // Archive user data before deletion
    await db.collection('deleted_users').insertOne({
      originalUserId: userId,
      originalEmail: email,
      deletedAt: new Date(),
      userData: {
        ...user,
        password: '[REDACTED]'
      }
    })

    // Clear user sessions/tokens
    await db.collection('login_tokens').deleteMany({ userId: user._id })

    // Delete user's cart
    await db.collection('carts').deleteMany({ userId: user._id })

    // Delete user from database (hard delete for customers)
    const deleteResult = await db.collection('users').deleteOne({ _id: user._id })

    console.log(`Account deleted successfully for user: ${user._id}, deleted count: ${deleteResult.deletedCount}`)

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}
