import { processAfterSalesDeadlines, sendProtectionNotices } from '@/lib/after-sales'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'
import { emailService } from '@/lib/email'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'
import { releaseEscrowForOrder } from '@/lib/mongodb-operations'

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000

// Statuses that mean the order was fulfilled — no refund needed
// Statuses that are already terminal — skip entirely
const TERMINAL_STATUSES = new Set(['cancelled', 'refunded', 'delivered', 'received', 'completed'])

const getEscrowLinkSecret = () =>
  String(
    process.env.ESCROW_LINK_SECRET ||
    process.env.CRON_SECRET ||
    process.env.ADMIN_SECRET ||
    process.env.XORO_PAY_SECRET_KEY ||
    ''
  ).trim()

const signEscrowToken = (
  orderId: string,
  customerId: string,
  paymentReference: string,
  expiresAt: string
) =>
  crypto
    .createHmac('sha256', getEscrowLinkSecret())
    .update(`${orderId}:${customerId}:${paymentReference}:${expiresAt}`)
    .digest('hex')

const buildReceiptLink = ({
  orderId,
  customerId,
  paymentReference,
}: {
  orderId: string
  customerId: string
  paymentReference: string
}) => {
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const sig = signEscrowToken(orderId, customerId, paymentReference, expiresAt)
  const url = new URL('/api/orders/confirm-received-link', getCanonicalAppBaseUrl())
  url.searchParams.set('orderId', orderId)
  url.searchParams.set('customerId', customerId)
  url.searchParams.set('expiresAt', expiresAt)
  url.searchParams.set('sig', sig)
  return url.toString()
}

const trySendReceiptReminder = async (order: any) => {
  const orderId = String(order?.orderId || '')
  const customerId = String(order?.customerId || '')
  const customerEmail = String(order?.shippingInfo?.email || '').trim()
  const paymentReference = String(order?.paymentReference || '')

  if (!orderId || !customerId || !paymentReference) return false

  const receiptLink = buildReceiptLink({ orderId, customerId, paymentReference })
  const formatNaira = (n: number) => `₦${Number(n || 0).toLocaleString('en-NG')}`

  if (!customerEmail) return false

  return emailService.sendEmail({
    to: customerEmail,
    subject: `Did you receive order #${orderId.slice(0, 8).toUpperCase()}?`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Have you received your order?</h2>
        <p>Your payment of <strong>${formatNaira(Number(order?.totalAmount || 0))}</strong> is secured in escrow.</p>
        <p>If you have received your order, tap the button below to confirm receipt.</p>
        <p><a href="${receiptLink}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;">Confirm Receipt</a></p>
        <p>If we do not hear from you, your funds remain protected until verified delivery and the 48-hour clearance period.</p>
        <p>If there is an issue with your order, please raise a dispute before then.</p>
      </div>
    `,
    text: `Have you received order #${orderId.slice(0, 8).toUpperCase()}? Confirm receipt: ${receiptLink}. Seller payout requires verified delivery and a 48-hour clearance period. Report any issue from your order.`,
  })
}

// Clear independently verified items after their full hold, subject to active cases.
const processDeliveredOrderAutoRelease = async () => {
  const now = new Date()
  const orders = await Order.find({
    paymentStatus: 'escrow',
    'protectionLines.availableAt': { $lte: now },
  }).limit(500).lean()

  let released = 0

  for (const order of orders as any[]) {
    const isDisputed =
      Boolean(order?.disputeRaisedAt) ||
      String(order?.disputeStatus || '').toLowerCase() === 'active'
    if (isDisputed) continue

    try {
      const result = await releaseEscrowForOrder(order.orderId, {
        paymentReference: order.paymentReference,
        provider: order.paymentMethod,
        source: 'shipbubble_delivery_auto_release',
      })

      if (result?.success) {
        await Order.updateOne(
          { _id: order._id },
          { $set: { status: 'completed', confirmedAt: new Date() } }
        )
        released += 1
      }
    } catch (err) {
      console.error('[escrow-automation] Auto-release failed for order:', order.orderId, err)
    }
  }

  return { totalScanned: orders.length, released }
}

const processEscrowOrders = async () => {
  const now = Date.now()
  const orders = await Order.find({ paymentStatus: 'escrow' }).limit(500).lean()

  let reminderSent = 0
  let autoRefunded = 0
  let disputedSkipped = 0
  let autoCancelled = 0

  for (const order of orders as any[]) {
    const isDisputed =
      Boolean(order?.disputeRaisedAt) ||
      String(order?.disputeStatus || '').toLowerCase() === 'active'

    if (isDisputed) {
      disputedSkipped += 1
      continue
    }

    const orderStatus = String(order.status || '').toLowerCase()

    // Skip orders that are already in a terminal / fulfilled state
    if (TERMINAL_STATUSES.has(orderStatus)) continue

    const paidAtMs = new Date(order?.paidAt || 0).getTime()

    // 5-hour reminder: prompt customer to confirm receipt
    if (
      !order?.escrowReminderSentAt &&
      Number.isFinite(paidAtMs) &&
      now - paidAtMs >= FIVE_HOURS_MS
    ) {
      const sent = await trySendReceiptReminder(order)
      if (sent) {
        await Order.updateOne(
          { _id: order._id, paymentStatus: 'escrow' },
          { $set: { escrowReminderSentAt: new Date(), updatedAt: new Date() } }
        )
        reminderSent += 1
      }
    }

    // Missing delivery data requires tracking review, never a refund based on silence.
  }

  // Expire abandoned unpaid checkouts only. The payment predicate is rechecked atomically.
  const staleResult = await Order.updateMany({ paymentStatus: 'pending', status: { $in: ['pending', 'pending_payment'] }, createdAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, cancelledAt: { $exists: false } }, { $set: { status: 'cancelled', cancelledAt: new Date() } })
  autoCancelled = staleResult.modifiedCount

  return {
    totalScanned: orders.length,
    reminderSent,
    autoRefunded,
    disputedSkipped,
    autoCancelled,
    staleOrdersChecked: 0,
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    await sendProtectionNotices()
    await processAfterSalesDeadlines()
    const releaseSummary = await processDeliveredOrderAutoRelease()
    const summary = await processEscrowOrders()
    return NextResponse.json({ success: true, summary: { ...summary, autoReleased: releaseSummary.released } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Escrow automation failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
