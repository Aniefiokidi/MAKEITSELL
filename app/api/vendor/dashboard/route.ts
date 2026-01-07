import { NextRequest } from "next/server";
import { getVendorDashboard } from "@/lib/dashboard";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendorId");
    if (!vendorId) {
      return new Response(JSON.stringify({ success: false, error: "Missing vendorId" }), { status: 400 });
    }
    const dashboard = await getVendorDashboard(vendorId);
    return new Response(JSON.stringify({ success: true, data: dashboard }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), { status: 500 });
  }
}
