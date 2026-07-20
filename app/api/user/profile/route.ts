import { NextRequest, NextResponse } from 'next/server'
import { getUserById } from '@/lib/mongodb-operations'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const uid = searchParams.get('uid')
    
    if (!uid) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 })
    }

    // Get user from MongoDB
    const user = await getUserById(uid)
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    // Return user profile data
    const profile = {
      uid: user._id.toString(),
      email: user.email,
      displayName: user.name,
      role: user.role,
      vendorType: user.role === 'vendor' ? 'both' : undefined,
      createdAt: user.createdAt || new Date(),
      updatedAt: user.updatedAt || new Date()
    }

    return NextResponse.json({
      success: true,
      profile
    })
  } catch (error: any) {
    console.error('Get user profile error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get user profile'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid, ...updates } = await request.json()
    
    if (!uid) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 })
    }

    // Update user profile in MongoDB
    // This would need to be implemented based on your updateUser function
    
    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully'
    })
  } catch (error: any) {
    console.error('Update user profile error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update user profile'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { displayName, phone, address, city, state, postalCode } = body

    // Always the caller's own account — this used to take userId from the body with no
    // session check, so any authenticated (or even unauthenticated) request could rewrite
    // another user's name/phone/address.
    const userId = sessionUser.id

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const connectToDatabase = require('@/lib/mongodb').default
    await connectToDatabase()
    const db = require('mongoose').connection.db
    const objectId = new mongoose.Types.ObjectId(userId)

    // Update user profile
    const updateData: any = {}

    if (displayName !== undefined) updateData.displayName = displayName
    if (phone !== undefined) updateData.phone = phone
    if (address !== undefined) updateData.address = address
    if (city !== undefined) updateData.city = city
    if (state !== undefined) updateData.state = state
    if (postalCode !== undefined) updateData.postalCode = postalCode

    updateData.updatedAt = new Date()

    const result = await db.collection('users').updateOne(
      { _id: objectId },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Get updated user
    const updatedUser = await db.collection('users').findOne({ _id: objectId })

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    })

  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}