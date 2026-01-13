import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import mongoose from 'mongoose'
import crypto from 'crypto'

// User schema (same as in auth.ts)
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  passwordHash: String,
  name: String,
  role: { type: String, default: 'customer' },
  vendorInfo: Object,
  sessionToken: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

const User = mongoose.models.User || mongoose.model('User', userSchema)

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    // This is a dangerous endpoint - in production, verify admin access
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.ADMIN_SECRET || 'dev-secret'}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

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
        tempPassword,
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
