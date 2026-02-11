import { getOrdersByVendor, getVendorProducts, getServices, getBookingsByProvider } from "./mongodb-operations";
import { User } from "./models/User";

export async function getVendorDashboard(vendorId: string) {
  const orders = await getOrdersByVendor(vendorId);
  const products = await getVendorProducts(vendorId);
  const services = await getServices({ providerId: vendorId });
  const bookings = await getBookingsByProvider(vendorId);

  // Dates for analytics
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday

  // Helper to get vendor's portion of an order
  interface VendorOrderInfo {
    vendorId: string;
    total?: number;
    // other fields if needed
  }

  interface Order {
    vendors?: VendorOrderInfo[];
    vendorId?: string;
    total?: number;
    createdAt?: string | Date;
    // other fields if needed
  }

  function getVendorOrderTotal(order: Order): number {
    if (Array.isArray(order.vendors)) {
      const vendorObj = order.vendors.find((v: VendorOrderInfo) => v.vendorId === vendorId);
      return vendorObj ? vendorObj.total || 0 : 0;
    }
    // Fallback for legacy single-vendor orders
    if (order.vendorId === vendorId && typeof order.total === 'number') {
      return order.total;
    }
    return 0;
  }

  // Revenue and orders for this and last month
  const ordersThisMonth = orders.filter(o => o.createdAt && new Date(o.createdAt) >= startOfMonth);
  const ordersLastMonth = orders.filter(o => o.createdAt && new Date(o.createdAt) >= startOfLastMonth && new Date(o.createdAt) < startOfMonth);
  const revenueThisMonth = ordersThisMonth.reduce((sum, o) => sum + getVendorOrderTotal(o), 0);
  const revenueLastMonth = ordersLastMonth.reduce((sum, o) => sum + getVendorOrderTotal(o), 0);
  const totalRevenue = orders.reduce((sum, order) => sum + getVendorOrderTotal(order), 0);
  const totalOrders = orders.length;
  const totalProducts = products.length;

  // Percentage changes
  const revenueChange = revenueLastMonth === 0 ? null : ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100;
  const ordersChange = ordersLastMonth.length === 0 ? null : ((ordersThisMonth.length - ordersLastMonth.length) / ordersLastMonth.length) * 100;

  // New products this week
  const productsThisWeek = products.filter(p => p.createdAt && new Date(p.createdAt) >= startOfWeek);
  const productsLastWeek = products.filter(p => p.createdAt && new Date(p.createdAt) < startOfWeek && new Date(p.createdAt) >= new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000));
  const newProductsThisWeek = productsThisWeek.length;
  const newProductsLastWeek = productsLastWeek.length;
  const productsChange = newProductsLastWeek === 0 ? null : ((newProductsThisWeek - newProductsLastWeek) / newProductsLastWeek) * 100;

  // Conversion rate (dummy, needs real logic if available)
  const conversionRate = totalOrders === 0 ? 0 : (totalOrders / (totalProducts || 1)) * 100;
  const conversionRateLastMonth = ordersLastMonth.length === 0 ? 0 : (ordersLastMonth.length / (totalProducts || 1)) * 100;
  const conversionRateChange = conversionRateLastMonth === 0 ? null : ((conversionRate - conversionRateLastMonth) / conversionRateLastMonth) * 100;

  // Low stock products (less than 10 items)
  const lowStockProducts = products.filter(p => (p.stock || 0) < 10);

  // Recent orders (last 5) - enriched with customer info and vendor items
  const recentOrdersData = orders.slice(0, 5);
  const recentOrders = await Promise.all(
    recentOrdersData.map(async (order: any) => {
      // Fetch customer information
      let customerName = "Unknown Customer";
      try {
        const customer = await User.findOne({ email: order.customerId }).lean();
        if (customer) {
          customerName = customer.displayName || customer.name || customer.email || "Unknown Customer";
        }
      } catch (error) {
        console.error("Error fetching customer:", error);
      }

      // Filter items to only include this vendor's products
      const vendorItems = (order.items || []).filter((item: any) => {
        // Check if item has vendorId matching current vendor
        return item.vendorId === vendorId;
      });

      // Calculate total quantity for this order
      const totalQuantity = vendorItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

      return {
        ...order,
        customerName,
        vendorItems,
        totalQuantity,
      };
    })
  );

  return {
    totalRevenue,
    totalOrders,
    totalProducts,
    revenueChange,
    ordersChange,
    productsChange,
    newProductsThisWeek,
    conversionRate,
    conversionRateChange,
    lowStockProducts,
    recentOrders,
    totalServices: services.length,
    activeServices: services.filter((s: any) => s.status === 'active').length,
    totalBookings: bookings.length,
    pendingBookings: bookings.filter((b: any) => b.status === 'pending').length,
    recentBookings: bookings.slice(0, 5),
  };
}
