import { NextRequest, NextResponse } from "next/server"
import { requireCronOrAdminAccess } from "@/lib/server-route-auth"
import { connectToDatabase } from "@/lib/mongodb"
import { Booking as BookingModel } from "@/lib/models/Booking"
import { User as UserModel } from "@/lib/models/User"
import { AppointmentEmailService } from "@/lib/appointment-emails"
import { pushToUser } from "@/lib/push-notifications"

function buildStartDateTime(bookingDate: Date, startTime: string): Date {
  const [hh, mm] = String(startTime || "09:00").split(":").map(Number)
  const dt = new Date(bookingDate)
  dt.setHours(Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0, 0, 0)
  return dt
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const now = new Date()

    // Fetch confirmed/pending bookings in the next 27 hours (generous window)
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const endOfWindow = new Date(now.getTime() + 27 * 60 * 60 * 1000)

    const candidates = await BookingModel.find({
      status: { $in: ["confirmed", "pending"] },
      bookingDate: { $gte: startOfToday, $lte: endOfWindow },
      $or: [
        { reminderSent24h: { $ne: true } },
        { reminderSentDayOf: { $ne: true } },
      ],
    }).lean()

    let sent24h = 0
    let sentDayOf = 0

    for (const booking of candidates as any[]) {
      const startDateTime = buildStartDateTime(new Date(booking.bookingDate), booking.startTime)
      const hoursUntil = (startDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

      if (hoursUntil < 0 || hoursUntil > 27) continue

      const [customer, provider] = await Promise.all([
        UserModel.findById(String(booking.customerId)).lean(),
        UserModel.findById(String(booking.providerId)).lean(),
      ])

      const customerEmail = (customer as any)?.email || booking.customerEmail
      const providerEmail = (provider as any)?.email
      const customerName = booking.customerName || (customer as any)?.name || "Customer"
      const providerName = booking.providerName || (provider as any)?.name || "Provider"
      const serviceTitle = booking.serviceTitle || "Service"

      const baseEmailParams = {
        bookingId: String(booking._id),
        customerName,
        customerEmail,
        providerName,
        serviceTitle,
        bookingDate: new Date(booking.bookingDate),
        startTime: booking.startTime,
        endTime: booking.endTime,
        location: booking.location || "",
        locationType: booking.locationType || "in-person",
        totalPrice: Number(booking.finalPrice ?? booking.totalPrice ?? 0),
      }

      // ── 24-hour reminder (22 – 26 hours before) ─────────────────────────────
      if (!booking.reminderSent24h && hoursUntil >= 22 && hoursUntil <= 26) {
        const pushBody = `${serviceTitle} is tomorrow at ${booking.startTime}`

        await Promise.allSettled([
          pushToUser(String(booking.customerId), {
            title: "Appointment Tomorrow",
            body: pushBody,
            url: "/appointments",
            tag: `reminder-24h-${booking._id}`,
          }),
          booking.providerId
            ? pushToUser(String(booking.providerId), {
                title: "Booking Tomorrow",
                body: `${customerName} — ${serviceTitle} at ${booking.startTime}`,
                url: "/vendor/bookings",
                tag: `reminder-24h-prov-${booking._id}`,
              })
            : Promise.resolve(),
          providerEmail
            ? AppointmentEmailService.sendBookingReminderEmails({
                ...baseEmailParams,
                providerEmail,
                timing: "day-before",
              })
            : Promise.resolve(),
        ])

        await BookingModel.updateOne(
          { _id: booking._id },
          { $set: { reminderSent24h: true } }
        )
        sent24h++
      }

      // ── Day-of reminder (1 – 3 hours before) ────────────────────────────────
      if (!booking.reminderSentDayOf && hoursUntil >= 0.5 && hoursUntil <= 3) {
        const hoursLabel = hoursUntil < 1.5 ? "in about 1 hour" : `in about ${Math.round(hoursUntil)} hours`
        const pushBody = `${serviceTitle} starts ${hoursLabel}`

        await Promise.allSettled([
          pushToUser(String(booking.customerId), {
            title: "Appointment Today",
            body: pushBody,
            url: "/appointments",
            tag: `reminder-dayof-${booking._id}`,
          }),
          booking.providerId
            ? pushToUser(String(booking.providerId), {
                title: "Booking Today",
                body: `${customerName} — ${serviceTitle} at ${booking.startTime}`,
                url: "/vendor/bookings",
                tag: `reminder-dayof-prov-${booking._id}`,
              })
            : Promise.resolve(),
          providerEmail
            ? AppointmentEmailService.sendBookingReminderEmails({
                ...baseEmailParams,
                providerEmail,
                timing: "day-of",
              })
            : Promise.resolve(),
        ])

        await BookingModel.updateOne(
          { _id: booking._id },
          { $set: { reminderSentDayOf: true } }
        )
        sentDayOf++
      }
    }

    return NextResponse.json({ success: true, sent24h, sentDayOf })
  } catch (error: any) {
    console.error("[booking-reminder-job] failed:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Reminder job failed" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
