import { NextRequest } from "next/server";
import { getOrdersByVendor, updateOrder } from "@/lib/mongodb-operations";
import connectToDatabase from "@/lib/mongodb";
import mongoose from "mongoose";
import { User } from "@/lib/models/User";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendorId");
    if (!vendorId) {
      return new Response(JSON.stringify({ success: false, error: "Missing vendorId" }), { status: 400 });
    }
    const orders = await getOrdersByVendor(vendorId);
    
    // Enrich orders with product details
    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (db) {
      const customerIds = Array.from(
        new Set(
          orders
            .map((order: any) => String(order.customerId || '').trim())
            .filter(Boolean)
        )
      );

      const customers = customerIds.length > 0
        ? await User.find({ _id: { $in: customerIds } }, { _id: 1, name: 1, displayName: 1, email: 1, phone: 1 }).lean()
        : [];

      const customerById = new Map<string, any>();
      for (const customer of customers as any[]) {
        customerById.set(String(customer?._id || ''), customer);
      }

      for (const order of orders) {
        // Find vendor-specific items from vendors array
        const vendorData = order.vendors?.find((v: any) => v.vendorId === vendorId);
        const items = vendorData?.items || order.items || [];

        const customer = customerById.get(String(order.customerId || ''));
        const shipping = order.shippingInfo || {};
        order.customerName =
          customer?.name ||
          customer?.displayName ||
          `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim() ||
          order.customerName ||
          'N/A';
        order.customerEmail = shipping.email || customer?.email || order.customerEmail || '';
        order.customerPhone = shipping.phone || customer?.phone || order.customerPhone || '';

        // Ensure vendor view always reflects vendor-specific status when available.
        order.status = vendorData?.status || order.status;
        order.vendor = vendorData || null;
        
        // Fetch product details for each item
        const enrichedProducts = await Promise.all(
          items.map(async (item: any) => {
            try {
              const productId = new mongoose.Types.ObjectId(item.productId);
              const product = await db.collection('products').findOne({ _id: productId });
              
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
        
        order.products = enrichedProducts;
      }
    }
    
    return new Response(JSON.stringify({ success: true, orders }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, status, vendorId } = body || {};
    if (!orderId || !status) {
      return new Response(JSON.stringify({ success: false, error: "Missing orderId or status" }), { status: 400 });
    }

    await connectToDatabase();
    
    // Get existing Order model or create it safely
    let OrderModel;
    try {
      OrderModel = mongoose.model('Order');
    } catch (error) {
      // If model doesn't exist, create it
      const OrderSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
      OrderModel = mongoose.model('Order', OrderSchema);
    }

    // Map status to timestamp fields
    const now = new Date();
    const timestampUpdates: any = {};
    if (status === "confirmed" || status === "processing") {
      timestampUpdates.confirmedAt = now;
    } else if (status === "shipped" || status === "shipped_interstate") {
      timestampUpdates.shippedAt = now;
      // Auto-confirm when shipped
      timestampUpdates.confirmedAt = now;
    } else if (status === "out_for_delivery") {
      timestampUpdates.outForDeliveryAt = now;
      // Out for delivery implies shipped, so mark as shipped too
      timestampUpdates.shippedAt = now;
      timestampUpdates.confirmedAt = now;
    } else if (status === "delivered") {
      timestampUpdates.deliveredAt = now;
    } else if (status === "cancelled") {
      timestampUpdates.cancelledAt = now;
    }

    // If vendorId provided, update only that vendor's status in the vendors array
    if (vendorId) {
      const updated = await OrderModel.findByIdAndUpdate(
        orderId,
        {
          $set: {
            'vendors.$[elem].status': status,
            ...Object.fromEntries(Object.entries(timestampUpdates).map(([k, v]) => [`vendors.$[elem].${k}`, v]))
          }
        },
        {
          arrayFilters: [{ 'elem.vendorId': vendorId }],
          new: true
        }
      );
      if (!updated) {
        return new Response(JSON.stringify({ success: false, error: "Order not found" }), { status: 404 });
      }
      return new Response(JSON.stringify({ success: true, order: updated }), { status: 200 });
    } else {
      // Fallback: update global order status
      const updated = await updateOrder(orderId, { status, ...timestampUpdates });
      if (!updated) {
        return new Response(JSON.stringify({ success: false, error: "Order not found" }), { status: 404 });
      }
      return new Response(JSON.stringify({ success: true, order: updated }), { status: 200 });
    }
  } catch (error: any) {
    console.error('PATCH /api/vendor/orders error:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), { status: 500 });
  }
}
