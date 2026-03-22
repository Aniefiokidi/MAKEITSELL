import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import crypto from 'crypto'
import { User } from '@/lib/models/User'

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { email, newPassword, adminSecret } = await request.json()
    
    // Simple admin verification (change this secret!)
    if (adminSecret !== 'TEMP_ADMIN_RESET_2026') {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 403 })
    }

    await connectToDatabase()
    
    const user = await User.findOne({ email })
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    // Update password
    user.passwordHash = hashPassword(newPassword)
    user.updatedAt = new Date()
    await user.save()

    return NextResponse.json({
      success: true,
      message: `Password updated for ${email}`,
      newPasswordHash: user.passwordHash
    })
  } catch (error: any) {
    console.error('Reset password error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to reset password'
    }, { status: 500 })
  }
}
