import { NextRequest } from 'next/server'
import { getAllProducts, getAllOrders, getServices, getAllBookings } from '@/lib/mongodb-operations'
import { requireAdminAccess } from '@/lib/server-route-auth'

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdminAccess(req)
  if (unauthorized) return unauthorized

  try {
    const [products, orders, bookings] = await Promise.all([
      getAllProducts(),
      getAllOrders(),
      getAllBookings(),
    ])

    // Get all services
    let services: any[] = []
    try {
      services = await getServices({}) || []
    } catch (error) {
      console.error('Error fetching services:', error)
      services = []
    }

    // Create a product map for quick lookup
    const productMap: Record<string, any> = {}
    products.forEach((p: any) => {
      productMap[p.id] = p
    })

    // Category analysis
    const categoryStats: Record<string, { count: number; revenue: number; name: string }> = {}
    
    products.forEach((p: any) => {
      const category = p.category || 'Uncategorized'
      if (!categoryStats[category]) {
        categoryStats[category] = { count: 0, revenue: 0, name: category }
      }
      categoryStats[category].count++
    })

    // Add revenue from orders by category - use product lookup
    orders.forEach((o: any) => {
      if (Array.isArray(o.items)) {
        o.items.forEach((item: any) => {
          // Try to get category from item, then from product lookup
          let category = item.category
          if (!category && item.productId) {
            const product = productMap[item.productId]
            category = product?.category
          }
          category = category || 'Uncategorized'
          
          if (!categoryStats[category]) {
            categoryStats[category] = { count: 0, revenue: 0, name: category }
          }
          categoryStats[category].revenue += item.price * item.quantity || 0
        })
      }
    })

    const categories = Object.values(categoryStats).sort((a, b) => b.revenue - a.revenue)

    // Service type analysis
    const serviceTypeStats: Record<string, { count: number; revenue: number }> = {}
    let totalServiceRevenue = 0

    services.forEach((s: any) => {
      const serviceType = s.category || s.serviceType || 'Other'
      if (!serviceTypeStats[serviceType]) {
        serviceTypeStats[serviceType] = { count: 0, revenue: 0 }
      }
      serviceTypeStats[serviceType].count++
      const baseRevenue = Number(s.price || 0)
      if (Number.isFinite(baseRevenue) && baseRevenue > 0) {
        serviceTypeStats[serviceType].revenue += baseRevenue
        totalServiceRevenue += baseRevenue
      }
    })

    const serviceTypes = Object.entries(serviceTypeStats).map(([type, data]) => ({
      type,
      ...data,
    }))

    const quoteBookings = (bookings || []).filter((booking: any) => Boolean(booking?.requiresQuote))
    const reminderCount = quoteBookings.reduce((sum: number, booking: any) => {
      const reminder = Number(booking?.quoteReminderCount || 0)
      return sum + (Number.isFinite(reminder) ? reminder : 0)
    }, 0)
    const expiredCount = quoteBookings.filter((booking: any) => Boolean(booking?.quoteExpiredAt)).length
    const acceptedCount = quoteBookings.filter((booking: any) => String(booking?.pricingStatus || '') === 'accepted').length
    const acceptanceRate = quoteBookings.length > 0
      ? Math.round((acceptedCount / quoteBookings.length) * 100)
      : 0

    // Order status distribution
    const orderStatusStats: Record<string, number> = {}
    orders.forEach((o: any) => {
      const status = o.status || 'pending'
      orderStatusStats[status] = (orderStatusStats[status] || 0) + 1
    })

    // Payment status distribution
    const paymentStatusStats: Record<string, number> = {}
    orders.forEach((o: any) => {
      const status = o.paymentStatus || 'pending'
      paymentStatusStats[status] = (paymentStatusStats[status] || 0) + 1
    })

    return new Response(
      JSON.stringify({
        success: true,
        categories,
        serviceTypes,
        orderStatusStats,
        paymentStatusStats,
        totalServices: services.length,
        totalServiceRevenue,
        quoteSlaMetrics: {
          totalQuoteBookings: quoteBookings.length,
          remindersSent: reminderCount,
          expiredQuotes: expiredCount,
          acceptedQuotes: acceptedCount,
          acceptanceRate,
        },
      }),
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[/api/admin/analytics]', error)
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      { status: 500 }
    )
  }
}
