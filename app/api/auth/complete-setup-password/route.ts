import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { getUserBySessionToken } from '@/lib/auth'
import { hashPassword, verifyPassword } from '@/lib/password'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value

    const body = await request.json()
    const emailInput = String(body?.email || '').trim().toLowerCase()
    const currentPassword = String(body?.currentPassword || '')
    const newPassword = String(body?.newPassword || '')

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: 'Current and new passwords are required' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'New password must be at least 8 characters' }, { status: 400 })
    }

    await connectToDatabase()

    let user: any = null
    if (sessionToken) {
      const sessionUser = await getUserBySessionToken(sessionToken)
      if (sessionUser?.id) {
        user = await User.findById(sessionUser.id)
      }
    }

    // Fallback: allow recovery users to complete setup with email + temporary password.
    if (!user && emailInput) {
      user = await User.findOne({ email: emailInput })
    }

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!(user as any).mustChangePassword) {
      return NextResponse.json({ success: false, error: 'No account setup action is pending for this user' }, { status: 400 })
    }

    const storedHash = String((user as any).passwordHash || '')
    if (!storedHash || !verifyPassword(currentPassword, storedHash)) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 401 })
    }

    if (verifyPassword(newPassword, storedHash)) {
      return NextResponse.json({ success: false, error: 'New password must be different from current password' }, { status: 400 })
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: hashPassword(newPassword),
          mustChangePassword: false,
          sessionToken: crypto.randomBytes(32).toString('hex'),
          updatedAt: new Date(),
        },
        $unset: {
          temporaryPasswordIssuedAt: '',
        },
      }
    )

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (error: any) {
    console.error('[auth/complete-setup-password] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update password' },
      { status: 500 }
    )
  }
}
