import { NextRequest } from "next/server";
import { getVendorDashboard } from "@/lib/dashboard";
import { cookies } from "next/headers";
import { getUserBySessionToken } from "@/lib/auth";

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
    const lookbackDaysRaw = Number(searchParams.get("funnelDays") || "30");
    const funnelLookbackDays = Number.isFinite(lookbackDaysRaw) && lookbackDaysRaw > 0
      ? Math.min(180, Math.floor(lookbackDaysRaw))
      : 30;

    if (!vendorId) {
      return new Response(JSON.stringify({ success: false, error: "Missing vendorId" }), { status: 400 });
    }

    const dashboard = await getVendorDashboard(vendorId, { funnelLookbackDays });
    return new Response(JSON.stringify({ success: true, data: dashboard }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), { status: 500 });
  }
}
