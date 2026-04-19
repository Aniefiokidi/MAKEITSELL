import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { hashPassword } from '@/lib/password'

type RecoveryRequest = {
  action?: 'preview' | 'prepare'
  limit?: number
  skip?: number
  emailFilter?: string
  sendSms?: boolean
  includeAlreadyPrepared?: boolean
}

function generateTemporaryPassword() {
  const raw = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `MIS-${raw}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const body: RecoveryRequest = await request.json()
    const action = body.action || 'preview'
    const limit = Math.max(1, Math.min(Number(body.limit || 50), 300))
    const skip = Math.max(0, Number(body.skip || 0))
    const sendSms = !!body.sendSms

    await connectToDatabase()

    const query: any = {
      $or: [{ isEmailVerified: { $exists: false } }, { isEmailVerified: false }],
    }

    if (!body.includeAlreadyPrepared) {
      query.mustChangePassword = { $ne: true }
    }

    const emailFilter = String(body.emailFilter || '').trim()
    if (emailFilter) {
      query.email = { $regex: escapeRegExp(emailFilter), $options: 'i' }
    }

    const totalMatching = await User.countDocuments(query)
    const users = await User.find(query, {
      email: 1,
      name: 1,
      displayName: 1,
      role: 1,
      phone: 1,
      phone_number: 1,
      isEmailVerified: 1,
      mustChangePassword: 1,
      createdAt: 1,
    })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)

    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        action: 'preview',
        totalMatching,
        processed: users.length,
        skip,
        limit,
        hasMore: skip + users.length < totalMatching,
        sample: users.map((u: any) => ({
          id: String(u._id),
          email: String(u.email || ''),
          name: u.name || u.displayName || 'User',
          phone: u.phone_number || u.phone || null,
          isEmailVerified: !!u.isEmailVerified,
          mustChangePassword: !!u.mustChangePassword,
        })),
        note: 'Preview only. No password was changed.',
      })
    }

    let prepared = 0
    let smsSent = 0
    let smsFailed = 0
    const skippedNoPhone: string[] = []
    const failedSms: string[] = []

    for (const user of users as any[]) {
      const temporaryPassword = generateTemporaryPassword()

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordHash: hashPassword(temporaryPassword),
            mustChangePassword: true,
            temporaryPasswordIssuedAt: new Date(),
            isEmailVerified: true,
            emailVerificationToken: null,
            emailVerificationTokenExpiry: null,
            updatedAt: new Date(),
          },
        }
      )

      prepared++

      if (sendSms) {
        failedSms.push(String(user.email || ''))
      }
    }

    return NextResponse.json({
      success: true,
      action: 'prepare',
      totalMatching,
      processed: users.length,
      prepared,
      smsRequested: sendSms,
      smsSent,
      smsFailed,
      skippedNoPhone: skippedNoPhone.slice(0, 100),
      failedSms: failedSms.slice(0, 100),
      skip,
      limit,
      hasMore: skip + users.length < totalMatching,
      nextSkip: skip + users.length,
      message: sendSms
        ? 'Users prepared. SMS sending is disabled in email-only mode.'
        : 'Users prepared only.',
    })
  } catch (error: any) {
    console.error('[admin/unverified-account-recovery] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error',
      },
      { status: 500 }
    )
  }
}
