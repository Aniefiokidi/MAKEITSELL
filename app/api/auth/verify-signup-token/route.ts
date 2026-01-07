import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { signInWithToken } from '@/lib/mongodb-auth'

export async function POST(request: NextRequest) {
  try {
    const { loginToken } = await request.json()

    console.log('Verifying login token:', loginToken?.substring(0, 30) + '...')

    if (!loginToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Connect to database
    await connectToDatabase()
    const db = require('mongoose').connection.db

    // Find the login token
    const tokenDoc = await db.collection('login_tokens').findOne({ 
      token: loginToken,
      used: false,
      expiresAt: { $gt: new Date() }
    })

    console.log('Token lookup result:', tokenDoc ? 'FOUND' : 'NOT FOUND')
    
    if (!tokenDoc) {
      // Check if token exists at all
      const anyToken = await db.collection('login_tokens').findOne({ token: loginToken })
      if (anyToken) {
        console.log('Token found but:', {
          used: anyToken.used,
          expired: anyToken.expiresAt < new Date(),
          expiresAt: anyToken.expiresAt
        })
      } else {
        console.log('Token does not exist in database')
      }
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Mark token as used
    await db.collection('login_tokens').updateOne(
      { token: loginToken },
      { $set: { used: true, usedAt: new Date() } }
    )

    console.log('Looking for user with ID:', tokenDoc.userId)

    // Get user details
    const user = await db.collection('users').findOne({ _id: tokenDoc.userId })

    if (!user) {
      console.log('User not found for token userId:', tokenDoc.userId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log('Token verification successful for user:', user.email)

    // Return user session data
    return NextResponse.json({ 
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || user.displayName,
        role: user.role
      }
    })

  } catch (error) {
    console.error('Token verification error:', error)
    return NextResponse.json({ error: 'Token verification failed' }, { status: 500 })
  }
}
