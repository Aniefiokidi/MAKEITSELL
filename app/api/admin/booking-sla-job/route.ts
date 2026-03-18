import { NextRequest, NextResponse } from "next/server"
import { requireCronOrAdminAccess } from "@/lib/server-route-auth"
import { connectToDatabase } from "@/lib/mongodb"
import { Booking as BookingModel } from "@/lib/models/Booking"
import { User as UserModel } from "@/lib/models/User"
import { AppointmentEmailService } from "@/lib/appointment-emails"

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const now = new Date()
    const reminderWindowStart = new Date(now.getTime() + (5 * 60 * 60 * 1000))
    const reminderWindowEnd = new Date(now.getTime() + (6 * 60 * 60 * 1000))

    const reminderTargets = await BookingModel.find({
      requiresQuote: true,
      status: "pending",
      pricingStatus: "quoted",
      quoteExpiresAt: { $gte: reminderWindowStart, $lte: reminderWindowEnd },
      $or: [
        { quoteReminderSentAt: { $exists: false } },
        { quoteReminderSentAt: null },
      ],
    }).lean()

    let remindersSent = 0
    for (const booking of reminderTargets as any[]) {
      const customer = await UserModel.findById(String(booking.customerId)).lean()
      if (!customer?.email) continue

      const sent = await AppointmentEmailService.sendQuoteReminderEmail({
        customerEmail: customer.email,
        customerName: booking.customerName || customer.name || "Customer",
        providerName: booking.providerName || "Provider",
        serviceTitle: booking.serviceTitle || "Service",
        bookingDate: new Date(booking.bookingDate),
        startTime: booking.startTime,
        quoteAmount: booking.finalPrice,
        quoteExpiresAt: new Date(booking.quoteExpiresAt),
      })

      if (sent) {
        remindersSent += 1
        await BookingModel.updateOne(
          { _id: booking._id },
          {
            $set: { quoteReminderSentAt: now },
            $inc: { quoteReminderCount: 1 },
          }
        )
      }
    }

    const expiredTargets = await BookingModel.find({
      requiresQuote: true,
      status: "pending",
      pricingStatus: "quoted",
      quoteExpiresAt: { $lt: now },
    }).lean()

    let quotesExpired = 0
    for (const booking of expiredTargets as any[]) {
      await BookingModel.updateOne(
        { _id: booking._id },
        {
          $set: {
            status: "cancelled",
            quoteExpiredAt: now,
            cancelledAt: now,
            cancellationReason: "Quote SLA expired",
          },
        }
      )

      const [customer, provider] = await Promise.all([
        UserModel.findById(String(booking.customerId)).lean(),
        UserModel.findById(String(booking.providerId)).lean(),
      ])

      if (customer?.email && provider?.email) {
        await AppointmentEmailService.sendQuoteExpiredEmail({
          customerEmail: customer.email,
          customerName: booking.customerName || customer.name || "Customer",
          providerEmail: provider.email,
          providerName: booking.providerName || provider.name || "Provider",
          serviceTitle: booking.serviceTitle || "Service",
        })
      }
      quotesExpired += 1
    }

    return NextResponse.json({
      success: true,
      remindersSent,
      quotesExpired,
    })
  } catch (error: any) {
    console.error("Booking SLA job failed:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to run booking SLA job" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
