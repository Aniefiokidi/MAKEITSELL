import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { Store } from '@/lib/models/Store'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'
import { estimateShippingFee } from '@/lib/aco-logistics-rates'
import { storeMatchesLogisticsRegion, resolveLogisticsRegion } from '@/lib/logistics-access'

const lagosRegion = resolveLogisticsRegion('lagos')

function getWeekStart() {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - daysFromMonday)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

async function runBackfill() {
  const weekStart = getWeekStart()

  const acoUser = await User.findOne({
    email: { $regex: /^a&co@makeitselll\.org$/i },
  }).lean()

  if (!acoUser) throw new Error('A&CO user not found')

  const logisticsUserId = String((acoUser as any)._id)

  // All delivered/received/completed orders this week
  const orders = await Order.find({
    status: { $in: ['delivered', 'received', 'completed'] },
    $or: [
      { deliveredAt: { $gte: weekStart } },
      { receivedAt: { $gte: weekStart } },
      { updatedAt: { $gte: weekStart } },
    ],
  }).lean()

  // Load stores for all orders
  const storeIds = new Set<string>()
  const vendorIds = new Set<string>()
  for (const order of orders as any[]) {
    for (const v of Array.isArray(order.vendors) ? order.vendors : []) {
      if (v.storeId) storeIds.add(String(v.storeId))
      if (v.vendorId) vendorIds.add(String(v.vendorId))
    }
    for (const sid of Array.isArray(order.storeIds) ? order.storeIds : []) {
      storeIds.add(String(sid))
    }
  }

  const storeList = await Store.find({
    $or: [
      ...(storeIds.size > 0 ? [{ _id: { $in: Array.from(storeIds) } }] : []),
      ...(vendorIds.size > 0 ? [{ vendorId: { $in: Array.from(vendorIds) } }] : []),
    ],
  }).lean()

  const storeById = new Map<string, any>()
  const storeByVendorId = new Map<string, any>()
  for (const s of storeList as any[]) {
    storeById.set(String(s._id), s)
    if (s.vendorId) storeByVendorId.set(String(s.vendorId), s)
  }

  let credited = 0
  let alreadyDone = 0
  let skippedNoFee = 0
  let skippedNotLagos = 0
  const details: any[] = []

  for (const order of orders as any[]) {
    const orderId = (order as any).orderId || String((order as any)._id)
    const reference = `LOGISTICS-DELIVERY-${orderId}`

    // Idempotency check
    const existing = await WalletTransaction.findOne({ reference }).lean()
    if (existing) {
      alreadyDone++
      continue
    }

    // Determine the store for this order
    const vendors = Array.isArray((order as any).vendors) ? (order as any).vendors : []
    const firstVendor = vendors[0] || {}
    const store =
      storeById.get(String(firstVendor.storeId || '')) ||
      storeByVendorId.get(String(firstVendor.vendorId || '')) ||
      (Array.isArray((order as any).storeIds) && (order as any).storeIds[0]
        ? storeById.get(String((order as any).storeIds[0]))
        : null)

    // Only credit Lagos orders
    if (!storeMatchesLogisticsRegion(store, lagosRegion)) {
      skippedNotLagos++
      continue
    }

    const pickupAddress = store?.address || ''
    const dropoffLocation = [
      (order as any).shippingInfo?.address,
      (order as any).shippingInfo?.city,
      (order as any).shippingInfo?.state,
    ].filter(Boolean).join(', ')

    const fee = estimateShippingFee({
      pickupAddress,
      dropoffAddress: dropoffLocation,
      pickupCity: String(store?.city || ''),
      pickupState: String(store?.state || ''),
      dropoffCity: String((order as any).shippingInfo?.city || ''),
      dropoffState: String((order as any).shippingInfo?.state || ''),
    })

    // Fall back to totalAmount - itemsSubtotal if fee not estimable
    let finalFee = fee && fee > 0 ? fee : null
    if (!finalFee) {
      const itemsSubtotal = vendors.reduce((s: number, v: any) => s + Number(v.total || 0), 0)
      const derived = Number((order as any).totalAmount || 0) - itemsSubtotal
      if (derived > 0) finalFee = derived
    }

    if (!finalFee || finalFee <= 0) {
      skippedNoFee++
      continue
    }

    const deliveredAt = (order as any).deliveredAt || (order as any).receivedAt || new Date()

    await WalletTransaction.updateOne(
      { reference },
      {
        $setOnInsert: {
          userId: logisticsUserId,
          type: 'logistics_delivery_credit',
          amount: finalFee,
          status: 'completed',
          reference,
          provider: 'platform',
          note: `Delivery credit for order #${orderId}`,
          metadata: { source: 'backfill_aco_wallet', orderId, region: 'lagos' },
          orderId,
          createdAt: deliveredAt,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    )

    await User.updateOne(
      { _id: (acoUser as any)._id },
      { $inc: { walletBalance: finalFee }, $set: { updatedAt: new Date() } }
    )

    credited++
    details.push({ orderId, fee: finalFee })
  }

  const updatedUser = await User.findById((acoUser as any)._id).lean()
  const newBalance = Number((updatedUser as any)?.walletBalance || 0)

  return {
    weekStart: weekStart.toISOString(),
    ordersScanned: (orders as any[]).length,
    credited,
    alreadyDone,
    skippedNoFee,
    skippedNotLagos,
    newBalance,
    details,
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const summary = await runBackfill()
    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Backfill failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
