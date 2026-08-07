// Pure booking-deposit math — split out from lib/booking-payment.ts specifically so it has
// zero server-only imports (no DB connection, no Paystack client) and can be safely
// imported from a "use client" component (components/services/BookingModal.tsx) for
// display purposes without pulling Mongoose into the browser bundle. Both the client
// display and the server-side charge must compute from these same two constants, or the
// number shown before payment and the number actually charged can drift.
export const BOOKING_FEE_NAIRA = 1000
export const BOOKING_DEPOSIT_RATE = 0.10

export function computeBookingDeposit(totalPrice: number): { depositAmount: number; bookingFeeAmount: number; balanceOwed: number; amountDueNow: number } {
  const total = Math.max(0, Number(totalPrice) || 0)
  const depositAmount = Math.round(total * BOOKING_DEPOSIT_RATE)
  const bookingFeeAmount = BOOKING_FEE_NAIRA
  const balanceOwed = Math.max(0, total - depositAmount)
  return { depositAmount, bookingFeeAmount, balanceOwed, amountDueNow: depositAmount + bookingFeeAmount }
}
