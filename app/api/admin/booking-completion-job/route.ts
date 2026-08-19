import { NextRequest, NextResponse } from "next/server"
import { requireCronOrAdminAccess } from "@/lib/server-route-auth"
import { connectToDatabase } from "@/lib/mongodb"
import { Booking as BookingModel } from "@/lib/models/Booking"

// Bookings have no other path to 'completed' today — no cron, no UI button (confirmed:
// app/vendor/bookings/page.tsx only has approve/quote/reject handlers). Unlike goods
// orders, a booking's money isn't gated on completion (the deposit is charged at booking
// time, the balance is settled offline with the provider) — 'completed' is a pure
// lifecycle/reporting flag whose main effect is unlocking review eligibility
// (app/api/services/[id]/reviews/route.ts requires status:'completed').
//
// 24h after the scheduled end time, not 96h like the goods escrow-automation job — that
// longer window exists for courier-transit uncertainty, which doesn't apply to a fixed,
// already-known appointment time. Only 'confirmed' bookings are eligible: one still
// 'pending' past its appointment time was never approved by the provider and may never
// have happened, so auto-completing it would be wrong.
const COMPLETION_DELAY_MS = 24 * 60 * 60 * 1000
const SCAN_WINDOW_MS = 14 * 24 * 60 * 60 * 1000 // bound the scan to the last 14 days

function buildEndDateTime(bookingDate: Date, endTime: string): Date {
  const [hh, mm] = String(endTime || "18:00").split(":").map(Number)
  const dt = new Date(bookingDate)
  dt.setHours(Number.isFinite(hh) ? hh : 18, Number.isFinite(mm) ? mm : 0, 0, 0)
  return dt
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const now = new Date()
    const scanFloor = new Date(now.getTime() - SCAN_WINDOW_MS)

    const candidates = await BookingModel.find({
      status: "confirmed",
      bookingDate: { $gte: scanFloor, $lte: now },
    })
      .limit(500)
      .lean()

    let completed = 0

    for (const booking of candidates as any[]) {
      const endDateTime = buildEndDateTime(new Date(booking.bookingDate), booking.endTime)
      if (now.getTime() - endDateTime.getTime() < COMPLETION_DELAY_MS) continue

      const updated = await BookingModel.updateOne(
        { _id: booking._id, status: "confirmed" }, // re-guard: skip if cancelled concurrently
        { $set: { status: "completed", completedAt: now, updatedAt: now } }
      )
      if (updated.modifiedCount > 0) completed++
    }

    return NextResponse.json({ success: true, completed, scanned: candidates.length })
  } catch (error: any) {
    console.error("[booking-completion-job] failed:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Booking completion job failed" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
