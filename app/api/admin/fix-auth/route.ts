import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import crypto from 'crypto'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { User } from '@/lib/models/User'

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()

    // Find all users with undefined or missing passwordHash
    const usersWithoutHash = await User.find({
      $or: [{ passwordHash: { $exists: false } }, { passwordHash: null }],
    })

    console.log(`[fix-auth] Found ${usersWithoutHash.length} users without password hash`)

    const results = []

    for (const user of usersWithoutHash) {
      // Generate a temporary password
      const tempPassword = crypto.randomBytes(6).toString('hex')
      const passwordHash = hashPassword(tempPassword)

      user.passwordHash = passwordHash
      user.sessionToken = crypto.randomBytes(32).toString('hex')
      await user.save()

      results.push({
        email: user.email,
        message: 'User can now sign in and should change password via "Forgot Password"',
      })

      console.log(`[fix-auth] Fixed user: ${user.email}`)
    }

    return NextResponse.json(
      {
        success: true,
        message: `Fixed ${usersWithoutHash.length} users`,
        users: results,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[fix-auth] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
