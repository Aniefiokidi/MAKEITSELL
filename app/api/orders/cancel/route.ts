import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { connectToDatabase } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { getUserBySessionToken } from '@/lib/auth'
import crypto from 'crypto'
import mongoose from 'mongoose'

const NON_CANCELLABLE = new Set([
  'out_for_delivery',
  'delivered',
  'received',
  'cancelled',
  'refunded',
  'completed',
])

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const sessionUser = await getUserBySessionToken(sessionToken)
    if (!sessionUser?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId } = await request.json()
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 })
    }

    await connectToDatabase()

    const order = await Order.findOne({ orderId }).lean() as any
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    if (String(order.customerId) !== String(sessionUser.id)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    const status = String(order.status || '').toLowerCase()
    if (NON_CANCELLABLE.has(status)) {
      return NextResponse.json({
        success: false,
        error: status === 'out_for_delivery'
          ? 'This order is already out for delivery and cannot be cancelled.'
          : `This order cannot be cancelled (status: ${status}).`,
      }, { status: 400 })
    }

    const paymentStatus = String(order.paymentStatus || '')
    const shouldRefund = ['escrow', 'completed', 'paid'].includes(paymentStatus)
    const refundAmount = Number(order.totalAmount || 0)

    if (shouldRefund && refundAmount > 0) {
      const session = await mongoose.startSession()
      try {
        await session.withTransaction(async () => {
          const refundReference = `CANCEL-${orderId}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`

          await WalletTransaction.create([{
            userId: String(order.customerId),
            type: 'topup',
            amount: refundAmount,
            status: 'completed',
            reference: refundReference,
            paymentReference: String(order.paymentReference || refundReference),
            provider: 'order_cancellation',
            note: `Refund for cancelled order #${orderId}`,
            metadata: { source: 'customer_cancellation', orderId },
            orderId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }], { session })

          await User.updateOne(
            { _id: order.customerId },
            { $inc: { walletBalance: refundAmount }, $set: { updatedAt: new Date() } },
            { session }
          )

          await Order.updateOne(
            { orderId },
            { $set: { status: 'cancelled', paymentStatus: 'refunded', cancelledAt: new Date(), updatedAt: new Date() } },
            { session }
          )
        })
      } finally {
        await session.endSession()
      }
    } else {
      await Order.updateOne(
        { orderId },
        { $set: { status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() } }
      )
    }

    return NextResponse.json({
      success: true,
      refunded: shouldRefund && refundAmount > 0,
      refundAmount: shouldRefund ? refundAmount : 0,
      message: shouldRefund && refundAmount > 0
        ? `Order cancelled. ₦${refundAmount.toLocaleString('en-NG')} has been refunded to your wallet.`
        : 'Order cancelled successfully.',
    })
  } catch (error: any) {
    console.error('[orders/cancel]', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to cancel order' },
      { status: 500 }
    )
  }
}
