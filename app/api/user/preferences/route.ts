import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import mongoose from 'mongoose'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Always the caller's own preferences — never trust userId from the query string.
    const userId = sessionUser.id
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    await connectToDatabase()
    const db = require('mongoose').connection.db

    const user = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(userId) })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      preferences: user.preferences || {
        notifications: {
          emailNotifications: true,
          orderUpdates: true,
          promotions: false,
          newsletter: true
        }
      }
    })

  } catch (error) {
    console.error('Error fetching preferences:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { preferences } = body
    // Always the caller's own preferences — never trust userId from the body.
    const userId = sessionUser.id

    if (!preferences) {
      return NextResponse.json(
        { success: false, error: 'Preferences are required' },
        { status: 400 }
      )
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    await connectToDatabase()
    const db = require('mongoose').connection.db

    const result = await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      {
        $set: { 
          preferences: preferences,
          updatedAt: new Date()
        } 
      }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully'
    })

  } catch (error) {
    console.error('Error updating preferences:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}
