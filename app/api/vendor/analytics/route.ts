import { resolveStoreScope } from "@/lib/store-scope";
import { NextRequest } from "next/server";
import { getVendorAnalytics } from "@/lib/analytics";
import { requireRoles } from "@/lib/server-route-auth";

export async function GET(req: NextRequest) {
  try {
    const { user, response } = await requireRoles(req, ["vendor", "admin"]);
    if (response || !user) return response!;

    const { searchParams } = new URL(req.url);
    const vendorId =
      (user.role === "vendor" ? user.id : null) ||
      (user.role === "admin" ? searchParams.get("vendorId") : null);
    if (!vendorId) {
      return new Response(JSON.stringify({ success: false, error: "Missing vendorId" }), { status: 400 });
    }
    const storeId = searchParams.get('storeId');
    let scope;
    try { scope = storeId ? await resolveStoreScope(storeId, vendorId) : undefined; }
    catch { return new Response(JSON.stringify({ success: false, error: 'Invalid store ownership' }), { status: 403 }); }
    const analytics = await getVendorAnalytics(vendorId, scope);
    return new Response(JSON.stringify({ success: true, data: analytics }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), { status: 500 });
  }
}
