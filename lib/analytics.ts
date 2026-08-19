import { getOrdersByVendor } from "./mongodb-operations";
import { getVendorProducts } from "./mongodb-operations";
import { buildCustomerSegments } from "./vendor-insights";

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // WAT is a fixed UTC+1, no DST

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

// Same reasoning as getLagosDayAndHour, applied to calendar-month/week boundaries
// instead of a single day/hour: computing "start of month" from the server's own UTC
// clock would misfile any order placed in WAT's last hour of a month/week into the
// wrong bucket relative to what the vendor (in Lagos) actually experiences as "this
// month". Returns the UTC instant of 00:00:00 WAT on the 1st of the Lagos-calendar
// month `monthOffset` months from `date` (0 = this month, -1 = last month).
function startOfLagosMonth(date: Date, monthOffset = 0): Date {
  const lagosNow = new Date(date.getTime() + LAGOS_OFFSET_MS);
  return new Date(Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth() + monthOffset, 1) - LAGOS_OFFSET_MS);
}

// Same idea for the start of the current Lagos-calendar week (Sunday 00:00 WAT).
function startOfLagosWeek(date: Date): Date {
  const lagosNow = new Date(date.getTime() + LAGOS_OFFSET_MS);
  const lagosDay = lagosNow.getUTCDay();
  return new Date(
    Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), lagosNow.getUTCDate() - lagosDay) - LAGOS_OFFSET_MS
  );
}

// Same idea for the start of the current Lagos-calendar day (00:00 WAT) — used by
// getVendorSalesSummary's 'today' period. getVendorAnalytics below has no literal "today"
// figure (its salesByDay/salesByHour are all-time day-of-week/hour-of-day buckets, not
// calendar-today), so this is a separate boundary, not reused from there.
function startOfLagosDay(date: Date): Date {
  const lagosNow = new Date(date.getTime() + LAGOS_OFFSET_MS);
  return new Date(
    Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), lagosNow.getUTCDate()) - LAGOS_OFFSET_MS
  );
}

// A cancelled vendor leg, or an order whose payment never actually settled (still
// pending, failed to capture, or later refunded), isn't real revenue — 'disputed' and
// 'escrow'/'released' still count since the payment itself was captured and hasn't been
// reversed. Without this, a cancelled or unpaid order's total was being counted as if
// it were a completed sale everywhere below (totals, trends, day/hour buckets, "recent
// orders").
const NON_REVENUE_PAYMENT_STATUSES = new Set(['pending', 'failed', 'refunded']);

function isSettledVendorSale(order: any, vendorLegStatus: string | undefined): boolean {
  if (NON_REVENUE_PAYMENT_STATUSES.has(String(order.paymentStatus || '').toLowerCase())) return false;
  if (String(vendorLegStatus || '').toLowerCase() === 'cancelled') return false;
  return true;
}

function formatHourRange(hour: number): string {
  const to12h = (h: number) => {
    const period = h < 12 ? 'AM' : 'PM';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}${period}`;
  };
  return `${to12h(hour)}–${to12h((hour + 1) % 24)}`;
}

// Lightweight "sales today" / "sales this week" figure for the WhatsApp bot's `sales`
// command (lib/whatsapp/commands.ts) — deliberately its own small function rather than a
// slice of getVendorAnalytics below, since that function has no literal "today" figure to
// reuse (see startOfLagosDay's comment). getVendorOrderTotal is duplicated here rather
// than extracted from getVendorAnalytics's closure — it's ~10 lines, tied to a single
// vendorId, and extracting it would mean touching that already-working function for a
// single new caller.
export async function getVendorSalesSummary(vendorId: string, period: 'today' | 'week') {
  const orders = await getOrdersByVendor(vendorId);
  const now = new Date();
  const periodStart = period === 'today' ? startOfLagosDay(now) : startOfLagosWeek(now);

  function getVendorOrderTotal(order: any): number {
    if (Array.isArray(order.vendors)) {
      const vendorObj = order.vendors.find((v: any) => v.vendorId === vendorId);
      if (!vendorObj) return 0;
      if (!isSettledVendorSale(order, vendorObj.status)) return 0;
      return vendorObj.total || 0;
    }
    if (order.vendorId === vendorId && typeof order.total === 'number') {
      if (!isSettledVendorSale(order, order.status)) return 0;
      return order.total;
    }
    return 0;
  }

  const periodOrders = orders.filter((o: any) => o.createdAt && new Date(o.createdAt) >= periodStart);
  const settledOrders = periodOrders.filter((o: any) => getVendorOrderTotal(o) > 0);
  const revenue = settledOrders.reduce((sum: number, o: any) => sum + getVendorOrderTotal(o), 0);

  return { period, revenue, orderCount: settledOrders.length };
}

export async function getVendorAnalytics(vendorId: string) {
  // Fetch orders and products for this vendor
  const orders = await getOrdersByVendor(vendorId);
  const products = await getVendorProducts(vendorId);

  // Dates for analytics — Lagos-calendar boundaries, not the server's own UTC clock.
  const now = new Date();
  const startOfMonth = startOfLagosMonth(now, 0);
  const startOfLastMonth = startOfLagosMonth(now, -1);
  const startOfWeek = startOfLagosWeek(now);

  // Helper to get vendor's portion of an order — 0 for anything that isn't a real,
  // settled sale (see isSettledVendorSale above), not just a missing vendor line.
  function getVendorOrderTotal(order: any) {
    if (Array.isArray(order.vendors)) {
      const vendorObj = order.vendors.find((v: any) => v.vendorId === vendorId);
      if (!vendorObj) return 0;
      if (!isSettledVendorSale(order, vendorObj.status)) return 0;
      return vendorObj.total || 0;
    }
    // Fallback for legacy single-vendor orders
    if (order.vendorId === vendorId && typeof order.total === 'number') {
      if (!isSettledVendorSale(order, order.status)) return 0;
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

  // Real best-sellers — units actually sold in settled orders, not Product.sales. That
  // counter is only ever incremented on payment confirmation and never decremented on a
  // later cancellation/refund (a sitewide gap that also affects trending/search, out of
  // scope to change there), so a refunded order's units stayed counted forever — a
  // vendor whose only "sales" were later refunded would show as their own best-seller.
  // Recomputed here from the same settled vendorOrders set that drives revenue above.
  const unitsSoldByProduct = new Map<string, number>();
  for (const order of vendorOrders) {
    const items: any[] = Array.isArray((order as any).vendors)
      ? ((order as any).vendors.find((v: any) => v.vendorId === vendorId)?.items || [])
      : Array.isArray((order as any).items)
      ? (order as any).items.filter((it: any) => it.vendorId === vendorId)
      : [];
    for (const item of items) {
      const productId = String(item.productId || '');
      if (!productId) continue;
      unitsSoldByProduct.set(productId, (unitsSoldByProduct.get(productId) || 0) + Number(item.quantity || 0));
    }
  }

  const rankedProducts = [...products]
    .map((p: any) => ({ ...p, sales: unitsSoldByProduct.get(String(p.id || p._id || '')) || 0 }))
    .sort((a: any, b: any) => b.sales - a.sales);
  const topProducts = rankedProducts.slice(0, 5);
  const bestSellingProduct = rankedProducts.length > 0 && rankedProducts[0].sales > 0
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
    // orders is already sorted newest-first by getOrdersByVendor; slice(-5) here used to
    // grab the 5 OLDEST orders instead. Sourced from vendorOrders (not the raw list) so
    // a cancelled/unpaid order's total doesn't show up looking like a real sale.
    recentOrders: vendorOrders.slice(0, 5),
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
