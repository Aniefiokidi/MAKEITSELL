import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { Store } from '@/lib/models/Store'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { releaseEscrowForOrder, updateOrder, getOrderById } from '@/lib/mongodb-operations'
import { sendOrderStatusChangeNotifications } from '@/lib/order-notifications'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { logisticsEmailAllowedForRegion, resolveLogisticsRegion, storeMatchesLogisticsRegion } from '@/lib/logistics-access'
import { estimateShippingFee } from '@/lib/aco-logistics-rates'

export async function PATCH(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId } = await context.params
    const body = await request.json().catch(() => ({}))
    const region = resolveLogisticsRegion(body?.region)

    if (!logisticsEmailAllowedForRegion(sessionUser.email, region)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const requestedStatus = String(body?.status || '').trim()
    const vendorId = String(body?.vendorId || '').trim()
    const storeId = String(body?.storeId || '').trim()

    const allowedStatuses = new Set([
      'pending',
      'confirmed',
      'shipped',
      'out_for_delivery',
      'delivered',
      'received',
      'cancelled',
    ])

    if (!orderId || !allowedStatuses.has(requestedStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid orderId or status' }, { status: 400 })
    }

    await connectToDatabase()

    const existingOrder = await Order.findOne({ orderId }).lean()
    if (!existingOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const vendorEntries = Array.isArray((existingOrder as any)?.vendors) ? (existingOrder as any).vendors : []

    const targetEntry = vendorEntries.find((entry: any) => {
      if (vendorId && String(entry?.vendorId || '') !== vendorId) return false
      if (storeId && String(entry?.storeId || '') !== storeId) return false
      return true
    }) || vendorEntries[0]

    const targetStoreId = String(targetEntry?.storeId || storeId || '').trim()
    const targetVendorId = String(targetEntry?.vendorId || vendorId || '').trim()

    let targetStore: any = null
    if (targetStoreId) {
      targetStore = await Store.findById(targetStoreId).lean()
    }
    if (!targetStore && targetVendorId) {
      targetStore = await Store.findOne({ vendorId: targetVendorId }).lean()
    }

    if (!storeMatchesLogisticsRegion(targetStore, region)) {
      return NextResponse.json({ success: false, error: `Only ${region.cityLabel} orders can be managed here` }, { status: 400 })
    }

    const now = new Date()
    const timestampUpdates: Record<string, Date> = {}

    if (requestedStatus === 'confirmed') timestampUpdates.confirmedAt = now
    if (requestedStatus === 'shipped') timestampUpdates.shippedAt = now
    if (requestedStatus === 'out_for_delivery') timestampUpdates.outForDeliveryAt = now
    if (requestedStatus === 'delivered') timestampUpdates.deliveredAt = now
    if (requestedStatus === 'received') timestampUpdates.receivedAt = now
    if (requestedStatus === 'cancelled') timestampUpdates.cancelledAt = now

    let updatedOrder: any = null

    if (vendorId || storeId) {
      const query: any = { orderId }
      const arrayFilter: any = {}

      if (vendorId) {
        query['vendors.vendorId'] = vendorId
        arrayFilter['entry.vendorId'] = vendorId
      }
      if (storeId) {
        query['vendors.storeId'] = storeId
        arrayFilter['entry.storeId'] = storeId
      }

      const vendorTimestampUpdates = Object.fromEntries(
        Object.entries(timestampUpdates).map(([key, value]) => [`vendors.$[entry].${key}`, value])
      )

      const updated = await Order.findOneAndUpdate(
        query,
        {
          $set: {
            'vendors.$[entry].status': requestedStatus,
            ...vendorTimestampUpdates,
          },
        },
        {
          new: true,
          arrayFilters: [arrayFilter],
        }
      ).lean()

      if (updated) {
        updatedOrder = updated

        const vendorStatuses = (Array.isArray(updated.vendors) ? updated.vendors : [])
          .map((entry: any) => String(entry?.status || '').trim().toLowerCase())
          .filter(Boolean)

        if (vendorStatuses.length > 0 && vendorStatuses.every((value: string) => value === requestedStatus.toLowerCase())) {
          updatedOrder = await updateOrder(orderId, {
            status: requestedStatus,
            ...timestampUpdates,
          })
        }
      }
    } else {
      updatedOrder = await updateOrder(orderId, {
        status: requestedStatus,
        ...timestampUpdates,
      })
    }


    if (!updatedOrder) {
      return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 })
    }

    // Send status change notification (customer & vendor)
    try {
      await sendOrderStatusChangeNotifications(orderId, updatedOrder, requestedStatus)
    } catch (notifyErr) {
      console.error('[order-status-notification] Failed:', notifyErr)
    }

    // Credit logistics wallet when order is marked delivered
    if (requestedStatus === 'delivered') {
      try {
        const order: any = existingOrder
        const pickupLocation = targetStore?.address || ''
        const dropoffLocation = [
          order?.shippingInfo?.address,
          order?.shippingInfo?.city,
          order?.shippingInfo?.state,
        ].filter(Boolean).join(', ')

        const fee = estimateShippingFee({
          pickupAddress: pickupLocation,
          dropoffAddress: dropoffLocation,
          pickupCity: String(targetStore?.city || ''),
          pickupState: String(targetStore?.state || ''),
          dropoffCity: String(order?.shippingInfo?.city || ''),
          dropoffState: String(order?.shippingInfo?.state || ''),
        })

        if (fee && fee > 0) {
          const logisticsUser = await User.findOne({
            email: { $regex: new RegExp(`^${region.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          }).lean()

          if (logisticsUser) {
            const logisticsUserId = String((logisticsUser as any)._id)
            const creditReference = `LOGISTICS-DELIVERY-${orderId}`

            const tx = await WalletTransaction.updateOne(
              { reference: creditReference },
              {
                $setOnInsert: {
                  userId: logisticsUserId,
                  type: 'logistics_delivery_credit',
                  amount: fee,
                  status: 'completed',
                  reference: creditReference,
                  provider: 'platform',
                  note: `Delivery credit for order #${orderId}`,
                  metadata: { source: 'logistics_delivery', orderId, region: region.key },
                  orderId,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              },
              { upsert: true }
            )

            if ((tx as any).upsertedCount > 0) {
              await User.updateOne(
                { _id: (logisticsUser as any)._id },
                { $inc: { walletBalance: fee }, $set: { updatedAt: new Date() } }
              )
            }
          }
        }
      } catch (walletErr) {
        console.error('[logistics-wallet] Credit failed for order:', orderId, walletErr)
      }
    }

    if (requestedStatus === 'received') {
      const paymentStatus = String((updatedOrder as any)?.paymentStatus || '').toLowerCase()
      const isDisputed = Boolean((updatedOrder as any)?.disputeRaisedAt)
        || String((updatedOrder as any)?.disputeStatus || '').toLowerCase() === 'active'

      if (paymentStatus === 'escrow' && !isDisputed) {
        await releaseEscrowForOrder(orderId, {
          paymentReference: String((updatedOrder as any)?.paymentReference || ''),
          provider: String((updatedOrder as any)?.paymentMethod || ''),
          source: 'logistics_received_confirmation',
        })

        updatedOrder = await updateOrder(orderId, {
          paymentStatus: 'released',
          status: 'completed',
          confirmedAt: new Date(),
        })
      }
    }

    return NextResponse.json({ success: true, order: updatedOrder })
  } catch (error) {
    console.error('Error updating logistics order status:', error)
    return NextResponse.json({ success: false, error: 'Failed to update status' }, { status: 500 })
  }
}
