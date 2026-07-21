import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { connectToDatabase } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { getUserBySessionToken } from '@/lib/auth'
import { emailService } from '@/lib/email'
import { enforceRateLimit } from '@/lib/rate-limit'

const VALID_REASONS = new Set([
  'item_not_received',
  'item_damaged',
  'item_different',
  'other',
])

const REASON_LABELS: Record<string, string> = {
  item_not_received: 'Item not received',
  item_damaged: 'Item arrived damaged',
  item_different: 'Item different from description',
  other: 'Other issue',
}

const LOGO_URL = 'https://res.cloudinary.com/dgqxt06km/image/upload/q_auto/f_auto/v1778221830/logo_2_ovdgjg.png'

async function notifySupportOfDispute(params: {
  orderId: string
  customerEmail: string
  reasonLabel: string
  description: string
  evidenceCount: number
}) {
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@makeitsell.ng'
  const shortOrderId = params.orderId.slice(0, 8).toUpperCase()

  try {
    await emailService.sendEmail({
      to: supportEmail,
      subject: `New Dispute — Order #${shortOrderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
          <div style="background: #ffffff; padding: 20px; text-align: center; border-bottom: 3px solid #7f1d1d;">
            <img src="${LOGO_URL}" alt="Make It Sell" style="height: 44px; width: auto; display: block; margin: 0 auto;" />
          </div>
          <div style="background: #7f1d1d; color: #fff; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px;">New Dispute Raised</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.92;">Order #${shortOrderId}</p>
          </div>
          <div style="padding: 24px;">
            <p style="margin: 0 0 6px 0;"><strong>Customer:</strong> ${params.customerEmail}</p>
            <p style="margin: 0 0 6px 0;"><strong>Reason:</strong> ${params.reasonLabel}</p>
            <p style="margin: 0 0 6px 0;"><strong>Evidence photos:</strong> ${params.evidenceCount}</p>
            <div style="background: #f7f7f8; border: 1px solid #ececec; border-radius: 8px; padding: 14px; margin-top: 12px;">
              <p style="margin: 0; white-space: pre-wrap;">${params.description || '(no description provided)'}</p>
            </div>
            <p style="margin-top: 16px; color: #6b7280; font-size: 13px;">Escrow release is frozen while this dispute is active. Review it in the admin dashboard's Disputed Escrow Orders panel.</p>
          </div>
        </div>
      `,
      text: `New dispute for order #${shortOrderId} from ${params.customerEmail}. Reason: ${params.reasonLabel}. Evidence photos: ${params.evidenceCount}. Description: ${params.description || '(none)'}`,
    })
  } catch (err) {
    console.error('[dispute] Failed to notify support:', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await enforceRateLimit(request, {
      key: 'orders-dispute',
      maxRequests: 5,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const sessionUser = await getUserBySessionToken(sessionToken)
    if (!sessionUser?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const orderId = String(body?.orderId || '').trim()
    const reason = String(body?.reason || '').trim()
    const description = String(body?.description || '').trim().slice(0, 2000)
    const evidenceUrls = Array.isArray(body?.evidenceUrls)
      ? body.evidenceUrls.map((u: any) => String(u || '').trim()).filter(Boolean).slice(0, 5)
      : []

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 })
    }
    if (!VALID_REASONS.has(reason)) {
      return NextResponse.json({ success: false, error: 'A valid reason is required' }, { status: 400 })
    }
    if (!description) {
      return NextResponse.json({ success: false, error: 'Please describe the issue' }, { status: 400 })
    }

    await connectToDatabase()

    const order = await Order.findOne({ orderId }).lean() as any
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    if (String(order.customerId) !== String(sessionUser.id)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    const paymentStatus = String(order.paymentStatus || '').toLowerCase()
    if (paymentStatus !== 'escrow') {
      return NextResponse.json({
        success: false,
        error: 'Disputes can only be raised while payment is still held in escrow — this order has already been settled or refunded. Contact support directly for help.',
      }, { status: 400 })
    }

    const alreadyDisputed = Boolean(order.disputeRaisedAt) || String(order.disputeStatus || '').toLowerCase() === 'active'
    if (alreadyDisputed) {
      return NextResponse.json({ success: false, error: 'A dispute has already been raised for this order' }, { status: 400 })
    }

    await Order.updateOne(
      { orderId },
      {
        $set: {
          disputeStatus: 'active',
          disputeRaisedAt: new Date(),
          customerDisputeReason: reason,
          customerDisputeDescription: description,
          customerDisputeEvidence: evidenceUrls,
          customerDisputeSubmittedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    )

    void notifySupportOfDispute({
      orderId,
      customerEmail: String(order.shippingInfo?.email || sessionUser.email || ''),
      reasonLabel: REASON_LABELS[reason] || reason,
      description,
      evidenceCount: evidenceUrls.length,
    })

    return NextResponse.json({ success: true, message: 'Dispute submitted. Your payment is on hold while we review this.' })
  } catch (error: any) {
    console.error('Order dispute API error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Failed to submit dispute' }, { status: 500 })
  }
}
