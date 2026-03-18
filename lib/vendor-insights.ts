import { VendorFunnelEvent } from '@/lib/models/VendorFunnelEvent'
import { VendorPromoTrigger } from '@/lib/models/VendorPromoTrigger'

type OrderLike = {
  customerId?: string
  createdAt?: string | Date
  vendors?: Array<{ vendorId?: string; total?: number }>
  vendorId?: string
  total?: number
}

type ProductLike = {
  id?: string
  name?: string
  title?: string
  price?: number
  sales?: number
  createdAt?: string | Date
  status?: string
  stock?: number
  category?: string
}

function vendorOrderTotal(order: OrderLike, vendorId: string): number {
  if (Array.isArray(order.vendors)) {
    const vendorLine = order.vendors.find((line) => line?.vendorId === vendorId)
    return Number(vendorLine?.total || 0)
  }
  if (order.vendorId === vendorId) {
    return Number(order.total || 0)
  }
  return 0
}

export function buildCustomerSegments(params: { vendorId: string; orders: OrderLike[] }) {
  const { vendorId, orders } = params
  const now = Date.now()
  const customerMap = new Map<string, { count: number; spend: number; lastOrderAt: number }>()

  for (const order of orders) {
    const customerId = String(order.customerId || '').trim()
    if (!customerId) continue
    const total = vendorOrderTotal(order, vendorId)
    if (total <= 0) continue

    const createdAt = new Date(order.createdAt || now).getTime()
    const existing = customerMap.get(customerId) || { count: 0, spend: 0, lastOrderAt: 0 }
    existing.count += 1
    existing.spend += total
    existing.lastOrderAt = Math.max(existing.lastOrderAt, createdAt)
    customerMap.set(customerId, existing)
  }

  const segments = {
    new: [] as string[],
    repeat: [] as string[],
    dormant: [] as string[],
    highValue: [] as string[],
  }

  customerMap.forEach((summary, customerId) => {
    const daysSinceLastOrder = (now - summary.lastOrderAt) / (1000 * 60 * 60 * 24)

    if (summary.count === 1 && daysSinceLastOrder <= 30) {
      segments.new.push(customerId)
    }
    if (summary.count >= 2) {
      segments.repeat.push(customerId)
    }
    if (daysSinceLastOrder > 45) {
      segments.dormant.push(customerId)
    }
    if (summary.spend >= 50000) {
      segments.highValue.push(customerId)
    }
  })

  return {
    segments,
    summaries: Object.fromEntries(customerMap),
  }
}

export async function triggerAutomatedPromos(params: {
  vendorId: string
  segmentResult: ReturnType<typeof buildCustomerSegments>
}) {
  const { vendorId, segmentResult } = params
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  const promoConfigs: Record<string, { code: string; message: string }> = {
    new: {
      code: 'WELCOME10',
      message: 'Welcome back! Enjoy 10% off your next order.',
    },
    repeat: {
      code: 'LOYAL15',
      message: 'Thanks for being a repeat buyer. Here is 15% off your next purchase.',
    },
    dormant: {
      code: 'WE_MISS_YOU',
      message: 'We miss you. Come back with a special discount on selected products.',
    },
    'high-value': {
      code: 'VIP20',
      message: 'VIP customer reward unlocked: 20% off premium selections.',
    },
  }

  const triggered: Array<{ customerId: string; segment: string; promoCode: string }> = []

  const segmentEntries: Array<[string, string[]]> = [
    ['new', segmentResult.segments.new],
    ['repeat', segmentResult.segments.repeat],
    ['dormant', segmentResult.segments.dormant],
    ['high-value', segmentResult.segments.highValue],
  ]

  for (const [segment, customerIds] of segmentEntries) {
    for (const customerId of customerIds) {
      const exists = await VendorPromoTrigger.findOne({
        vendorId,
        customerId,
        segment,
        triggeredAt: { $gte: startOfDay },
      }).lean()

      if (exists) continue

      const config = promoConfigs[segment]
      await VendorPromoTrigger.create({
        vendorId,
        customerId,
        segment,
        promoCode: config.code,
        promoMessage: config.message,
        triggeredAt: now,
        status: 'queued',
      })

      triggered.push({ customerId, segment, promoCode: config.code })
    }
  }

  return {
    triggeredCount: triggered.length,
    triggered,
  }
}

export async function buildConversionFunnel(params: {
  vendorId: string
  totalOrders: number
  cartsWithVendorItems: number
}) {
  const { vendorId, totalOrders, cartsWithVendorItems } = params
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const events = await VendorFunnelEvent.find({ vendorId, createdAt: { $gte: since } }).lean()
  const countByType = events.reduce<Record<string, number>>((acc, event: any) => {
    const key = String(event.eventType || '')
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const storeVisits = countByType.store_visit || Math.max(totalOrders * 5, 20)
  const productViews = countByType.product_view || Math.max(totalOrders * 3, 10)
  const cartAdds = countByType.cart_add || Math.max(cartsWithVendorItems, Math.round(totalOrders * 1.5))
  const checkoutStarts = countByType.checkout_start || Math.max(totalOrders, 1)
  const completedOrders = Math.max(totalOrders, 0)

  const stages = [
    { key: 'storeVisits', label: 'Store Visits', value: storeVisits },
    { key: 'productViews', label: 'Product Views', value: productViews },
    { key: 'cartAdds', label: 'Cart Adds', value: cartAdds },
    { key: 'checkoutStarts', label: 'Checkout Starts', value: checkoutStarts },
    { key: 'completedOrders', label: 'Completed Orders', value: completedOrders },
  ]

  const hints: string[] = []
  if (productViews < storeVisits * 0.35) {
    hints.push('Low visit-to-view rate: improve storefront banner and featured products.')
  }
  if (cartAdds < productViews * 0.3) {
    hints.push('Low view-to-cart rate: optimize product images, pricing, and descriptions.')
  }
  if (checkoutStarts < cartAdds * 0.6) {
    hints.push('Cart drop-off is high: offer shipping clarity and cart incentives.')
  }
  if (completedOrders < checkoutStarts * 0.7) {
    hints.push('Checkout drop-off detected: simplify checkout and payment trust messaging.')
  }

  return {
    stages,
    hints: hints.length > 0 ? hints : ['Funnel is healthy. Keep testing offers and top-selling placements.'],
    trackedEventsLast30Days: events.length,
  }
}

export function buildSmartCollections(products: ProductLike[]) {
  const activeProducts = products.filter((item) => (item.status || 'active') !== 'inactive')

  const bestSellers = [...activeProducts]
    .sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0))
    .slice(0, 8)

  const newArrivals = [...activeProducts]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8)

  const underThreshold = (threshold: number) =>
    activeProducts
      .filter((item) => Number(item.price || 0) <= threshold)
      .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
      .slice(0, 8)

  return {
    bestSellers,
    newArrivals,
    under5000: underThreshold(5000),
    under10000: underThreshold(10000),
  }
}
