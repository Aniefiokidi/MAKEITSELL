// Booking equivalent of lib/order-payment-confirmation.ts's handleOrderPaid — same reason
// to exist (called from BOTH the browser-redirect callback,
// app/api/payments/booking-verify/route.ts, and the real server-to-server Paystack
// webhook, app/api/payments/webhook/route.ts, either of which can fire first or fire
// twice) and the same idempotency mechanism: an atomic findOneAndUpdate whose filter only
// matches a booking that hasn't already been marked paid. Not a shared function with
// handleOrderPaid itself — different model, different side effects (no courier dispatch
// or stock decrement here) — but deliberately the same shape.
import connectToDatabase from '@/lib/mongodb'
import { Booking } from '@/lib/models/Booking'
import { getUserById } from '@/lib/mongodb-operations'
import { AppointmentEmailService } from '@/lib/appointment-emails'
import { sendBookingConfirmationSms } from '@/lib/sms'
import { findBookingSlotConflict } from '@/lib/booking-availability'
import { EXPIRY_CANCELLATION_REASON } from '@/lib/booking-expiry'
import { notifyWaBuyerBookingPaid } from '@/lib/whatsapp/service-booking'

export async function handleBookingPaid(
  bookingId: string,
  paymentReference: string,
  paymentData: any
): Promise<{ claimed: boolean }> {
  await connectToDatabase()

  // Guards on status too, not just paymentStatus — a booking the expiry job already
  // cancelled must not be silently resurrected as confirmed just because a late Paystack
  // payment finally lands. See handleLatePaymentOnExpiredBooking below for what happens
  // to that money instead of just dropping it.
  const claimedBooking: any = await Booking.findOneAndUpdate(
    { _id: bookingId, paymentStatus: { $ne: 'paid' }, status: { $ne: 'cancelled' } },
    {
      $set: {
        status: 'confirmed',
        paymentStatus: 'paid',
        bookingFeeStatus: 'charged',
        paymentReference,
        paymentData,
        paidAt: new Date(),
      },
    },
    { new: true, lean: true }
  )

  if (!claimedBooking) {
    const existing: any = await Booking.findById(bookingId).lean()
    if (existing?.status === 'cancelled' && existing?.cancellationReason === EXPIRY_CANCELLATION_REASON && existing?.paymentStatus !== 'paid') {
      await handleLatePaymentOnExpiredBooking(existing, paymentReference, paymentData)
    } else {
      console.log(`[booking-payment] handleBookingPaid: booking ${bookingId} not claimed (already paid, or no such booking) — skipping downstream side effects`)
    }
    return { claimed: false }
  }

  console.log(`[booking-payment] handleBookingPaid: booking ${bookingId} claimed — running downstream side effects`)
  await sendBookingConfirmedNotifications(claimedBooking, bookingId)

  return { claimed: true }
}

// Split out from handleBookingPaid so the repair path below (a late payment landing on a
// booking the expiry job already closed, where the slot turns out to still be free) can
// send the exact same confirmation notifications a normal on-time payment would, instead
// of duplicating this block.
async function sendBookingConfirmedNotifications(claimedBooking: any, bookingId: string): Promise<void> {
  try {
    const provider = await getUserById(claimedBooking.providerId)
    const providerEmail = String(provider?.email || '').trim()

    const emailPayload = {
      bookingId: claimedBooking._id?.toString?.() || bookingId,
      customerName: claimedBooking.customerName,
      customerEmail: claimedBooking.customerEmail,
      customerPhone: claimedBooking.customerPhone,
      providerName: claimedBooking.providerName,
      providerEmail,
      serviceTitle: claimedBooking.serviceTitle,
      bookingDate: new Date(claimedBooking.bookingDate),
      startTime: claimedBooking.startTime,
      endTime: claimedBooking.endTime,
      duration: claimedBooking.duration || 60,
      location: claimedBooking.location,
      locationType: claimedBooking.locationType || 'in-person',
      totalPrice: claimedBooking.totalPrice,
      status: claimedBooking.status || 'confirmed',
      notes: claimedBooking.notes,
    } as const

    if (String(claimedBooking.customerEmail || '').trim()) {
      await AppointmentEmailService.sendCustomerBookingConfirmation(emailPayload as any)
    }
    if (providerEmail) {
      await AppointmentEmailService.sendProviderBookingNotification(emailPayload as any)
    }

    if (String(claimedBooking.customerPhone || '').trim()) {
      await sendBookingConfirmationSms({
        phoneNumber: String(claimedBooking.customerPhone || '').trim(),
        bookingId: emailPayload.bookingId,
        serviceTitle: String(claimedBooking.serviceTitle || '').trim(),
        bookingDate: new Date(claimedBooking.bookingDate),
        startTime: String(claimedBooking.startTime || '').trim(),
        endTime: String(claimedBooking.endTime || '').trim(),
        totalPrice: Number(claimedBooking.totalPrice || 0),
        recipient: 'customer',
        status: 'confirmed',
      })
    }

    const providerPhone = String((provider as any)?.phone_number || (provider as any)?.phone || '').trim()
    if (providerPhone) {
      await sendBookingConfirmationSms({
        phoneNumber: providerPhone,
        bookingId: emailPayload.bookingId,
        serviceTitle: String(claimedBooking.serviceTitle || '').trim(),
        bookingDate: new Date(claimedBooking.bookingDate),
        startTime: String(claimedBooking.startTime || '').trim(),
        endTime: String(claimedBooking.endTime || '').trim(),
        totalPrice: Number(claimedBooking.totalPrice || 0),
        recipient: 'provider',
        counterpartyName: String(claimedBooking.customerName || '').trim(),
        status: 'confirmed',
      })
    }
  } catch (error) {
    console.error('[booking-payment] Booking confirmation notifications failed:', error)
  }

  // No-ops for a web-originated booking (WhatsAppBuyer lookup by customerId simply won't
  // match) — always safe to call unconditionally, same as notifyWaBuyerOrderPaid.
  notifyWaBuyerBookingPaid(String(claimedBooking.customerId || ''), bookingId, claimedBooking)
}

// A Paystack payment confirmed for a booking the expiry job already cancelled — the buyer
// paid right around the cutoff. Two possible realities:
//   1. Nobody else has taken the slot since — safe to honor the late payment. Repairs the
//      booking back to confirmed/paid atomically, guarded on it still being the exact
//      expired state this function was called for (so two racing repair attempts, or a
//      repair racing a deliberate admin cancel, can't both/wrongly succeed).
//   2. Someone else has since booked that slot — a genuine conflict. Real money was
//      charged for a slot that's no longer available. There's no refund integration built
//      (a distinct, non-trivial task on its own — not built here), so this can't be fully
//      auto-resolved: it's marked paymentStatus: 'paid' (never hide that money arrived)
//      while leaving status: 'cancelled' (never re-block the slot someone else legitimately
//      holds), and logged at error level so it's discoverable — this specific combination
//      (paid + cancelled) is the queryable signal for "needs manual refund or reschedule."
async function handleLatePaymentOnExpiredBooking(expiredBooking: any, paymentReference: string, paymentData: any): Promise<void> {
  const bookingId = String(expiredBooking._id)
  const conflict = expiredBooking.stayDetails
    ? null // Hospitality stay conflicts aren't handled by findBookingSlotConflict — out of scope here, same as the expiry job itself only targeting non-stay bookings implicitly via requiresQuote: false.
    : await findBookingSlotConflict({
        providerId: expiredBooking.providerId,
        bookingDate: expiredBooking.bookingDate,
        startTime: expiredBooking.startTime,
        endTime: expiredBooking.endTime,
        excludeBookingId: bookingId,
      })

  if (!conflict) {
    const repaired: any = await Booking.findOneAndUpdate(
      { _id: bookingId, status: 'cancelled', cancellationReason: EXPIRY_CANCELLATION_REASON, paymentStatus: { $ne: 'paid' } },
      {
        $set: {
          status: 'confirmed',
          paymentStatus: 'paid',
          bookingFeeStatus: 'charged',
          paymentReference,
          paymentData,
          paidAt: new Date(),
        },
        $unset: { cancelledAt: '', cancellationReason: '' },
      },
      { new: true, lean: true }
    )

    if (repaired) {
      console.log(`[booking-payment] Late payment repaired expired booking ${bookingId} — slot was still free`)
      await sendBookingConfirmedNotifications(repaired, bookingId)
    } else {
      console.log(`[booking-payment] Late payment for booking ${bookingId} arrived but it was already resolved by something else — skipping`)
    }
    return
  }

  await Booking.updateOne(
    { _id: bookingId },
    {
      $set: {
        paymentStatus: 'paid',
        paymentReference,
        paymentData,
        paidAt: new Date(),
        cancellationReason: `${EXPIRY_CANCELLATION_REASON} — payment later received but the slot was rebooked; needs manual refund or reschedule`,
      },
    }
  )
  console.error(`[booking-payment] NEEDS MANUAL REVIEW: booking ${bookingId} paid after expiry, but its slot is now held by another booking. Customer was charged; slot cannot be auto-restored. Reference: ${paymentReference}`)
}
