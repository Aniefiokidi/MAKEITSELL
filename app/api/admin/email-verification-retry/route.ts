import { NextRequest, NextResponse } from 'next/server'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { emailService } from '@/lib/email'

function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function getRetryDelayMinutes(retryCount: number): number {
  const schedule = [2, 5, 15, 30, 60, 180]
  const index = Math.max(0, Math.min(retryCount, schedule.length - 1))
  return schedule[index]
}

async function processRetryBatch(limit: number) {
  const now = new Date()
  const maxRetries = Number(process.env.VERIFICATION_RETRY_MAX_ATTEMPTS || 6)

  const users = await User.find({
    isEmailVerified: { $ne: true },
    verificationEmailRetryPending: true,
    verificationEmailRetryCount: { $lt: maxRetries },
    verificationEmailNextRetryAt: { $lte: now },
  })
    .sort({ verificationEmailNextRetryAt: 1, createdAt: 1 })
    .limit(limit)

  let processed = 0
  let sent = 0
  let failed = 0
  let exhausted = 0

  for (const user of users) {
    processed += 1

    try {
      const verificationCode = generateVerificationCode()
      const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000)

      user.emailVerificationToken = verificationCode
      user.emailVerificationTokenExpiry = tokenExpiry
      user.verificationEmailLastAttemptAt = new Date()
      user.updatedAt = new Date()
      await user.save()

      const delivered = await emailService.sendEmailVerification({
        email: user.email,
        name: user.name || user.displayName || 'User',
        verificationCode,
      })

      if (delivered) {
        sent += 1
        user.verificationEmailRetryPending = false
        user.verificationEmailRetryCount = 0
        user.verificationEmailNextRetryAt = undefined
        user.verificationEmailLastError = undefined
        user.verificationEmailLastAttemptAt = new Date()
        user.updatedAt = new Date()
        await user.save()
        continue
      }

      const currentRetryCount = Number(user.verificationEmailRetryCount || 0) + 1
      const delayMinutes = getRetryDelayMinutes(currentRetryCount)
      const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000)
      const reachedMaxRetries = currentRetryCount >= maxRetries

      if (reachedMaxRetries) {
        exhausted += 1
      } else {
        failed += 1
      }

      user.verificationEmailRetryPending = !reachedMaxRetries
      user.verificationEmailRetryCount = currentRetryCount
      user.verificationEmailNextRetryAt = reachedMaxRetries ? undefined : nextRetryAt
      user.verificationEmailLastError = 'Email service returned false during retry send'
      user.verificationEmailLastAttemptAt = new Date()
      user.updatedAt = new Date()
      await user.save()
    } catch (error: any) {
      const currentRetryCount = Number(user.verificationEmailRetryCount || 0) + 1
      const delayMinutes = getRetryDelayMinutes(currentRetryCount)
      const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000)
      const reachedMaxRetries = currentRetryCount >= maxRetries

      if (reachedMaxRetries) {
        exhausted += 1
      } else {
        failed += 1
      }

      user.verificationEmailRetryPending = !reachedMaxRetries
      user.verificationEmailRetryCount = currentRetryCount
      user.verificationEmailNextRetryAt = reachedMaxRetries ? undefined : nextRetryAt
      user.verificationEmailLastError = String(error?.message || error || 'Unknown retry failure')
      user.verificationEmailLastAttemptAt = new Date()
      user.updatedAt = new Date()
      await user.save()
    }
  }

  return {
    processed,
    sent,
    failed,
    exhausted,
    remainingQueued: await User.countDocuments({ verificationEmailRetryPending: true }),
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const url = new URL(request.url)
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)))

    const result = await processRetryBatch(limit)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[email-verification-retry] Job failed:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to process verification retries' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
