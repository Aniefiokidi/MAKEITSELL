import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { hashPassword } from '@/lib/password'
import { emailService } from '@/lib/email'

function generateTemporaryPassword() {
  const raw = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `MIS-${raw}`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const { query, sendEmail = true, forceCreate = false, createName = '', createRole = 'vendor', flagOnly = false } = await request.json()

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { success: false, error: 'query (name or email) is required' },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const pattern = escapeRegExp(query.trim())
    let users = await User.find({
      $or: [
        { name: { $regex: pattern, $options: 'i' } },
        { email: { $regex: pattern, $options: 'i' } },
        { displayName: { $regex: pattern, $options: 'i' } },
      ],
    }).select('_id email name displayName role mustChangePassword isEmailVerified')

    // If not found and forceCreate is set, create the account (email required)
    if (users.length === 0 && forceCreate) {
      const emailInput = query.trim()
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)
      if (!isEmail) {
        return NextResponse.json({
          success: true,
          found: 0,
          results: [],
          message: 'No users matched. To create an account, enter a valid email address and check "Create account if not found".',
        })
      }
      const allowedRoles = ['vendor', 'customer', 'admin', 'csa']
      const resolvedRole = allowedRoles.includes(createRole) ? createRole : 'vendor'
      const newUser = await User.create({
        email: emailInput.toLowerCase(),
        name: String(createName || emailInput.split('@')[0]),
        role: resolvedRole,
        passwordHash: '',
        sessionToken: crypto.randomBytes(32).toString('hex'),
        isEmailVerified: true,
        mustChangePassword: true,
        walletBalance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      users = [newUser] as any
    }

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        found: 0,
        results: [],
        message: 'No users matched that query.',
      })
    }

    const results = []

    for (const user of users as any[]) {
      if (flagOnly) {
        // Just set the flag — do not change the password
        await User.updateOne(
          { _id: user._id },
          { $set: { mustChangePassword: true, updatedAt: new Date() } }
        )
        results.push({
          id: String(user._id),
          email: user.email,
          name: user.name || user.displayName || '',
          role: user.role || 'customer',
          temporaryPassword: '(unchanged)',
          emailSent: false,
          emailError: null,
        })
        continue
      }

      const temporaryPassword = generateTemporaryPassword()
      const passwordHash = hashPassword(temporaryPassword)
      const sessionToken = crypto.randomBytes(32).toString('hex')

      // Preserve the current passwordHash so users can still log in with their old
      // password after the reset — the signIn function checks previousPasswordHash.
      const oldHash = String(user.passwordHash || '')

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordHash,
            ...(oldHash ? { previousPasswordHash: oldHash } : {}),
            sessionToken,
            mustChangePassword: true,
            isEmailVerified: true,
            temporaryPasswordIssuedAt: new Date(),
            updatedAt: new Date(),
          },
          $unset: {
            emailVerificationToken: '',
            emailVerificationTokenExpiry: '',
          },
        }
      )

      let emailSent = false
      let emailError: string | null = null

      if (sendEmail) {
        try {
          emailSent = await emailService.sendTempPasswordEmail({
            email: user.email,
            name: user.name || user.displayName || 'there',
            temporaryPassword,
          })
          if (!emailSent) {
            emailError = emailService.getLastDeliveryError() || 'Unknown delivery failure'
          }
        } catch (err: any) {
          emailError = err?.message || 'Email send threw an error'
        }
      }

      results.push({
        id: String(user._id),
        email: user.email,
        name: user.name || user.displayName || '',
        role: user.role || 'customer',
        temporaryPassword,
        emailSent,
        emailError,
      })
    }

    return NextResponse.json({
      success: true,
      found: users.length,
      results,
    })
  } catch (error: any) {
    console.error('[admin/set-temp-passwords] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
