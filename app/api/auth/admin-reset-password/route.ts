import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { hashPassword } from '@/lib/password'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(request, {
      key: 'auth-admin-reset-password',
      maxRequests: 5,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser || sessionUser.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 403 })
    }

    const { email, newPassword } = await request.json()

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
      message: `Password updated for ${email}`
    })
  } catch (error: any) {
    console.error('Reset password error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to reset password'
    }, { status: 500 })
  }
}
