// Backstop sweep for stale pending bookings — the primary defense is now on-demand
// (lib/booking-expiry.ts's expireStalePendingBookings is also called inline whenever
// availability is computed, both web and bot, so a slot frees the moment someone tries to
// use it). This cron catches anything nobody ever checks availability for again — a slot
// that's simply never revisited would otherwise stay held forever even though on-demand
// cleanup exists. Both call the exact same guarded/atomic logic; see that file for the
// idempotency/race discussion.
import { NextRequest, NextResponse } from "next/server"
import { requireCronOrAdminAccess } from "@/lib/server-route-auth"
import { expireStalePendingBookings, getBookingExpiryMinutes } from "@/lib/booking-expiry"

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const result = await expireStalePendingBookings()
    return NextResponse.json({
      success: true,
      expiryMinutes: getBookingExpiryMinutes(),
      ...result,
    })
  } catch (error: any) {
    console.error("Booking payment expiry job failed:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to run booking payment expiry job" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
