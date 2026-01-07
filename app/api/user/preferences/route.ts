import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const db = require('mongoose').connection.db
    
    const user = await db.collection('users').findOne({ _id: userId })

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
    const body = await request.json()
    const { userId, preferences } = body

    if (!userId || !preferences) {
      return NextResponse.json(
        { success: false, error: 'User ID and preferences are required' },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const db = require('mongoose').connection.db
    
    const result = await db.collection('users').updateOne(
      { _id: userId },
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
