import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'
import { emailService } from '@/lib/email'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000
const NINETY_SIX_HOURS_MS = 96 * 60 * 60 * 1000

// Statuses that mean the order was fulfilled — no refund needed
const FULFILLED_STATUSES = new Set(['delivered', 'received', 'completed'])
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
        <p>If we do not hear from you, your payment will be automatically refunded to your wallet after <strong>96 hours</strong>.</p>
        <p>If there is an issue with your order, please raise a dispute before then.</p>
      </div>
    `,
    text: `Have you received order #${orderId.slice(0, 8).toUpperCase()}? Confirm receipt: ${receiptLink}. If you do not respond within 96 hours, we will refund your payment to your wallet.`,
  })
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

    // 96-hour auto-refund: order not fulfilled → refund to customer wallet
    if (!Number.isFinite(paidAtMs) || now - paidAtMs < NINETY_SIX_HOURS_MS) continue
    if (FULFILLED_STATUSES.has(orderStatus)) continue

    const customerId = String(order.customerId || '')

    // A multi-vendor order can have already had one vendor's leg individually
    // cancelled and refunded (see app/api/orders/cancel/route.ts) while another
    // vendor's leg is still active — refunding the full original totalAmount here
    // would refund that already-cancelled portion a second time. Only the active
    // (non-cancelled) vendors' totals are still genuinely at stake.
    const vendorEntries: any[] = Array.isArray(order.vendors) ? order.vendors : []
    const hasCancelledLeg = vendorEntries.some((v) => String(v?.status || '').toLowerCase() === 'cancelled')
    const refundAmount = hasCancelledLeg
      ? vendorEntries
          .filter((v) => String(v?.status || '').toLowerCase() !== 'cancelled')
          .reduce((sum, v) => sum + Number(v?.total || 0), 0)
      : Number(order.totalAmount || 0)
    if (!customerId || refundAmount <= 0) continue

    // Idempotent reference — safe to run multiple times
    const refundReference = `ESCROW-REFUND-${order.orderId}`

    try {
      const tx = await WalletTransaction.updateOne(
        { reference: refundReference },
        {
          $setOnInsert: {
            userId: customerId,
            type: 'escrow_refund',
            amount: refundAmount,
            status: 'completed',
            reference: refundReference,
            paymentReference: String(order.paymentReference || refundReference),
            provider: 'escrow_auto_refund',
            note: `Escrow refund — order #${order.orderId} not completed within 96 hours`,
            metadata: { source: 'escrow_auto_refund', orderId: order.orderId },
            orderId: order.orderId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      )

      // upsertedCount === 0 means this refund already ran
      if ((tx as any).upsertedCount === 0) continue

      // Credit customer wallet
      await User.updateOne(
        { _id: customerId },
        { $inc: { walletBalance: refundAmount }, $set: { updatedAt: new Date() } }
      )

      // Mark order as refunded
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            status: 'refunded',
            paymentStatus: 'refunded',
            refundedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      )

      // Send refund email to customer
      const customerEmail = String(order?.shippingInfo?.email || '').trim()
      const customerName =
        `${String(order?.shippingInfo?.firstName || '').trim()} ${String(order?.shippingInfo?.lastName || '').trim()}`.trim() ||
        'Customer'

      if (customerEmail) {
        try {
          await emailService.sendEscrowRefundEmail({
            to: customerEmail,
            customerName,
            orderId: order.orderId,
            refundAmount,
          })
        } catch (emailErr) {
          console.error('[escrow-automation] Refund email failed for order:', order.orderId, emailErr)
        }
      }

      autoRefunded += 1
    } catch (err) {
      console.error('[escrow-automation] Refund failed for order:', order.orderId, err)
    }
  }

  // Auto-cancel orders stuck in pending/pending_payment for > 24h
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const staleOrders = await Order.find({
    status: { $in: ['pending', 'pending_payment'] },
    createdAt: { $lte: cutoff },
    cancelledAt: { $exists: false },
  })
    .limit(200)
    .lean()

  for (const order of staleOrders as any[]) {
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancel_reason: 'Auto-cancelled after 24h without payment',
          updatedAt: new Date(),
        },
      }
    )
    autoCancelled += 1
  }

  return {
    totalScanned: orders.length,
    reminderSent,
    autoRefunded,
    disputedSkipped,
    autoCancelled,
    staleOrdersChecked: staleOrders.length,
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const summary = await processEscrowOrders()
    return NextResponse.json({ success: true, summary })
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
