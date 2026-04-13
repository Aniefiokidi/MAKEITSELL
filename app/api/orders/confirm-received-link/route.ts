import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getOrderById, releaseEscrowForOrder, updateOrder } from '@/lib/mongodb-operations'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

const getEscrowLinkSecret = () => {
  return String(
    process.env.ESCROW_LINK_SECRET
    || process.env.CRON_SECRET
    || process.env.ADMIN_SECRET
    || process.env.XORO_PAY_SECRET_KEY
    || ''
  ).trim()
}

const signEscrowToken = (orderId: string, customerId: string, paymentReference: string, expiresAt: string) => {
  const secret = getEscrowLinkSecret()
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}:${customerId}:${paymentReference}:${expiresAt}`)
    .digest('hex')
}

const safeEqual = (a: string, b: string) => {
  const aBuf = Buffer.from(String(a || ''), 'utf8')
  const bBuf = Buffer.from(String(b || ''), 'utf8')
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const orderId = String(url.searchParams.get('orderId') || '').trim()
    const customerId = String(url.searchParams.get('customerId') || '').trim()
    const expiresAt = String(url.searchParams.get('expiresAt') || '').trim()
    const signature = String(url.searchParams.get('sig') || '').trim()

    if (!orderId || !customerId || !expiresAt || !signature) {
      return NextResponse.json({ success: false, error: 'Invalid confirmation link' }, { status: 400 })
    }

    const secret = getEscrowLinkSecret()
    if (!secret) {
      return NextResponse.json({ success: false, error: 'Escrow link secret is missing' }, { status: 500 })
    }

    const expiryTime = new Date(expiresAt).getTime()
    if (!Number.isFinite(expiryTime) || expiryTime < Date.now()) {
      return NextResponse.json({ success: false, error: 'Confirmation link has expired' }, { status: 400 })
    }

    const order: any = await getOrderById(orderId)
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    if (String(order.customerId || '') !== customerId) {
      return NextResponse.json({ success: false, error: 'Order/customer mismatch' }, { status: 403 })
    }

    const paymentReference = String(order?.paymentReference || '')
    if (!paymentReference) {
      return NextResponse.json({ success: false, error: 'Order has no payment reference' }, { status: 400 })
    }

    const expected = signEscrowToken(orderId, customerId, paymentReference, expiresAt)
    if (!safeEqual(signature, expected)) {
      return NextResponse.json({ success: false, error: 'Invalid confirmation signature' }, { status: 403 })
    }

    const isDisputed = Boolean(order?.disputeRaisedAt) || String(order?.disputeStatus || '').toLowerCase() === 'active'
    if (isDisputed) {
      return NextResponse.json({ success: false, error: 'Order is disputed. Funds are frozen.' }, { status: 409 })
    }

    if (String(order.paymentStatus || '').toLowerCase() === 'escrow') {
      await updateOrder(orderId, { status: 'received', receivedAt: new Date() })
      await releaseEscrowForOrder(orderId, {
        paymentReference: String(order.paymentReference || ''),
        provider: String(order.paymentMethod || ''),
        source: 'customer_receipt_link',
      })
      await updateOrder(orderId, {
        paymentStatus: 'released',
        status: 'completed',
        confirmedAt: new Date(),
      })
    }

    const redirectUrl = new URL('/order-confirmation', getCanonicalAppBaseUrl(new URL(request.url).origin))
    redirectUrl.searchParams.set('orderId', orderId)
    redirectUrl.searchParams.set('escrow', 'released')
    return NextResponse.redirect(redirectUrl.toString())
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to confirm receipt' },
      { status: 500 }
    )
  }
}
