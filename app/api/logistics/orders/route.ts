import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { Store } from '@/lib/models/Store'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { estimateShippingFee } from '@/lib/aco-logistics-rates'

const LOGISTICS_USERNAME = 'A&CO@makeitselll.org'

function textContainsLagos(value: unknown): boolean {
  if (value == null) return false
  return String(value).toLowerCase().includes('lagos')
}

function orderMatchesLagos(order: any): boolean {
  // Requirement: scan typed fields for the word "lagos".
  const searchableBlob = [
    order?.shippingInfo,
    order?.shippingAddress,
    order?.items,
    order?.vendors,
    order,
  ]

  return searchableBlob.some((part) => textContainsLagos(JSON.stringify(part || {})))
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (String(sessionUser.email || '').toLowerCase() !== LOGISTICS_USERNAME.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectToDatabase()

    const ordersRaw = await Order.find({})
      .sort({ createdAt: -1 })
      .lean()

    const lagosOrders = (ordersRaw || []).filter(orderMatchesLagos)

    const customerIds = Array.from(new Set(lagosOrders.map((order: any) => String(order.customerId || '')).filter(Boolean)))

    const vendorIds = new Set<string>()
    const storeIds = new Set<string>()
    const storeNameHints = new Set<string>()

    for (const order of lagosOrders) {
      const vendors = Array.isArray(order?.vendors) ? order.vendors : []
      for (const vendor of vendors) {
        if (vendor?.vendorId) vendorIds.add(String(vendor.vendorId))
        if (vendor?.storeId) storeIds.add(String(vendor.storeId))
        if (vendor?.vendorName) storeNameHints.add(String(vendor.vendorName).trim().toLowerCase())
      }

      const itemList = Array.isArray(order?.items) ? order.items : []
      for (const item of itemList) {
        if (item?.vendorName) storeNameHints.add(String(item.vendorName).trim().toLowerCase())
      }

      const directStoreIds = Array.isArray(order?.storeIds) ? order.storeIds : []
      for (const sid of directStoreIds) {
        if (sid) storeIds.add(String(sid))
      }
    }

    const storeLookupOr: any[] = []
    if (storeIds.size > 0) storeLookupOr.push({ _id: { $in: Array.from(storeIds) } })
    if (vendorIds.size > 0) storeLookupOr.push({ vendorId: { $in: Array.from(vendorIds) } })
    if (storeNameHints.size > 0) {
      storeLookupOr.push({ storeName: { $in: Array.from(storeNameHints).map((name) => new RegExp(`^${name}$`, 'i')) } })
    }

    const [customers, vendors, stores] = await Promise.all([
      customerIds.length > 0 ? User.find({ _id: { $in: customerIds } }).lean() : Promise.resolve([]),
      vendorIds.size > 0 ? User.find({ _id: { $in: Array.from(vendorIds) } }).lean() : Promise.resolve([]),
      storeLookupOr.length > 0 ? Store.find({ $or: storeLookupOr }).lean() : Promise.resolve([]),
    ])

    const customerById = new Map<string, any>()
    for (const user of customers as any[]) {
      customerById.set(String(user?._id), user)
    }

    const vendorById = new Map<string, any>()
    for (const user of vendors as any[]) {
      vendorById.set(String(user?._id), user)
    }

    const storeById = new Map<string, any>()
    const storeByVendorId = new Map<string, any>()
    const storeByName = new Map<string, any>()
    for (const store of stores as any[]) {
      storeById.set(String(store?._id), store)
      if (store?.vendorId && !storeByVendorId.has(String(store.vendorId))) {
        storeByVendorId.set(String(store.vendorId), store)
      }
      const normalizedName = String(store?.storeName || '').trim().toLowerCase()
      if (normalizedName && !storeByName.has(normalizedName)) {
        storeByName.set(normalizedName, store)
      }
    }

    const logisticsRows: any[] = []

    for (const order of lagosOrders) {
      const customer = customerById.get(String(order.customerId || ''))
      const customerName = customer?.name || customer?.displayName || `${order?.shippingInfo?.firstName || ''} ${order?.shippingInfo?.lastName || ''}`.trim() || 'Unknown customer'

      const customerPhone = order?.shippingInfo?.phone || customer?.phone || ''
      const dropoffLocation = [
        order?.shippingInfo?.address,
        order?.shippingInfo?.city,
        order?.shippingInfo?.state,
        order?.shippingInfo?.country,
      ].filter(Boolean).join(', ')

      const deliveryInstructions = String(order?.shippingInfo?.deliveryInstructions || order?.shippingAddress?.instructions || '').trim()

      const vendorEntries = Array.isArray(order?.vendors) && order.vendors.length > 0
        ? order.vendors
        : [{
            vendorId: '',
            vendorName: '',
            storeId: Array.isArray(order?.storeIds) ? order.storeIds[0] : '',
            items: Array.isArray(order?.items) ? order.items : [],
          }]

      for (const vendorEntry of vendorEntries) {
        const vendor = vendorById.get(String(vendorEntry?.vendorId || ''))
        const normalizedVendorName = String(vendorEntry?.vendorName || '').trim().toLowerCase()
        const store =
          storeById.get(String(vendorEntry?.storeId || '')) ||
          storeByVendorId.get(String(vendorEntry?.vendorId || '')) ||
          storeByName.get(normalizedVendorName)

        const pickupLocation = store?.address || 'Pickup address not provided'
        const pickupPhone = store?.phone || 'No pickup phone'
        const storeName = store?.storeName || vendorEntry?.vendorName || 'Unknown store'
        const storeOwnerName = vendor?.name || vendor?.displayName || 'Unknown owner'
        const shippingFee = estimateShippingFee({
          pickupAddress: pickupLocation,
          dropoffAddress: dropoffLocation,
          dropoffState: String(order?.shippingInfo?.state || ''),
        })

        const items = Array.isArray(vendorEntry?.items) && vendorEntry.items.length > 0
          ? vendorEntry.items
          : (Array.isArray(order?.items) ? order.items : [])

        logisticsRows.push({
          rowId: `${String(order.orderId || '')}:${String(vendorEntry?.vendorId || vendorEntry?.storeId || storeName || '')}`,
          orderId: order.orderId,
          vendorId: String(vendorEntry?.vendorId || ''),
          storeId: String(vendorEntry?.storeId || ''),
          createdAt: order.createdAt,
          orderStatus: vendorEntry?.status || order.status || 'pending',
          paymentStatus: order.paymentStatus || 'pending',
          totalAmount: Number(order.totalAmount || 0),
          customerName,
          customerPhone,
          customerEmail: order?.shippingInfo?.email || customer?.email || '',
          storeName,
          storeOwnerName,
          pickupLocation,
          pickupPhone,
          dropoffLocation,
          dropoffPhone: customerPhone,
          shippingFee,
          shippingFeeLabel: shippingFee == null ? 'TBD' : `NGN ${shippingFee.toLocaleString()}`,
          instructions: deliveryInstructions || 'No instructions supplied',
          items,
        })
      }
    }

    return NextResponse.json({
      success: true,
      count: logisticsRows.length,
      keyword: 'lagos',
      orders: logisticsRows,
    })
  } catch (error) {
    console.error('Error fetching logistics orders:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch logistics orders' }, { status: 500 })
  }
}
