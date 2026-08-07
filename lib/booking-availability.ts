// Double-booking prevention — extracted from app/api/database/bookings/route.ts's inline
// check so it has exactly one implementation, callable from both the booking API route
// and lib/booking-payment.ts (and, later, the WhatsApp booking flow) rather than each
// re-deriving it.
//
// This is a check-then-write guard, not a lock: it reads existing bookings, then the
// caller creates a new one afterward. Two requests racing within that window could both
// pass the check and both create conflicting bookings — a real gap, not new here (it's
// exactly the behavior this was extracted FROM), and not closed by this refactor. Closing
// it for real would need either a DB transaction (this deployment would need to be a
// replica set / Atlas for Mongoose sessions to work) or a short-lived slot-hold document
// with a unique index to serialize on — neither built here; flagging it is the ask for
// now, not fixing it.
import { getBookingsByProvider } from '@/lib/mongodb-operations'

export interface BookingConflict {
  date: any
  startTime: string
  endTime: string
  serviceTitle: string
}

function toLocalDateKey(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = String(timeStr || '').split(':').map(Number)
  return hours * 60 + minutes
}

// Non-stay (i.e. not a multi-night hospitality) booking conflict check — same-date,
// overlapping start/end time against any non-cancelled existing booking for the provider.
export async function findBookingSlotConflict(params: {
  providerId: string
  bookingDate: Date | string
  startTime: string
  endTime: string
  excludeBookingId?: string
}): Promise<BookingConflict | null> {
  const { providerId, bookingDate, startTime, endTime, excludeBookingId } = params
  const existingBookings = await getBookingsByProvider(providerId)
  const requestedDate = toLocalDateKey(new Date(bookingDate))
  const requestStart = parseTimeToMinutes(startTime)
  const requestEnd = parseTimeToMinutes(endTime)

  const conflict = existingBookings.find((booking: any) => {
    if (!booking.bookingDate) return false
    if (excludeBookingId && String(booking.id || '') === excludeBookingId) return false
    if (booking.status === 'cancelled') return false
    if (toLocalDateKey(new Date(booking.bookingDate)) !== requestedDate) return false

    const existingStart = parseTimeToMinutes(booking.startTime)
    const existingEnd = parseTimeToMinutes(booking.endTime)
    return requestStart < existingEnd && requestEnd > existingStart
  })

  if (!conflict) return null
  return {
    date: conflict.bookingDate,
    startTime: conflict.startTime,
    endTime: conflict.endTime,
    serviceTitle: conflict.serviceTitle,
  }
}
