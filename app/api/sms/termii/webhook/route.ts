import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { SmsDeliveryLog } from '@/lib/models/SmsDeliveryLog'
import { requireAdminAccess } from '@/lib/server-route-auth'

function normalizeStatus(value: unknown): string {
  return String(value || '').trim()
}

function isDeliveredStatus(status: string): boolean {
  return status.toLowerCase() === 'delivered'
}

function isFailedStatus(status: string): boolean {
  const normalized = status.toLowerCase()
  return normalized === 'message failed' || normalized === 'failed' || normalized === 'rejected' || normalized === 'expired'
}

function verifySignature(rawBody: string, providedSignature: string, secret: string): boolean {
  if (!providedSignature || !secret) return false

  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(providedSignature.trim())

  if (expectedBuffer.length !== providedBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const payload = JSON.parse(rawBody || '{}')

    const signatureHeader = request.headers.get('x-termii-signature') || ''
    const signatureSecret = String(process.env.TERMII_WEBHOOK_SECRET || process.env.TERMII_API_KEY || '').trim()

    if (signatureSecret) {
      const valid = verifySignature(rawBody, signatureHeader, signatureSecret)
      if (!valid) {
        return NextResponse.json({ success: false, error: 'Invalid webhook signature' }, { status: 401 })
      }
    }

    const messageId = String(payload?.message_id || payload?.id || '').trim()
    if (!messageId) {
      return NextResponse.json({ success: false, error: 'message_id is required' }, { status: 400 })
    }

    const status = normalizeStatus(payload?.status)
    const sentAt = payload?.sent_at ? new Date(payload.sent_at) : undefined

    await connectToDatabase()

    const update: Record<string, any> = {
      provider: 'termii',
      messageId,
      sender: String(payload?.sender || ''),
      receiver: String(payload?.receiver || ''),
      message: String(payload?.message || ''),
      channel: String(payload?.channel || ''),
      status,
      cost: String(payload?.cost || ''),
      sentAt,
      rawPayload: payload,
      updatedAt: new Date(),
    }

    if (isDeliveredStatus(status)) {
      update.deliveredAt = new Date()
      update.failedAt = undefined
      update.failureReason = undefined
    } else if (isFailedStatus(status)) {
      update.failedAt = new Date()
      update.failureReason = status || 'Message failed'
    }

    await SmsDeliveryLog.updateOne(
      { messageId },
      {
        $set: update,
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[termii/webhook] Error:', error)
    return NextResponse.json({ success: false, error: 'Webhook processing failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(request.url)
    const messageId = String(searchParams.get('messageId') || '').trim()
    const receiver = String(searchParams.get('receiver') || '').trim()
    const status = String(searchParams.get('status') || '').trim()
    const limitParam = Number.parseInt(searchParams.get('limit') || '100', 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100

    const query: Record<string, any> = {}
    if (messageId) query.messageId = messageId
    if (receiver) query.receiver = receiver
    if (status) query.status = status

    await connectToDatabase()
    const logs = await SmsDeliveryLog.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()

    return NextResponse.json({
      success: true,
      count: logs.length,
      data: logs.map((log: any) => ({
        id: String(log?._id || ''),
        provider: log.provider,
        messageId: log.messageId,
        sender: log.sender,
        receiver: log.receiver,
        message: log.message,
        channel: log.channel,
        status: log.status,
        cost: log.cost,
        sentAt: log.sentAt,
        deliveredAt: log.deliveredAt,
        failedAt: log.failedAt,
        failureReason: log.failureReason,
        updatedAt: log.updatedAt,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to fetch SMS delivery logs' }, { status: 500 })
  }
}
