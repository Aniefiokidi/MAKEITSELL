import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    // Always the caller's own account. The current-password check below is a real
    // compensating control, but without a session tie this was still a password-guessing
    // and account-enumeration oracle against any userId with no rate limiting.
    const userId = sessionUser.id

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    await connectToDatabase()
    const db = require('mongoose').connection.db
    const objectId = new mongoose.Types.ObjectId(userId)

    // Get user
    const user = await db.collection('users').findOne({ _id: objectId })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await db.collection('users').updateOne(
      { _id: objectId },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date()
        }
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    })

  } catch (error) {
    console.error('Error changing password:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to change password' },
      { status: 500 }
    )
  }
}
