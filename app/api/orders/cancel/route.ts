import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { connectToDatabase } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { getUserBySessionToken } from '@/lib/auth'
import { sendOrderStatusChangeNotifications } from '@/lib/order-notifications'
import { cancelShipbubbleShipment } from '@/lib/shipbubble'
import mongoose from 'mongoose'

// Best-effort — Shipbubble only allows cancelling before the courier's processing date,
// so a failure here shouldn't block the refund/cancellation the customer is waiting on.
async function bestEffortCancelShipment(shipbubbleOrderId: unknown, context: string) {
  const id = String(shipbubbleOrderId || '').trim()
  if (!id) return
  try {
    const ok = await cancelShipbubbleShipment(id)
    if (!ok) console.error(`[orders/cancel] Shipbubble cancel returned false for ${context} (shipbubbleOrderId=${id})`)
  } catch (err) {
    console.error(`[orders/cancel] Shipbubble cancel failed for ${context} (shipbubbleOrderId=${id}):`, err)
  }
}

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

    const body = await request.json()
    const orderId = String(body?.orderId || '').trim()
    const vendorId = String(body?.vendorId || '').trim()
    const storeId = String(body?.storeId || '').trim()
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

    const vendorEntries: any[] = Array.isArray(order.vendors) ? order.vendors : []
    const hasMultipleVendorLegs = vendorEntries.length > 1

    // Multi-vendor orders: cancel only the one vendor's leg the caller identified. The
    // old whole-order cancel below would otherwise refund the full order total and
    // cancel every vendor's items, even ones already shipped by a different vendor.
    if ((vendorId || storeId) && hasMultipleVendorLegs) {
      const targetEntry = vendorEntries.find((entry) =>
        (vendorId && String(entry?.vendorId || '') === vendorId) ||
        (storeId && String(entry?.storeId || '') === storeId)
      )
      if (!targetEntry) {
        return NextResponse.json({ success: false, error: 'That item was not found on this order' }, { status: 404 })
      }

      const targetVendorId = String(targetEntry.vendorId || vendorId)
      const targetStoreId = String(targetEntry.storeId || storeId)
      const legStatus = String(targetEntry.status || order.status || '').toLowerCase()
      if (NON_CANCELLABLE.has(legStatus)) {
        return NextResponse.json({
          success: false,
          error: legStatus === 'out_for_delivery'
            ? 'This item is already out for delivery and cannot be cancelled.'
            : `This item cannot be cancelled (status: ${legStatus}).`,
        }, { status: 400 })
      }

      const refundAmount = Number(targetEntry.total || 0)
      const paymentStatus = String(order.paymentStatus || '')
      const shouldRefund = ['escrow', 'completed', 'paid'].includes(paymentStatus) && refundAmount > 0

      // Was this the last vendor leg still active? If so the order as a whole is done.
      const remainingActiveLegs = vendorEntries.filter((entry) => {
        const isTarget = (vendorId && String(entry?.vendorId || '') === vendorId) ||
          (storeId && String(entry?.storeId || '') === storeId)
        if (isTarget) return false
        return String(entry?.status || '').toLowerCase() !== 'cancelled'
      })
      const isLastActiveLeg = remainingActiveLegs.length === 0

      const session = await mongoose.startSession()
      try {
        await session.withTransaction(async () => {
          if (shouldRefund) {
            // Deterministic reference (unlike a random suffix) so a retried or
            // double-clicked request can't refund the same vendor leg twice.
            const refundReference = `CANCEL-${orderId}-${targetVendorId || targetStoreId || 'leg'}`
            const refundResult = await WalletTransaction.updateOne(
              { reference: refundReference },
              {
                $setOnInsert: {
                  userId: String(order.customerId),
                  type: 'topup',
                  amount: refundAmount,
                  status: 'completed',
                  reference: refundReference,
                  paymentReference: String(order.paymentReference || refundReference),
                  provider: 'order_cancellation',
                  note: `Refund for cancelled item on order #${orderId}`,
                  metadata: { source: 'customer_cancellation', orderId, vendorId: targetVendorId, storeId: targetStoreId },
                  orderId,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              },
              { upsert: true, session }
            )

            if ((refundResult as any).upsertedCount > 0) {
              await User.updateOne(
                { _id: order.customerId },
                { $inc: { walletBalance: refundAmount }, $set: { updatedAt: new Date() } },
                { session }
              )
            }
          }

          const arrayFilter: any = {}
          if (targetVendorId) arrayFilter['entry.vendorId'] = targetVendorId
          if (targetStoreId) arrayFilter['entry.storeId'] = targetStoreId

          const vendorSet: any = { 'vendors.$[entry].status': 'cancelled', 'vendors.$[entry].cancelledAt': new Date() }
          const topLevelSet: any = { updatedAt: new Date() }
          if (isLastActiveLeg) {
            topLevelSet.status = 'cancelled'
            topLevelSet.cancelledAt = new Date()
            if (shouldRefund) topLevelSet.paymentStatus = 'refunded'
          }

          await Order.updateOne(
            { orderId },
            { $set: { ...vendorSet, ...topLevelSet } },
            { arrayFilters: [arrayFilter], session }
          )
        })
      } finally {
        await session.endSession()
      }

      await bestEffortCancelShipment(targetEntry.shipbubbleOrderId, `order ${orderId} vendor ${targetVendorId}`)

      try {
        const updatedOrder = await Order.findOne({ orderId }).lean()
        if (updatedOrder) {
          await sendOrderStatusChangeNotifications(orderId, updatedOrder as any, 'cancelled')
        }
      } catch (notifyErr) {
        console.error('[orders/cancel] Email notification failed:', notifyErr)
      }

      return NextResponse.json({
        success: true,
        refunded: shouldRefund,
        refundAmount: shouldRefund ? refundAmount : 0,
        message: shouldRefund
          ? `Item cancelled. ₦${refundAmount.toLocaleString('en-NG')} has been refunded to your wallet.`
          : 'Item cancelled successfully.',
      })
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
          // Deterministic reference — same reasoning as the per-vendor path above.
          const refundReference = `CANCEL-${orderId}`

          const refundResult = await WalletTransaction.updateOne(
            { reference: refundReference },
            {
              $setOnInsert: {
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
              },
            },
            { upsert: true, session }
          )

          if ((refundResult as any).upsertedCount > 0) {
            await User.updateOne(
              { _id: order.customerId },
              { $inc: { walletBalance: refundAmount }, $set: { updatedAt: new Date() } },
              { session }
            )
          }

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

    await Promise.all(
      vendorEntries.map((entry) =>
        bestEffortCancelShipment(entry?.shipbubbleOrderId, `order ${orderId} vendor ${entry?.vendorId || ''}`)
      )
    )

    // Send cancellation emails to customer and all vendors
    try {
      const updatedOrder = await Order.findOne({ orderId }).lean()
      if (updatedOrder) {
        await sendOrderStatusChangeNotifications(orderId, updatedOrder as any, 'cancelled')
      }
    } catch (notifyErr) {
      console.error('[orders/cancel] Email notification failed:', notifyErr)
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
