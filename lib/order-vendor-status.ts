import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { Store } from '@/lib/models/Store'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { releaseEscrowForOrder, updateOrder } from '@/lib/mongodb-operations'
import { sendOrderStatusChangeNotifications } from '@/lib/order-notifications'
import { estimateShippingFee } from '@/lib/aco-logistics-rates'
import type { LogisticsRegionConfig } from '@/lib/logistics-access'

export const ALLOWED_VENDOR_STATUSES = new Set([
  'pending',
  'confirmed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'received',
  'cancelled',
])

export async function resolveOrderVendorTarget(orderId: string, vendorId: string, storeId: string) {
  await connectToDatabase()
  const existingOrder = await Order.findOne({ orderId }).lean()
  if (!existingOrder) return null

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

  return { existingOrder, targetStore, targetStoreId, targetVendorId }
}

/**
 * Advances an order (or a single vendor leg of it) to a new status, rolling the
 * whole order forward once every leg agrees, sending customer/vendor notifications,
 * crediting the region's logistics-partner wallet on delivery, and releasing escrow
 * on 'received'. Shared by the logistics-dashboard PATCH route and the rider
 * status-update route so both trigger the same side effects.
 */
export async function applyOrderVendorStatus(params: {
  orderId: string
  vendorId?: string
  storeId?: string
  status: string
  // Only needed for the 'delivered' branch's logistics-wallet credit — the customer
  // "confirm receipt" path only ever requests 'received' and never touches these.
  region?: LogisticsRegionConfig
  existingOrder: any
  targetStore?: any
}) {
  const { orderId, status: requestedStatus, region, existingOrder, targetStore } = params
  const vendorId = String(params.vendorId || '').trim()
  const storeId = String(params.storeId || '').trim()

  const now = new Date()
  const timestampUpdates: Record<string, Date> = {}

  if (requestedStatus === 'confirmed') timestampUpdates.confirmedAt = now
  if (requestedStatus === 'shipped') timestampUpdates.shippedAt = now
  if (requestedStatus === 'out_for_delivery') timestampUpdates.outForDeliveryAt = now
  if (requestedStatus === 'delivered') timestampUpdates.deliveredAt = now
  if (requestedStatus === 'received') timestampUpdates.receivedAt = now
  if (requestedStatus === 'cancelled') timestampUpdates.cancelledAt = now

  let updatedOrder: any = null
  // Whether every active vendor leg now agrees on requestedStatus — i.e. this is a
  // whole-order transition, not just one vendor's leg. Starts true for the no-vendorId
  // (whole-order) path below; only the per-vendor branch can set it false.
  let allActiveVendorsAgree = true

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

      // Cancelled legs must not count against the rollup — otherwise a partially
      // cancelled order can never reach 'received' for the vendor(s) who actually
      // fulfilled their part, permanently stranding their payout in escrow.
      const activeVendorStatuses = (Array.isArray((updated as any).vendors) ? (updated as any).vendors : [])
        .map((entry: any) => String(entry?.status || '').trim().toLowerCase())
        .filter((value: string) => Boolean(value) && value !== 'cancelled')

      allActiveVendorsAgree = activeVendorStatuses.length > 0
        && activeVendorStatuses.every((value: string) => value === requestedStatus.toLowerCase())

      if (allActiveVendorsAgree) {
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

  if (!updatedOrder) return null

  try {
    await sendOrderStatusChangeNotifications(orderId, updatedOrder, requestedStatus)
  } catch (notifyErr) {
    console.error('[order-status-notification] Failed:', notifyErr)
  }

  if (requestedStatus === 'delivered' && region) {
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

  // allActiveVendorsAgree guards this — without it, a partial per-vendor update (only
  // some legs reached 'received') would still read the order's top-level paymentStatus
  // as 'escrow' (that field is untouched by a partial update) and release the *whole*
  // order's escrow after just one vendor's leg was confirmed.
  if (requestedStatus === 'received' && allActiveVendorsAgree) {
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

  return updatedOrder
}
