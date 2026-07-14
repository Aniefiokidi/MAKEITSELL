import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { User } from '@/lib/models/User'
import { Store } from '@/lib/models/Store'
import { RiderAssignment } from '@/lib/models/RiderAssignment'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { estimateShippingFee } from '@/lib/aco-logistics-rates'
import { logisticsEmailAllowedForRegion, resolveLogisticsRegion, storeMatchesLogisticsRegion } from '@/lib/logistics-access'

export async function GET(request: NextRequest) {
  try {
    const view = String(request.nextUrl.searchParams.get('view') || 'active').toLowerCase()
    const resolvedView = view === 'received' ? 'received' : 'active'
    const region = resolveLogisticsRegion(request.nextUrl.searchParams.get('region'))

    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!logisticsEmailAllowedForRegion(sessionUser.email, region)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectToDatabase()

    const ordersRaw = await Order.find({ status: { $ne: 'cancelled' } })
      .sort({ createdAt: -1 })
      .lean()

    const candidateOrders = ordersRaw || []

    const customerIds = Array.from(new Set(candidateOrders.map((order: any) => String(order.customerId || '')).filter(Boolean)))

    const vendorIds = new Set<string>()
    const storeIds = new Set<string>()
    const storeNameHints = new Set<string>()

    for (const order of candidateOrders) {
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

    // Order data can contain malformed/legacy ids (e.g. from data-migration bugs or test
    // records) that aren't valid ObjectIds — filter before querying _id fields so one bad
    // order can't 500 the whole dashboard for every order in the region.
    const validCustomerIds = customerIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
    const validVendorIds = Array.from(vendorIds).filter((id) => mongoose.Types.ObjectId.isValid(id))
    const validStoreIds = Array.from(storeIds).filter((id) => mongoose.Types.ObjectId.isValid(id))

    const storeLookupOr: any[] = []
    if (validStoreIds.length > 0) storeLookupOr.push({ _id: { $in: validStoreIds } })
    if (vendorIds.size > 0) storeLookupOr.push({ vendorId: { $in: Array.from(vendorIds) } })
    if (storeNameHints.size > 0) {
      storeLookupOr.push({ storeName: { $in: Array.from(storeNameHints).map((name) => new RegExp(`^${name}$`, 'i')) } })
    }

    const [customers, vendors, stores] = await Promise.all([
      validCustomerIds.length > 0 ? User.find({ _id: { $in: validCustomerIds } }).lean() : Promise.resolve([]),
      validVendorIds.length > 0 ? User.find({ _id: { $in: validVendorIds } }).lean() : Promise.resolve([]),
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

    for (const order of candidateOrders) {
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
        if (!storeMatchesLogisticsRegion(store, region)) {
          continue
        }

        const pickupPhone = store?.phone || 'No pickup phone'
        const storeName = store?.storeName || vendorEntry?.vendorName || 'Unknown store'
        const storeOwnerName = vendor?.name || vendor?.displayName || 'Unknown owner'
        const shippingFee = estimateShippingFee({
          pickupAddress: pickupLocation,
          dropoffAddress: dropoffLocation,
          pickupCity: String(store?.city || ''),
          pickupState: String(store?.state || ''),
          dropoffCity: String(order?.shippingInfo?.city || ''),
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

    const filteredRows = logisticsRows.filter((row) => {
      const status = String(row?.orderStatus || '').trim().toLowerCase()
      if (resolvedView === 'received') {
        return status === 'received'
      }
      return status !== 'received' && status !== 'cancelled'
    })

    const rowIds = filteredRows.map((row) => row.rowId)
    if (rowIds.length > 0) {
      const assignments = await RiderAssignment.find({ rowId: { $in: rowIds } })
        .select('rowId riderName status')
        .lean()
      const assignmentByRowId = new Map<string, any>()
      for (const assignment of assignments as any[]) {
        assignmentByRowId.set(String(assignment.rowId), assignment)
      }
      for (const row of filteredRows as any[]) {
        const assignment = assignmentByRowId.get(row.rowId)
        row.assignedRiderName = assignment?.riderName || null
        row.riderAssignmentStatus = assignment?.status || null
      }
    }

    return NextResponse.json({
      success: true,
      count: filteredRows.length,
      keyword: region.keyword,
      view: resolvedView,
      region: region.key,
      orders: filteredRows,
    })
  } catch (error) {
    console.error('Error fetching logistics orders:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch logistics orders' }, { status: 500 })
  }
}
