import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'

export async function GET(request: NextRequest) {
  try {
    console.log('[db-check] Connecting to database...')
    await connectToDatabase()
    console.log('[db-check] Connected successfully')

    // Count total users
    const totalUsers = await User.countDocuments({})
    console.log('[db-check] Total users:', totalUsers)

    // Count users without email verification field
    const usersWithoutVerification = await User.countDocuments({
      isEmailVerified: { $exists: false }
    })
    console.log('[db-check] Users without isEmailVerified field:', usersWithoutVerification)

    // Count users with email verification = false
    const unverifiedUsers = await User.countDocuments({
      isEmailVerified: false
    })
    console.log('[db-check] Users with isEmailVerified: false:', unverifiedUsers)

    // Sample users
    const sampleUsers = await User.find({}, { 
      email: 1, 
      name: 1, 
      isEmailVerified: 1,
      createdAt: 1 
    }).limit(5)

    console.log('[db-check] Sample users:', sampleUsers)

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        usersWithoutVerification,
        unverifiedUsers,
        totalNeedingVerification: usersWithoutVerification + unverifiedUsers
      },
      sampleUsers: sampleUsers.map(user => ({
        email: user.email,
        name: user.name,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt
      }))
    })

  } catch (error: any) {
    console.error('[db-check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}