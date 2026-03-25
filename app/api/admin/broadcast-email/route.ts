import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { emailService } from '@/lib/email'
import { requireAdminAccess } from '@/lib/server-route-auth'

type TemplateOverrides = {
  subject?: string
  body?: string
  loginButtonText?: string
  signupButtonText?: string
}

type BroadcastRequest = {
  action?: 'preview' | 'send' | 'message-preview'
  dryRun?: boolean
  limit?: number
  skip?: number
  emailFilter?: string
  onlyUnverified?: boolean
  includeAdmins?: boolean
  delayMs?: number
  previewName?: string
  templateOverrides?: TemplateOverrides
}

function buildUserQuery(input: BroadcastRequest) {
  const query: any = {}

  if (input.onlyUnverified) {
    query.$or = [
      { isEmailVerified: { $exists: false } },
      { isEmailVerified: false },
    ]
  }

  if (input.emailFilter) {
    query.email = { $regex: input.emailFilter, $options: 'i' }
  }

  if (!input.includeAdmins) {
    query.role = { $ne: 'admin' }
  }

  return query
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const body: BroadcastRequest = await request.json()

    const action = body.action || (body.dryRun ? 'preview' : 'send')
    const limit = Math.max(1, Math.min(body.limit || 200, 1000))
    const skip = Math.max(0, body.skip || 0)
    const delayMs = Math.max(0, Math.min(body.delayMs || 350, 2000))

    if (action === 'message-preview') {
      const template = emailService.getRegistrationIssueAnnouncementTemplate({
        name: body.previewName || 'Preview User',
        overrides: body.templateOverrides,
      })

      return NextResponse.json({
        success: true,
        action: 'message-preview',
        subject: template.subject,
        html: template.html,
        text: template.text,
      })
    }

    await connectToDatabase()

    const query = buildUserQuery(body)
    const totalMatching = await User.countDocuments(query)

    const users = await User.find(query, {
      email: 1,
      name: 1,
      displayName: 1,
      role: 1,
      isEmailVerified: 1,
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
        selected: users.length,
        skip,
        limit,
        hasMore: skip + users.length < totalMatching,
        sample: users.slice(0, 20).map((u: any) => ({
          id: String(u._id),
          email: u.email,
          name: u.name || u.displayName || 'User',
          role: u.role || 'customer',
          isEmailVerified: !!u.isEmailVerified,
        })),
      })
    }

    let sent = 0
    let failed = 0
    const failedEmails: string[] = []

    for (const user of users) {
      const email = String(user.email || '').trim()
      if (!email) {
        failed++
        continue
      }

      const ok = await emailService.sendRegistrationIssueAnnouncement({
        email,
        name: user.name || user.displayName || 'User',
        overrides: body.templateOverrides,
      })

      if (ok) {
        sent++
      } else {
        failed++
        failedEmails.push(email)
      }

      if (delayMs > 0) {
        await sleep(delayMs)
      }
    }

    return NextResponse.json({
      success: true,
      action: 'send',
      totalMatching,
      processed: users.length,
      sent,
      failed,
      skip,
      limit,
      hasMore: skip + users.length < totalMatching,
      nextSkip: skip + users.length,
      failedEmails: failedEmails.slice(0, 50),
      message: 'Broadcast run completed',
    })
  } catch (error: any) {
    console.error('[admin/broadcast-email] Error:', error)
    return NextResponse.json({
      success: false,
      error: error?.message || 'Internal server error',
    }, { status: 500 })
  }
}
