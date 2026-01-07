import { getOrdersByVendor } from "./mongodb-operations";
import { getVendorProducts } from "./mongodb-operations";

export async function getVendorAnalytics(vendorId: string) {
  // Fetch orders and products for this vendor
  const orders = await getOrdersByVendor(vendorId);
  const products = await getVendorProducts(vendorId);

  // Dates for analytics
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday

  // Helper to get vendor's portion of an order
  function getVendorOrderTotal(order: any) {
    if (Array.isArray(order.vendors)) {
      const vendorObj = order.vendors.find((v: any) => v.vendorId === vendorId);
      return vendorObj ? vendorObj.total || 0 : 0;
    }
    // Fallback for legacy single-vendor orders
    if (order.vendorId === vendorId && typeof order.total === 'number') {
      return order.total;
    }
    return 0;
  }

  // Revenue and orders for this and last month (vendor's portion only)
  const ordersThisMonth = orders.filter(o => o.createdAt && new Date(o.createdAt) >= startOfMonth);
  const ordersLastMonth = orders.filter(o => o.createdAt && new Date(o.createdAt) >= startOfLastMonth && new Date(o.createdAt) < startOfMonth);
  const revenueThisMonth = ordersThisMonth.reduce((sum, o) => sum + getVendorOrderTotal(o), 0);
  const revenueLastMonth = ordersLastMonth.reduce((sum, o) => sum + getVendorOrderTotal(o), 0);
  const totalRevenue = orders.reduce((sum, order) => sum + getVendorOrderTotal(order), 0);
  // Only count orders where vendor actually has a portion
  const vendorOrders = orders.filter(order => getVendorOrderTotal(order) > 0);
  const totalOrders = vendorOrders.length;
  const totalProducts = products.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Percentage changes
  const revenueChange = revenueLastMonth === 0 ? null : ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100;
  const ordersChange = ordersLastMonth.length === 0 ? null : ((
    ordersThisMonth.filter(o => getVendorOrderTotal(o) > 0).length - ordersLastMonth.filter(o => getVendorOrderTotal(o) > 0).length
  ) / ordersLastMonth.filter(o => getVendorOrderTotal(o) > 0).length) * 100;

  // New products this week
  const productsThisWeek = products.filter(p => p.createdAt && new Date(p.createdAt) >= startOfWeek);
  const productsLastWeek = products.filter(p => p.createdAt && new Date(p.createdAt) < startOfWeek && new Date(p.createdAt) >= new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000));
  const newProductsThisWeek = productsThisWeek.length;
  const newProductsLastWeek = productsLastWeek.length;
  const productsChange = newProductsLastWeek === 0 ? null : ((newProductsThisWeek - newProductsLastWeek) / newProductsLastWeek) * 100;

  // Avg order value change (vendor's portion only)
  const vendorOrdersThisMonth = ordersThisMonth.filter(o => getVendorOrderTotal(o) > 0);
  const vendorOrdersLastMonth = ordersLastMonth.filter(o => getVendorOrderTotal(o) > 0);
  const avgOrderValueThisMonth = vendorOrdersThisMonth.length > 0 ? revenueThisMonth / vendorOrdersThisMonth.length : 0;
  const avgOrderValueLastMonth = vendorOrdersLastMonth.length > 0 ? revenueLastMonth / vendorOrdersLastMonth.length : 0;
  const avgOrderValueChange = avgOrderValueLastMonth === 0 ? null : ((avgOrderValueThisMonth - avgOrderValueLastMonth) / avgOrderValueLastMonth) * 100;

  return {
    totalRevenue,
    totalOrders,
    totalProducts,
    avgOrderValue,
    revenueChange,
    ordersChange,
    productsChange,
    avgOrderValueChange,
    newProductsThisWeek,
    recentOrders: orders.slice(-5).reverse(),
    topProducts: products.slice(0, 5),
  };
}
