import { emailService } from '@/lib/email'
import { getStores } from '@/lib/mongodb-operations'
import { User } from '@/lib/models/User'
import { normalizeNigerianPhone, sendOrderConfirmationSms } from '@/lib/sms'

type OrderLike = any

type VendorBucket = {
  vendorId: string
  vendorName: string
  vendorEmail: string
  vendorPhone: string
  items: any[]
  total: number
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
      })
    }

    const bucket = map.get(vendorId)!
    bucket.items.push(item)
    bucket.total += toNumber(item?.price || 0) * toNumber(item?.quantity || 1)
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
      vendorPhone: String(vendor?.vendorPhone || vendor?.phone || vendor?.storePhone || '').trim(),
      items,
      total: toNumber(vendor?.total || sumItems(items)),
    }
  }).filter((vendor) => vendor.vendorId)
}

export async function sendOrderPlacementNotifications(orderId: string, order: OrderLike) {
  const shippingInfo = order?.shippingInfo || {}
  const customerEmail = String(shippingInfo?.email || '').trim()
  const customerName = `${String(shippingInfo?.firstName || '').trim()} ${String(shippingInfo?.lastName || '').trim()}`.trim() || 'Customer'
  const customerPhone = normalizeNigerianPhone(String(shippingInfo?.phone || ''))

  const allItems = Array.isArray(order?.items)
    ? order.items
    : (Array.isArray(order?.vendors) ? order.vendors.flatMap((v: any) => (Array.isArray(v?.items) ? v.items : [])) : [])

  const allItemsSubtotal = sumItems(allItems)
  const overallTotal = toNumber(order?.totalAmount || allItemsSubtotal)
  const overallDeliveryFee = Math.max(0, overallTotal - allItemsSubtotal)

  const vendors = buildVendorBuckets(order)

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

  for (const vendor of vendors) {
    let vendorEmail = vendor.vendorEmail
    let vendorPhone = vendor.vendorPhone
    let storePhone = ''
    let preferStorePhone = false

    if (vendor.vendorId) {
      try {
        const vendorUser = await User.findById(vendor.vendorId)
          .select('phone_verified')
          .lean()
        preferStorePhone = Boolean(vendorUser) && (vendorUser as any).phone_verified !== true
      } catch (error) {
        console.error('[order-notifications] Failed to check vendor phone verification:', error)
      }
    }

    if ((!vendorEmail || !vendorPhone || preferStorePhone) && vendor.vendorId) {
      try {
        const stores = await getStores({ vendorId: vendor.vendorId, limitCount: 1 })
        const store = stores?.[0]
        if (!vendorEmail) {
          vendorEmail = String(store?.email || '').trim()
        }
        storePhone = String(store?.storePhone || store?.phone || '').trim()
        if (preferStorePhone && storePhone) {
          vendorPhone = storePhone
        } else if (!vendorPhone) {
          vendorPhone = storePhone
        }
      } catch (error) {
        console.error('[order-notifications] Failed to load store contact:', error)
      }
    }

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

    const normalizedVendorPhone = normalizeNigerianPhone(vendorPhone)
      || (storePhone ? normalizeNigerianPhone(storePhone) : null)
    if (normalizedVendorPhone) {
      await sendOrderConfirmationSms({
        phoneNumber: normalizedVendorPhone,
        orderId,
        amount: vendor.total,
        productSubtotal: vendor.total,
        deliveryFee: vendors.length === 1 ? overallDeliveryFee : 0,
        recipient: 'vendor',
        itemCount: vendor.items.length,
        counterpartyName: customerName,
      })
    }
  }

  if (customerPhone) {
    await sendOrderConfirmationSms({
      phoneNumber: customerPhone,
      orderId,
      amount: overallTotal,
      productSubtotal: allItemsSubtotal,
      deliveryFee: overallDeliveryFee,
      recipient: 'customer',
      itemCount: allItems.length,
      deliveryCity: String(shippingInfo?.city || '').trim(),
    })
  }
}
