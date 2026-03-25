import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { emailService } from '@/lib/email'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { AdminSetting } from '@/lib/models/AdminSetting'

const BROADCAST_TEMPLATE_KEY = 'broadcast_registration_issue_template'
const BROADCAST_FAILED_KEY = 'broadcast_registration_issue_failed_recipients'

type FailedRecipient = {
  email: string
  name: string
}

type TemplateOverrides = {
  subject?: string
  body?: string
  posterImageUrl?: string
  posterWidthPx?: number
  posterHeightPx?: number
  posterXOffsetPx?: number
  posterYOffsetPx?: number
  loginButtonText?: string
  signupButtonText?: string
  eSignatureText?: string
  signatureImageUrl?: string
  senderName?: string
  senderTitle?: string
  senderCompany?: string
  signatureWidthPx?: number
  signatureHeightPx?: number
  signatureXOffsetPx?: number
  signatureYOffsetPx?: number
}

function sanitizeNumberInRange(value: unknown, min: number, max: number, fallback: number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

type BroadcastRequest = {
  action?: 'preview' | 'send' | 'message-preview' | 'template-get' | 'template-save' | 'resend-failed'
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

function sanitizeTemplateOverrides(input?: TemplateOverrides): TemplateOverrides {
  return {
    subject: input?.subject?.trim() || undefined,
    body: input?.body?.trim() || undefined,
    posterImageUrl: input?.posterImageUrl?.trim() || undefined,
    posterWidthPx: sanitizeNumberInRange(input?.posterWidthPx, 240, 620, 420),
    posterHeightPx: sanitizeNumberInRange(input?.posterHeightPx, 140, 520, 220),
    posterXOffsetPx: sanitizeNumberInRange(input?.posterXOffsetPx, 0, 120, 0),
    posterYOffsetPx: sanitizeNumberInRange(input?.posterYOffsetPx, 0, 180, 0),
    loginButtonText: input?.loginButtonText?.trim() || undefined,
    signupButtonText: input?.signupButtonText?.trim() || undefined,
    eSignatureText: input?.eSignatureText?.trim() || undefined,
    signatureImageUrl: input?.signatureImageUrl?.trim() || undefined,
    senderName: input?.senderName?.trim() || undefined,
    senderTitle: input?.senderTitle?.trim() || undefined,
    senderCompany: input?.senderCompany?.trim() || undefined,
    signatureWidthPx: sanitizeNumberInRange(input?.signatureWidthPx, 80, 340, 180),
    signatureHeightPx: sanitizeNumberInRange(input?.signatureHeightPx, 24, 120, 56),
    signatureXOffsetPx: sanitizeNumberInRange(input?.signatureXOffsetPx, 0, 420, 0),
    signatureYOffsetPx: sanitizeNumberInRange(input?.signatureYOffsetPx, 0, 220, 0),
  }
}

async function getStoredTemplateOverrides(): Promise<TemplateOverrides | undefined> {
  const existing = await AdminSetting.findOne({ key: BROADCAST_TEMPLATE_KEY }).lean()
  if (!existing || !existing.value || typeof existing.value !== 'object') {
    return undefined
  }

  return sanitizeTemplateOverrides(existing.value as TemplateOverrides)
}

async function getStoredFailedRecipients(): Promise<FailedRecipient[]> {
  const existing = await AdminSetting.findOne({ key: BROADCAST_FAILED_KEY }).lean()
  const value = existing?.value as any
  const recipients = Array.isArray(value?.recipients) ? value.recipients : []

  return recipients
    .map((item: any) => ({
      email: String(item?.email || '').trim(),
      name: String(item?.name || 'User').trim() || 'User',
    }))
    .filter((item: FailedRecipient) => !!item.email)
}

async function setStoredFailedRecipients(recipients: FailedRecipient[]): Promise<void> {
  await AdminSetting.findOneAndUpdate(
    { key: BROADCAST_FAILED_KEY },
    {
      key: BROADCAST_FAILED_KEY,
      value: {
        recipients,
        count: recipients.length,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
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

    if (action === 'template-get') {
      await connectToDatabase()
      const stored = await getStoredTemplateOverrides()

      return NextResponse.json({
        success: true,
        action: 'template-get',
        templateOverrides: stored || {},
      })
    }

    if (action === 'template-save') {
      await connectToDatabase()
      const cleaned = sanitizeTemplateOverrides(body.templateOverrides)

      await AdminSetting.findOneAndUpdate(
        { key: BROADCAST_TEMPLATE_KEY },
        {
          key: BROADCAST_TEMPLATE_KEY,
          value: cleaned,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      return NextResponse.json({
        success: true,
        action: 'template-save',
        templateOverrides: cleaned,
        message: 'Template saved',
      })
    }

    await connectToDatabase()
    const storedOverrides = await getStoredTemplateOverrides()
    const requestOverrides = sanitizeTemplateOverrides(body.templateOverrides)
    const effectiveOverrides: TemplateOverrides = {
      ...(storedOverrides || {}),
      ...(requestOverrides || {}),
    }

    if (action === 'message-preview') {
      const template = emailService.getRegistrationIssueAnnouncementTemplate({
        name: body.previewName || 'Preview User',
        overrides: effectiveOverrides,
      })

      return NextResponse.json({
        success: true,
        action: 'message-preview',
        subject: template.subject,
        html: template.html,
        text: template.text,
      })
    }

    if (action === 'resend-failed') {
      const failedRecipients = await getStoredFailedRecipients()

      if (!failedRecipients.length) {
        return NextResponse.json({
          success: true,
          action: 'resend-failed',
          processed: 0,
          sent: 0,
          failed: 0,
          remainingFailed: 0,
          failedEmails: [],
          message: 'No failed recipients to resend',
        })
      }

      const toProcess = failedRecipients.slice(0, limit)
      const untouched = failedRecipients.slice(limit)

      let sent = 0
      let failed = 0
      const failedAgain: FailedRecipient[] = []

      for (const recipient of toProcess) {
        const ok = await emailService.sendRegistrationIssueAnnouncement({
          email: recipient.email,
          name: recipient.name || 'User',
          overrides: effectiveOverrides,
        })

        if (ok) {
          sent++
        } else {
          failed++
          failedAgain.push(recipient)
        }

        if (delayMs > 0) {
          await sleep(delayMs)
        }
      }

      const remaining = [...failedAgain, ...untouched]
      await setStoredFailedRecipients(remaining)

      return NextResponse.json({
        success: true,
        action: 'resend-failed',
        processed: toProcess.length,
        sent,
        failed,
        remainingFailed: remaining.length,
        failedEmails: failedAgain.slice(0, 100).map(item => item.email),
        message: 'Resend to failed recipients completed',
      })
    }

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
    const failedRecipients: FailedRecipient[] = []

    for (const user of users) {
      const email = String(user.email || '').trim()
      if (!email) {
        failed++
        continue
      }

      const ok = await emailService.sendRegistrationIssueAnnouncement({
        email,
        name: user.name || user.displayName || 'User',
        overrides: effectiveOverrides,
      })

      if (ok) {
        sent++
      } else {
        failed++
        failedEmails.push(email)
        failedRecipients.push({
          email,
          name: user.name || user.displayName || 'User',
        })
      }

      if (delayMs > 0) {
        await sleep(delayMs)
      }
    }

    await setStoredFailedRecipients(failedRecipients)

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
