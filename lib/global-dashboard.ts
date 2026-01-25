import { getAllOrders, getAllProducts, getAllStores, getAllUsers } from './mongodb-operations'

export async function getGlobalDashboard() {
  const [orders, products, stores, users] = await Promise.all([
    getAllOrders(),
    getAllProducts(),
    getAllStores(),
    getAllUsers()
  ])

  // Helper: vendor portion total
  function vendorTotalsByOrder(order: any) {
    if (Array.isArray(order.vendors)) {
      return order.vendors.reduce((acc: number, v: any) => acc + (v.total || 0), 0)
    }
    return order.total || 0
  }

  const totalRevenue = orders.reduce((sum, o) => sum + vendorTotalsByOrder(o), 0)
  const totalOrders = orders.length
  const totalProducts = products.length
  const totalUsers = users.length
  const vendorsCount = users.filter(u => u.role === 'vendor').length
  const customersCount = users.filter(u => !u.role || u.role === 'customer').length

  // Top vendors by revenue
  const vendorRevenueMap = new Map<string, number>()
  const vendorSalesMap = new Map<string, number>()
  orders.forEach(o => {
    if (Array.isArray(o.vendors)) {
      o.vendors.forEach((v: any) => {
        vendorRevenueMap.set(v.vendorId, (vendorRevenueMap.get(v.vendorId) || 0) + (v.total || 0))
        const items = Array.isArray(v.items) ? v.items : []
        const qty = items.reduce((q: number, it: any) => q + (it.quantity || 0), 0)
        vendorSalesMap.set(v.vendorId, (vendorSalesMap.get(v.vendorId) || 0) + qty)
      })
    } else if (o.vendorId) {
      vendorRevenueMap.set(o.vendorId, (vendorRevenueMap.get(o.vendorId) || 0) + (o.total || 0))
    }
  })

  const storeByVendorId: Record<string, any> = {}
  stores.forEach(s => { storeByVendorId[s.vendorId] = s })
  const topVendors = Array.from(vendorRevenueMap.entries()).map(([vendorId, revenue]) => ({
    vendorId,
    revenue,
    sales: vendorSalesMap.get(vendorId) || 0,
    storeName: storeByVendorId[vendorId]?.storeName || storeByVendorId[vendorId]?.name || 'Store'
  })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // Top customers by spend
  const customerSpendMap = new Map<string, number>()
  orders.forEach(o => {
    const orderTotal = vendorTotalsByOrder(o)
    if (o.customerId) customerSpendMap.set(o.customerId, (customerSpendMap.get(o.customerId) || 0) + orderTotal)
  })
  const topCustomers = Array.from(customerSpendMap.entries()).map(([customerId, spend]) => ({ customerId, spend }))
    .sort((a, b) => b.spend - a.spend).slice(0, 10)

  // Top products by sales (fallback to product.sales field)
  const productSales = new Map<string, {qty: number, title: string}>()
  orders.forEach(o => {
    if (Array.isArray(o.vendors)) {
      o.vendors.forEach((v: any) => {
        (v.items || []).forEach((it: any) => {
          const prev = productSales.get(it.productId) || { qty: 0, title: it.name || 'Product' }
          productSales.set(it.productId, { qty: prev.qty + (it.quantity || 0), title: prev.title })
        })
      })
    } else if (Array.isArray(o.products)) {
      o.products.forEach((it: any) => {
        const prev = productSales.get(it.productId) || { qty: 0, title: it.name || 'Product' }
        productSales.set(it.productId, { qty: prev.qty + (it.quantity || 0), title: prev.title })
      })
    }
  })
  const topProducts = Array.from(productSales.entries()).map(([productId, data]) => ({ productId, qty: data.qty, title: data.title }))
    .sort((a, b) => b.qty - a.qty).slice(0, 10)

  // Vendor tenure (oldest stores first)
  const vendorsByTenure = [...stores].sort((a, b) => {
    const da = new Date(a.createdAt || 0).getTime()
    const db = new Date(b.createdAt || 0).getTime()
    return da - db
  }).slice(0, 10)

  // Subscriptions expiring soon (within 14 days) if field exists
  const now = Date.now()
  const twoWeeks = 14 * 24 * 60 * 60 * 1000
  const expiringSubscriptions = stores.filter((s: any) => {
    const exp = s.subscriptionExpiresAt || s.subscriptionExpiryDate
    if (!exp) return false
    const t = new Date(exp).getTime()
    return t > now && (t - now) <= twoWeeks
  }).map((s: any) => ({
    vendorId: s.vendorId,
    storeName: s.storeName || s.name,
    subscriptionExpiresAt: s.subscriptionExpiresAt || s.subscriptionExpiryDate
  }))

  // Month-over-month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  const startOfLastMonth = new Date(startOfMonth)
  startOfLastMonth.setMonth(startOfMonth.getMonth() - 1)
  const endOfLastMonth = new Date(startOfMonth)
  endOfLastMonth.setDate(0)

  const ordersThisMonth = orders.filter(o => o.createdAt && new Date(o.createdAt) >= startOfMonth)
  const ordersLastMonth = orders.filter(o => o.createdAt && new Date(o.createdAt) >= startOfLastMonth && new Date(o.createdAt) < startOfMonth)
  const revenueThisMonth = ordersThisMonth.reduce((sum, o) => sum + vendorTotalsByOrder(o), 0)
  const revenueLastMonth = ordersLastMonth.reduce((sum, o) => sum + vendorTotalsByOrder(o), 0)
  const revenueChange = revenueLastMonth === 0 ? null : ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100

  return {
    totals: { totalRevenue, totalOrders, totalProducts, totalUsers, vendorsCount, customersCount },
    topVendors,
    topCustomers,
    topProducts,
    vendorsByTenure,
    expiringSubscriptions,
    revenueChange,
  }
}
