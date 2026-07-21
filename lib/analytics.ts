import { getOrdersByVendor } from "./mongodb-operations";
import { getVendorProducts } from "./mongodb-operations";
import { buildCustomerSegments } from "./vendor-insights";

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Nigeria (WAT) is a fixed UTC+1 with no DST, so this is computed directly from the UTC
// fields rather than trusting the server process's local timezone (Vercel runs UTC) — a
// plain getHours()/getDay() would silently misbucket every order by an hour.
function getLagosDayAndHour(date: Date): { day: number; hour: number } {
  const utcHour = date.getUTCHours();
  const hour = (utcHour + 1) % 24;
  const dayRollover = utcHour === 23 ? 1 : 0;
  const lagosDate = new Date(date.getTime());
  lagosDate.setUTCDate(lagosDate.getUTCDate() + dayRollover);
  return { day: lagosDate.getUTCDay(), hour };
}

function formatHourRange(hour: number): string {
  const to12h = (h: number) => {
    const period = h < 12 ? 'AM' : 'PM';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}${period}`;
  };
  return `${to12h(hour)}–${to12h((hour + 1) % 24)}`;
}

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

  // Real best-sellers — sorted by actual units sold, not insertion order
  const rankedProducts = [...products].sort((a: any, b: any) => Number(b.sales || 0) - Number(a.sales || 0));
  const topProducts = rankedProducts.slice(0, 5);
  const bestSellingProduct = rankedProducts.length > 0 && Number(rankedProducts[0].sales || 0) > 0
    ? rankedProducts[0]
    : null;

  // Peak sales day/hour, in Lagos local time, using the same settled vendor-order set
  // that drives totalRevenue/totalOrders above
  const revenueByDay = new Array(7).fill(0);
  const ordersByDay = new Array(7).fill(0);
  const revenueByHour = new Array(24).fill(0);
  const ordersByHour = new Array(24).fill(0);

  for (const order of vendorOrders) {
    const createdAt = order.createdAt ? new Date(order.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) continue;
    const total = getVendorOrderTotal(order);
    const { day, hour } = getLagosDayAndHour(createdAt);
    revenueByDay[day] += total;
    ordersByDay[day] += 1;
    revenueByHour[hour] += total;
    ordersByHour[hour] += 1;
  }

  const salesByDay = DAY_NAMES.map((day, idx) => ({ day, revenue: revenueByDay[idx], orders: ordersByDay[idx] }));
  const salesByHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: formatHourRange(hour),
    revenue: revenueByHour[hour],
    orders: ordersByHour[hour],
  }));

  const peakDayIndex = vendorOrders.length > 0 ? revenueByDay.indexOf(Math.max(...revenueByDay)) : -1;
  const peakHourIndex = vendorOrders.length > 0 ? revenueByHour.indexOf(Math.max(...revenueByHour)) : -1;
  const peakDay = peakDayIndex >= 0 ? salesByDay[peakDayIndex] : null;
  const peakHour = peakHourIndex >= 0 ? salesByHour[peakHourIndex] : null;

  // Repeat buyer rate — reuses the same segmentation the dashboard's "Repeat" count and
  // the Repeat Customers page are built from, so all three numbers agree with each other
  const segmentResult = buildCustomerSegments({ vendorId, orders: orders as any[] });
  const totalUniqueCustomers = Object.keys(segmentResult.summaries).length;
  const repeatCustomerCount = segmentResult.segments.repeat.length;
  const repeatBuyerRate = totalUniqueCustomers > 0 ? (repeatCustomerCount / totalUniqueCustomers) * 100 : 0;

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
    topProducts,
    bestSellingProduct,
    salesByDay,
    salesByHour,
    peakDay,
    peakHour,
    totalUniqueCustomers,
    repeatCustomerCount,
    repeatBuyerRate,
  };
}
