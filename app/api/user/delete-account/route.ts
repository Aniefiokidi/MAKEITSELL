import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email } = body

    console.log('Delete account request:', { userId, email })

    if (!userId || !email) {
      return NextResponse.json(
        { success: false, error: 'User ID and email are required' },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const db = require('mongoose').connection.db
    
    // Try multiple ways to find the user
    let user = await db.collection('users').findOne({ _id: userId })
    
    if (!user) {
      // Try with email only
      user = await db.collection('users').findOne({ email })
    }

    if (!user) {
      console.log('User not found with userId or email:', { userId, email })
      // List all users for debugging
      const allUsers = await db.collection('users').find({}).limit(5).toArray()
      console.log('Sample users structure:', allUsers.map((u: any) => ({ _id: u._id, email: u.email, role: u.role })))
      
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    console.log('Found user:', { _id: user._id, email: user.email, role: user.role })

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
