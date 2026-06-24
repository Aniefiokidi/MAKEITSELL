// Notify customer and vendors on any order status change
export async function sendOrderStatusChangeNotifications(orderId: string, order: OrderLike, newStatus: string) {
  const shippingInfo = order?.shippingInfo || {}
  const customerEmail = String(shippingInfo?.email || '').trim()
  const customerName = `${String(shippingInfo?.firstName || '').trim()} ${String(shippingInfo?.lastName || '').trim()}`.trim() || 'Customer'
  const allItems = Array.isArray(order?.items)
    ? order.items
    : (Array.isArray(order?.vendors) ? order.vendors.flatMap((v: any) => (Array.isArray(v?.items) ? v.items : [])) : [])
  const allItemsSubtotal = sumItems(allItems)
  const overallTotal = toNumber(order?.totalAmount || allItemsSubtotal)
  const overallDeliveryFee = Math.max(0, overallTotal - allItemsSubtotal)
  const vendors = buildVendorBuckets(order)

  // Email subject and message by status
  const statusLabels: Record<string, string> = {
    confirmed: 'Order Confirmed',
    shipped: 'Order Shipped',
    out_for_delivery: 'Order Out for Delivery',
    delivered: 'Order Delivered',
    received: 'Order Received',
    cancelled: 'Order Cancelled',
    pending: 'Order Pending',
    pending_payment: 'Order Pending Payment',
    processing: 'Order Processing',
    completed: 'Order Completed',
  }
  const statusLabel = statusLabels[newStatus] || `Order Status Updated: ${newStatus}`

  // Notify customer
  if (customerEmail) {
    await emailService.sendOrderStatusUpdateEmail({
      to: customerEmail,
      orderId,
      status: newStatus,
      statusLabel,
      customerName,
      vendorName: vendors.length === 1 ? vendors[0].vendorName : 'Multiple Vendors',
      items: allItems,
      total: overallTotal,
      productSubtotal: allItemsSubtotal,
      deliveryFee: overallDeliveryFee,
      shippingAddress: shippingInfo,
      role: 'customer',
    })
  }

  // Push to customer
  const statusCustomerId = String((order as any)?.customerId || (order as any)?.userId || '').trim()
  if (statusCustomerId) {
    const statusEmoji: Record<string, string> = {
      confirmed: '✅', shipped: '📦', out_for_delivery: '🚚', delivered: '🎉',
      cancelled: '❌', processing: '⏳', completed: '🎉',
    }
    void pushToUser(statusCustomerId, {
      title: `${statusEmoji[newStatus] ?? '📋'} ${statusLabel}`,
      body: `Order #${orderId.slice(-6).toUpperCase()} — ${statusLabel.toLowerCase()}.`,
      url: `/orders/${orderId}`,
      tag: `order-status-${orderId}`,
    })
  }

  // Notify each vendor
  for (const vendor of vendors) {
    let vendorEmail = vendor.vendorEmail
    if (!vendorEmail && vendor.vendorId) {
      try {
        const stores = await getStores({ vendorId: vendor.vendorId, limitCount: 5 })
        const preferredStore = (stores || []).find((store: any) => String(store?._id || '') === String(vendor.storeId || '')) || stores?.[0]
        if (!vendorEmail) vendorEmail = String(preferredStore?.email || '').trim()
      } catch (error) {
        console.error('[order-notifications] Failed to load store contact:', error)
      }
    }
    if (!vendorEmail && vendor.vendorId) {
      try {
        const vendorUser = await User.findById(vendor.vendorId).select('email').lean() as any
        if (vendorUser?.email) vendorEmail = String(vendorUser.email).trim()
      } catch { /* ignore */ }
    }
    if (vendorEmail) {
      await emailService.sendOrderStatusUpdateEmail({
        to: vendorEmail,
        orderId,
        status: newStatus,
        statusLabel,
        customerName,
        vendorName: vendor.vendorName,
        items: vendor.items,
        total: vendor.total,
        productSubtotal: vendor.total,
        deliveryFee: vendors.length === 1 ? overallDeliveryFee : 0,
        shippingAddress: shippingInfo,
        role: 'vendor',
      })
    }
  }
}
import { emailService } from '@/lib/email'
import { getStores } from '@/lib/mongodb-operations'
import { sendOrderConfirmationSms } from '@/lib/sms'
import { detectLogisticsRegionFromAddress } from '@/lib/logistics-access'
import { User } from '@/lib/models/User'
import { pushToUser } from '@/lib/push-notifications'

type OrderLike = any

type VendorBucket = {
  vendorId: string
  vendorName: string
  vendorEmail: string
  vendorPhone: string
  items: any[]
  total: number
  storeId?: string
}

const toNumber = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const sumItems = (items: any[]): number => {
  return items.reduce((sum, item) => {
    const qty = toNumber(item?.quantity || 1)
    const price = toNumber(item?.price || 0)
    return sum + qty * price
  }, 0)
}

const buildVendorsFromItems = (items: any[]): VendorBucket[] => {
  const map = new Map<string, VendorBucket>()

  for (const item of items) {
    const vendorId = String(item?.vendorId || '').trim()
    if (!vendorId) continue

    if (!map.has(vendorId)) {
      map.set(vendorId, {
        vendorId,
        vendorName: String(item?.vendorName || 'Vendor').trim() || 'Vendor',
        vendorEmail: '',
        vendorPhone: '',
        items: [],
        total: 0,
        storeId: String(item?.storeId || '').trim(),
      })
    }

    const bucket = map.get(vendorId)!
    bucket.items.push(item)
    bucket.total += toNumber(item?.price || 0) * toNumber(item?.quantity || 1)
    if (!bucket.storeId && item?.storeId) {
      bucket.storeId = String(item.storeId).trim()
    }
  }

  return Array.from(map.values())
}

const buildVendorBuckets = (order: OrderLike): VendorBucket[] => {
  const vendors = Array.isArray(order?.vendors) ? order.vendors : []
  if (!vendors.length) {
    return buildVendorsFromItems(Array.isArray(order?.items) ? order.items : [])
  }

  return vendors.map((vendor: any) => {
    const items = Array.isArray(vendor?.items) ? vendor.items : []
    return {
      vendorId: String(vendor?.vendorId || '').trim(),
      vendorName: String(vendor?.vendorName || 'Vendor').trim() || 'Vendor',
      vendorEmail: String(vendor?.vendorEmail || '').trim(),
      vendorPhone: String(vendor?.vendorPhone || '').trim(),
      items,
      total: toNumber(vendor?.total || sumItems(items)),
      storeId: String(vendor?.storeId || '').trim(),
    }
  }).filter((vendor: VendorBucket) => vendor.vendorId)
}

export async function sendOrderPlacementNotifications(orderId: string, order: OrderLike) {
  const shippingInfo = order?.shippingInfo || {}
  const customerEmail = String(shippingInfo?.email || '').trim()
  const customerPhone = String(shippingInfo?.phone || shippingInfo?.phoneNumber || '').trim()
  const customerName = `${String(shippingInfo?.firstName || '').trim()} ${String(shippingInfo?.lastName || '').trim()}`.trim() || 'Customer'

  const allItems = Array.isArray(order?.items)
    ? order.items
    : (Array.isArray(order?.vendors) ? order.vendors.flatMap((v: any) => (Array.isArray(v?.items) ? v.items : [])) : [])

  const allItemsSubtotal = sumItems(allItems)
  const overallTotal = toNumber(order?.totalAmount || allItemsSubtotal)
  const overallDeliveryFee = Math.max(0, overallTotal - allItemsSubtotal)

  const vendors = buildVendorBuckets(order)
  const customerItemCount = allItems.reduce((sum: number, item: any) => sum + Math.max(1, toNumber(item?.quantity || 1)), 0)

  // Collect resolved store data for logistics email
  const resolvedVendors: Array<{
    vendorName: string
    storeName: string
    phone: string
    address: string
    items: any[]
  }> = []

  if (customerEmail) {
    await emailService.sendOrderConfirmationEmails({
      customerEmail,
      vendorEmail: customerEmail,
      orderId,
      customerName,
      vendorName: vendors.length === 1 ? vendors[0].vendorName : 'Multiple Vendors',
      items: allItems,
      total: overallTotal,
      productSubtotal: allItemsSubtotal,
      deliveryFee: overallDeliveryFee,
      shippingAddress: shippingInfo,
      sendCustomerCopy: true,
      sendVendorCopy: false,
    })
  }

  // Push notification to customer
  const customerId = String(order?.customerId || order?.userId || '').trim()
  if (customerId) {
    void pushToUser(customerId, {
      title: 'Order confirmed ✅',
      body: `Your order #${orderId.slice(-6).toUpperCase()} has been placed. We'll keep you updated!`,
      url: `/order-confirmation?orderId=${orderId}`,
      tag: `order-placed-${orderId}`,
    })
  }

  if (customerPhone) {
    try {
      await sendOrderConfirmationSms({
        phoneNumber: customerPhone,
        orderId,
        amount: overallTotal,
        productSubtotal: allItemsSubtotal,
        deliveryFee: overallDeliveryFee,
        recipient: 'customer',
        itemCount: customerItemCount,
        deliveryCity: String(shippingInfo?.city || '').trim(),
      })
    } catch (error) {
      console.error('[order-notifications] Customer SMS failed:', error)
    }
  }

  for (const vendor of vendors) {
    let vendorEmail = vendor.vendorEmail
    let vendorPhone = vendor.vendorPhone
    let storeAddress = ''
    let storeName = vendor.vendorName

    if ((!vendorEmail || !vendorPhone) && vendor.vendorId) {
      try {
        const stores = await getStores({ vendorId: vendor.vendorId, limitCount: 5 })
        const preferredStore = (stores || []).find((store: any) => String(store?._id || '') === String(vendor.storeId || '')) || stores?.[0]
        const store = preferredStore
        if (!vendorEmail) vendorEmail = String(store?.email || '').trim()
        if (!vendorPhone) vendorPhone = String(store?.phone || '').trim()
        storeAddress = String(store?.address || '').trim()
        storeName = String(store?.storeName || vendor.vendorName).trim()
      } catch (error) {
        console.error('[order-notifications] Failed to load store contact:', error)
      }
    }

    // Final fallback: use the vendor user account email
    if (!vendorEmail && vendor.vendorId) {
      try {
        const vendorUser = await User.findById(vendor.vendorId).select('email').lean() as any
        if (vendorUser?.email) vendorEmail = String(vendorUser.email).trim()
      } catch {
        // ignore
      }
    }

    resolvedVendors.push({
      vendorName: vendor.vendorName,
      storeName,
      phone: vendorPhone,
      address: storeAddress,
      items: vendor.items,
    })

    if (vendorEmail) {
      await emailService.sendOrderConfirmationEmails({
        customerEmail,
        vendorEmail,
        orderId,
        customerName,
        vendorName: vendor.vendorName,
        items: vendor.items,
        total: vendor.total,
        productSubtotal: vendor.total,
        deliveryFee: vendors.length === 1 ? overallDeliveryFee : 0,
        shippingAddress: shippingInfo,
        sendCustomerCopy: false,
        sendVendorCopy: true,
      })
    }

    // Push notification to vendor
    if (vendor.vendorId) {
      void pushToUser(vendor.vendorId, {
        title: 'New order received 🛒',
        body: `${customerName} just placed an order. Tap to view.`,
        url: `/vendor/orders`,
        tag: `new-order-${orderId}-${vendor.vendorId}`,
      })
    }

    if (vendorPhone) {
      try {
        const vendorItemCount = vendor.items.reduce((sum, item) => sum + Math.max(1, toNumber(item?.quantity || 1)), 0)
        await sendOrderConfirmationSms({
          phoneNumber: vendorPhone,
          orderId,
          amount: vendor.total,
          productSubtotal: vendor.total,
          deliveryFee: vendors.length === 1 ? overallDeliveryFee : 0,
          recipient: 'vendor',
          itemCount: vendorItemCount,
          counterpartyName: customerName,
        })
      } catch (error) {
        console.error('[order-notifications] Vendor SMS failed:', error)
      }
    }
  }

  // Send logistics notification based on delivery city/state
  try {
    const deliveryCity = String(shippingInfo?.city || '').trim()
    const deliveryState = String(shippingInfo?.state || '').trim()
    const region = detectLogisticsRegionFromAddress(deliveryCity, deliveryState)

    if (region) {
      const customerAddress = [
        shippingInfo?.address,
        deliveryCity,
        deliveryState,
        shippingInfo?.zipCode,
      ].filter(Boolean).join(', ')

      await emailService.sendLogisticsOrderEmail({
        to: region.notificationEmail,
        logisticsName: region.panelTitle,
        orderId,
        customerName,
        customerPhone,
        customerAddress,
        vendors: resolvedVendors,
        allItems,
        total: overallTotal,
        productSubtotal: allItemsSubtotal,
        deliveryFee: overallDeliveryFee,
        orderDate: new Date(),
      })
    }
  } catch (error) {
    console.error('[order-notifications] Logistics email failed:', error)
  }
}
