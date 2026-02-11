import { getOrdersByVendor, getVendorProducts, getServices, getBookingsByProvider, getProductById } from "./mongodb-operations";
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
  const recentOrdersData = orders.slice(0, 5); // Already sorted by DB query
  const recentOrders = await Promise.all(
    recentOrdersData.map(async (order: any) => {
      // Fetch customer information - customerId is the user's MongoDB _id
      let customerName = "Unknown Customer";
      try {
        // Try finding by _id (customerId is stored as the user's ID)
        const customer = await User.findById(order.customerId).lean();
        
        if (customer) {
          customerName = customer.displayName || customer.name || customer.email || "Unknown Customer";
        } else if (order.customerId) {
          // Fallback: if ID looks like an email, show it
          if (order.customerId.includes('@')) {
            customerName = order.customerId;
          }
        }
      } catch (error) {
        console.error("Error fetching customer:", error);
        // If customerId is an email, use it
        if (order.customerId?.includes('@')) {
          customerName = order.customerId;
        }
      }

      // Find vendor-specific items from vendors array (same logic as orders API)
      const vendorData = order.vendors?.find((v: any) => v.vendorId === vendorId);
      const items = vendorData?.items || order.items || [];

      // Enrich items with product details
      const enrichedItems = await Promise.all(
        items.map(async (item: any) => {
          try {
            const product = await getProductById(item.productId);
            return {
              ...item,
              title: item.name || product?.name || 'Unknown Product',
              image: item.image || product?.images?.[0] || '',
              price: item.price || product?.price || 0
            };
          } catch (err) {
            return {
              ...item,
              title: item.name || 'Unknown Product',
              image: item.image || '',
              price: item.price || 0
            };
          }
        })
      );

      // Calculate total quantity for this order
      const totalQuantity = enrichedItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

      return {
        ...order,
        customerName,
        vendorItems: enrichedItems,
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
