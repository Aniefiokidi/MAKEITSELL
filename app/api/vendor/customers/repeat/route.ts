import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getUserBySessionToken } from "@/lib/auth";
import { getOrdersByVendor } from "@/lib/mongodb-operations";
import { buildCustomerSegments } from "@/lib/vendor-insights";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/lib/models/User";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("sessionToken")?.value;

    const currentUser = sessionToken ? await getUserBySessionToken(sessionToken) : null;
    if (!currentUser) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 });
    }

    if (currentUser.role !== 'vendor' && currentUser.role !== 'admin') {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const vendorId =
      (currentUser.role === "vendor" ? String(currentUser.id) : null) ||
      (currentUser.role === "admin" ? searchParams.get("vendorId") : null);

    if (!vendorId) {
      return new Response(JSON.stringify({ success: false, error: "Missing vendorId" }), { status: 400 });
    }

    await connectToDatabase();

    const orders = await getOrdersByVendor(vendorId) as any[];
    const segmentResult = buildCustomerSegments({ vendorId, orders });
    const repeatIds = segmentResult.segments.repeat;

    // orders is already sorted newest-first (getOrdersByVendor), so the first match per
    // customerId is their most recent order — use it for the freshest contact details.
    const latestOrderByCustomer = new Map<string, any>();
    for (const order of orders) {
      const customerId = String(order.customerId || '').trim();
      if (!customerId || latestOrderByCustomer.has(customerId)) continue;
      latestOrderByCustomer.set(customerId, order);
    }

    const accounts = repeatIds.length > 0
      ? await User.find({ _id: { $in: repeatIds } }).select('displayName name email phone phone_number').lean()
      : [];
    const accountById = new Map((accounts as any[]).map((a) => [String(a._id), a]));

    const customers = repeatIds.map((customerId) => {
      const summary = segmentResult.summaries[customerId];
      const latestOrder = latestOrderByCustomer.get(customerId);
      const shipping = latestOrder?.shippingInfo || {};
      const account = accountById.get(customerId);

      const name =
        `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim() ||
        account?.displayName || account?.name || 'Customer';
      const email = shipping.email || account?.email || '';
      const phone = shipping.phone || account?.phone || account?.phone_number || '';

      return {
        customerId,
        name,
        email,
        phone,
        orderCount: summary?.count || 0,
        totalSpent: summary?.spend || 0,
        lastOrderAt: summary?.lastOrderAt ? new Date(summary.lastOrderAt).toISOString() : null,
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);

    return new Response(JSON.stringify({ success: true, customers }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), { status: 500 });
  }
}
