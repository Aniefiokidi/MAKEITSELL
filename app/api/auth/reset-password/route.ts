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
    await connectToDatabase()

    const { email, newPassword } = await request.json()

    if (!email || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Email and new password required' },
        { status: 400 }
      )
    }

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Update password hash
    const passwordHash = hashPassword(newPassword)
    user.passwordHash = passwordHash
    user.sessionToken = crypto.randomBytes(32).toString('hex')
    await user.save()

    console.log(`[auth/reset-password] Reset password for user: ${email}`)

    return NextResponse.json(
      {
        success: true,
        message: 'Password reset successfully',
        sessionToken: user.sessionToken,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[auth/reset-password] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
