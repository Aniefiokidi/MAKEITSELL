// Shared expiry logic — same guard/atomicity discipline as
// app/api/admin/booking-payment-expiry-job/route.ts, extracted so the cron job and
// on-demand cleanup (called from the availability check, both web and bot) are the exact
// same code, not two copies that could drift. The cron stays as a backstop for slots
// nobody ever checks availability for again; on-demand cleanup is what actually matters
// day to day, since it frees a slot the moment someone tries to use it rather than
// waiting on a schedule (relevant regardless of Vercel plan, but especially since Hobby
// caps cron frequency at once/day).
import connectToDatabase from '@/lib/mongodb'
import { Booking } from '@/lib/models/Booking'

const DEFAULT_EXPIRY_MINUTES = 20
export const EXPIRY_CANCELLATION_REASON = 'Booking payment window expired'

export function getBookingExpiryMinutes(): number {
  const configured = Number(process.env.BOOKING_PAYMENT_EXPIRY_MINUTES)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_EXPIRY_MINUTES
}

// providerId omitted = global sweep (the cron's use case). Provided = scoped, cheap sweep
// (the on-demand use case — called synchronously inline in a user-facing request, so it
// only ever touches the one provider's stale bookings, not the whole collection).
export async function expireStalePendingBookings(options: { providerId?: string; expiryMinutes?: number } = {}): Promise<{ candidates: number; expired: number }> {
  await connectToDatabase()
  const expiryMinutes = options.expiryMinutes ?? getBookingExpiryMinutes()
  const cutoff = new Date(Date.now() - expiryMinutes * 60 * 1000)

  const query: Record<string, any> = {
    status: 'pending',
    paymentStatus: 'pending',
    requiresQuote: false,
    createdAt: { $lt: cutoff },
  }
  if (options.providerId) query.providerId = options.providerId

  const candidates = await Booking.find(query).select('_id').lean()

  let expiredCount = 0
  for (const candidate of candidates as any[]) {
    // Atomic, re-guarded on the exact fields the find above used — idempotent (an
    // already-expired or just-paid booking no longer matches and is silently skipped)
    // and safe to call from multiple concurrent requests (two buyers checking
    // availability for the same provider at once can't double-expire or race each other
    // into a bad state; each update either claims a given booking or doesn't).
    const expired = await Booking.findOneAndUpdate(
      { _id: candidate._id, status: 'pending', paymentStatus: 'pending' },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: EXPIRY_CANCELLATION_REASON,
        },
      },
      { new: false }
    )
    if (expired) expiredCount += 1
  }

  return { candidates: candidates.length, expired: expiredCount }
}
