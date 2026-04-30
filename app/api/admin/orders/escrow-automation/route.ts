import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { releaseEscrowForOrder, updateOrder } from '@/lib/mongodb-operations'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'
import { emailService } from '@/lib/email'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000

const getEscrowLinkSecret = () => {
  return String(
    process.env.ESCROW_LINK_SECRET
    || process.env.CRON_SECRET
    || process.env.ADMIN_SECRET
    || process.env.XORO_PAY_SECRET_KEY
    || ''
  ).trim()
}

const signEscrowToken = (
  orderId: string,
  customerId: string,
  paymentReference: string,
  expiresAt: string
) => {
  const secret = getEscrowLinkSecret()
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}:${customerId}:${paymentReference}:${expiresAt}`)
    .digest('hex')
}

const formatNaira = (amount: number) => `₦${Number(amount || 0).toLocaleString('en-NG')}`

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

const getReleaseWindowLabel = (deliveryType: string) => {
  return String(deliveryType || '').toLowerCase() === 'local' ? '14 hours' : '3 days'
}

const trySendReceiptReminder = async (order: any) => {
  const orderId = String(order?.orderId || '')
  const customerId = String(order?.customerId || '')
  const customerEmail = String(order?.shippingInfo?.email || '').trim()
  const releaseAt = order?.escrowReleaseAt ? new Date(order.escrowReleaseAt) : null
  const releaseAtText = releaseAt ? releaseAt.toLocaleString('en-NG') : 'scheduled release window'
  const releaseWindow = getReleaseWindowLabel(String(order?.deliveryType || ''))
  const paymentReference = String(order?.paymentReference || '')

  if (!orderId || !customerId) return false
  if (!paymentReference) return false

  const receiptLink = buildReceiptLink({ orderId, customerId, paymentReference })

  let emailSent = false

  if (customerEmail) {
    emailSent = await emailService.sendEmail({
      to: customerEmail,
      subject: `Did you receive order #${orderId.slice(0, 8).toUpperCase()}?`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Have you received your order?</h2>
          <p>Your payment of <strong>${formatNaira(Number(order?.totalAmount || 0))}</strong> is secured in escrow.</p>
          <p>If you have received your order, tap the button below to confirm receipt and release vendor funds immediately.</p>
          <p><a href="${receiptLink}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;">Confirm Receipt</a></p>
          <p>If you do nothing and no dispute is raised, funds will auto-release in <strong>${releaseWindow}</strong> at <strong>${releaseAtText}</strong>.</p>
          <p>If there is an issue, raise a dispute before release.</p>
        </div>
      `,
      text: `Have you received order #${orderId.slice(0, 8).toUpperCase()}? Confirm receipt: ${receiptLink}. Auto-release in ${releaseWindow} at ${releaseAtText} if no dispute is raised.`,
    })
  }

  return emailSent
}

const processEscrowOrders = async () => {
  const now = Date.now();
  // Escrow auto-release logic
  const orders = await Order.find({ paymentStatus: 'escrow' }).limit(500).lean();

  let reminderSent = 0;
  let released = 0;
  let disputedSkipped = 0;
  let autoCancelled = 0;

  for (const order of orders as any[]) {
    const isDisputed = Boolean(order?.disputeRaisedAt) || String(order?.disputeStatus || '').toLowerCase() === 'active';
    if (isDisputed) {
      disputedSkipped += 1;
      continue;
    }

    const paidAtMs = new Date(order?.paidAt || 0).getTime();
    const reminderAlreadySent = Boolean(order?.escrowReminderSentAt);

    if (!reminderAlreadySent && Number.isFinite(paidAtMs) && now - paidAtMs >= FIVE_HOURS_MS) {
      const sent = await trySendReceiptReminder(order);
      if (sent) {
        await Order.updateOne(
          { _id: order._id, paymentStatus: 'escrow' },
          { $set: { escrowReminderSentAt: new Date(), updatedAt: new Date() } }
        );
        reminderSent += 1;
      }
    }

    const releaseAtMs = new Date(order?.escrowReleaseAt || 0).getTime();
    if (!Number.isFinite(releaseAtMs) || releaseAtMs > now) {
      continue;
    }

    const releaseResult: any = await releaseEscrowForOrder(String(order.orderId || ''), {
      paymentReference: String(order?.paymentReference || ''),
      provider: String(order?.paymentMethod || ''),
      source: 'escrow_auto_release',
    });

    if (releaseResult?.success) {
      await updateOrder(String(order.orderId || ''), {
        paymentStatus: 'released',
        status: 'completed',
        confirmedAt: new Date(),
        receivedAt: order?.receivedAt || new Date(),
      });
      released += 1;
    }
  }

  // Auto-cancel logic for unconfirmed orders (pending or pending_payment > 24h)
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
  const staleOrders = await Order.find({
    status: { $in: ['pending', 'pending_payment'] },
    createdAt: { $lte: cutoff },
    cancelledAt: { $exists: false },
  }).limit(200).lean();

  for (const order of staleOrders as any[]) {
    await updateOrder(String(order.orderId || ''), {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancel_reason: 'Auto-cancelled after 24h without confirmation/payment',
    });
    autoCancelled += 1;
    // Optionally: send cancellation email/notification here
  }

  return {
    totalScanned: orders.length,
    reminderSent,
    released,
    disputedSkipped,
    autoCancelled,
    staleOrdersChecked: staleOrders.length,
  };
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
