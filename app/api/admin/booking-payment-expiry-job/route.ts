// Frees slots held by bookings whose Paystack deposit payment was never completed.
// lib/booking-payment.ts creates a booking as status: 'pending' BEFORE payment (this is
// what holds the slot against the double-booking check in
// lib/booking-availability.ts — it excludes only status: 'cancelled'). A buyer who
// abandons at Paystack leaves that hold in place forever unless something expires it.
// Mirrors app/api/admin/booking-sla-job/route.ts's existing quote-expiry pattern almost
// exactly, just triggered by createdAt age instead of quoteExpiresAt, and scoped to
// requiresQuote: false only — quote-pending bookings are that job's territory, not this
// one's (they're also status: 'pending'/paymentStatus: 'pending', but expire on a
// completely different clock).
import { NextRequest, NextResponse } from "next/server"
import { requireCronOrAdminAccess } from "@/lib/server-route-auth"
import { connectToDatabase } from "@/lib/mongodb"
import { Booking as BookingModel } from "@/lib/models/Booking"

const DEFAULT_EXPIRY_MINUTES = 20

function getExpiryMinutes(): number {
  const configured = Number(process.env.BOOKING_PAYMENT_EXPIRY_MINUTES)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_EXPIRY_MINUTES
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const expiryMinutes = getExpiryMinutes()
    const cutoff = new Date(Date.now() - expiryMinutes * 60 * 1000)

    // Candidates only — the actual expiry below re-guards each one atomically at update
    // time, so this list being slightly stale (another process touches one between the
    // find and the update) can't cause a wrong write, only a harmless skipped no-op.
    const candidates = await BookingModel.find({
      status: "pending",
      paymentStatus: "pending",
      requiresQuote: false,
      createdAt: { $lt: cutoff },
    }).select("_id").lean()

    let expiredCount = 0
    for (const candidate of candidates as any[]) {
      // Atomic, guarded on the exact same fields the find above used — the discipline
      // lib/order-payment-confirmation.ts and lib/booking-payment-confirmation.ts use for
      // their payment claims. This is what makes the job idempotent: a booking already
      // expired (by a previous run, or a concurrent one) no longer matches
      // status: 'pending', so re-running this is a no-op for it, not a double-expire.
      // Also what closes the race against a webhook confirming payment in the instant
      // between the find and this update: if that already flipped paymentStatus to
      // 'paid', this filter no longer matches and the update is skipped — the paid
      // booking is left alone.
      const expired = await BookingModel.findOneAndUpdate(
        { _id: candidate._id, status: "pending", paymentStatus: "pending" },
        {
          $set: {
            status: "cancelled",
            cancelledAt: new Date(),
            cancellationReason: "Booking payment window expired",
          },
        },
        { new: false }
      )
      if (expired) expiredCount += 1
    }

    return NextResponse.json({
      success: true,
      expiryMinutes,
      candidates: candidates.length,
      expired: expiredCount,
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
