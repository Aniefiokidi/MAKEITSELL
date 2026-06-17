import { NextRequest } from "next/server";
import { getOrdersByVendor, updateOrder } from "@/lib/mongodb-operations";
import connectToDatabase from "@/lib/mongodb";
import mongoose from "mongoose";
import { User } from "@/lib/models/User";
import { getSessionUserFromRequest } from "@/lib/server-route-auth";
import { resolveLogisticsRegion, logisticsEmailAllowedForRegion } from "@/lib/logistics-access";

const VENDOR_VISIBLE_PAYMENT_STATUSES = new Set([
  'escrow',
  'released',
  'disputed',
  'refunded',
  'paid',
  'successful',
  'success',
  'completed',
  'confirmed',
])

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(req)
    if (!sessionUser) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendorId");
    if (!vendorId) {
      return new Response(JSON.stringify({ success: false, error: "Missing vendorId" }), { status: 400 });
    }

    const isAdmin = sessionUser.role === 'admin'
    const isLogistics = logisticsEmailAllowedForRegion(sessionUser.email, resolveLogisticsRegion('lagos'))
      || logisticsEmailAllowedForRegion(sessionUser.email, resolveLogisticsRegion('abuja'))
    const isSameVendor = String(sessionUser.id || '') === String(vendorId || '')

    if (!isAdmin && !isLogistics && !isSameVendor) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), { status: 403 });
    }

    const orders = await getOrdersByVendor(vendorId);
    const paidOrders = (orders || []).filter((order: any) => {
      const paymentStatus = String(order?.paymentStatus || '').trim().toLowerCase()
      return VENDOR_VISIBLE_PAYMENT_STATUSES.has(paymentStatus)
    })

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (db) {
      const customerIds = Array.from(
        new Set(
          paidOrders
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

      for (const order of paidOrders) {
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

        order.status = vendorData?.status || order.status;
        order.vendor = vendorData || null;

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
            } catch {
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

    return new Response(JSON.stringify({ success: true, orders: paidOrders }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(req)
    if (!sessionUser) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 });
    }

    const isAdmin = sessionUser.role === 'admin'
    const isLogistics = logisticsEmailAllowedForRegion(sessionUser.email, resolveLogisticsRegion('lagos'))
      || logisticsEmailAllowedForRegion(sessionUser.email, resolveLogisticsRegion('abuja'))

    if (!isAdmin && !isLogistics) {
      return new Response(JSON.stringify({ success: false, error: "Vendors cannot change delivery status. Contact logistics or admin." }), { status: 403 });
    }

    const body = await req.json();
    const { orderId, status } = body || {};
    if (!orderId || !status) {
      return new Response(JSON.stringify({ success: false, error: "Missing orderId or status" }), { status: 400 });
    }

    await connectToDatabase();

    const now = new Date();
    const timestampUpdates: any = {};
    if (status === "confirmed" || status === "processing") {
      timestampUpdates.confirmedAt = now;
    } else if (status === "shipped" || status === "shipped_interstate") {
      timestampUpdates.shippedAt = now;
      timestampUpdates.confirmedAt = now;
    } else if (status === "out_for_delivery") {
      timestampUpdates.outForDeliveryAt = now;
      timestampUpdates.shippedAt = now;
      timestampUpdates.confirmedAt = now;
    } else if (status === "delivered") {
      timestampUpdates.deliveredAt = now;
    } else if (status === "cancelled") {
      timestampUpdates.cancelledAt = now;
    }

    const updated = await updateOrder(orderId, { status, ...timestampUpdates });
    if (!updated) {
      return new Response(JSON.stringify({ success: false, error: "Order not found" }), { status: 404 });
    }

    return new Response(JSON.stringify({ success: true, order: updated }), { status: 200 });
  } catch (error: any) {
    console.error('PATCH /api/vendor/orders error:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), { status: 500 });
  }
}
