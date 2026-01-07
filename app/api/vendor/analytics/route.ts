import { NextRequest } from "next/server";
import { getVendorAnalytics } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendorId");
    if (!vendorId) {
      return new Response(JSON.stringify({ success: false, error: "Missing vendorId" }), { status: 400 });
    }
    const analytics = await getVendorAnalytics(vendorId);
    return new Response(JSON.stringify({ success: true, data: analytics }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), { status: 500 });
  }
}
