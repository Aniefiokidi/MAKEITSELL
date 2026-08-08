import { NextRequest, NextResponse } from "next/server"
import { requireCronOrAdminAccess } from "@/lib/server-route-auth"
import { checkAndAlertShipbubbleWallet } from "@/lib/shipbubble-wallet-monitor"

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const result = await checkAndAlertShipbubbleWallet()
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error("Shipbubble wallet monitor job failed:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to run Shipbubble wallet monitor job" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
