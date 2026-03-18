import { NextRequest, NextResponse } from "next/server"
import { getBookingsByProvider, getServiceById } from "@/lib/mongodb-operations"
import { getIcsBusyRanges } from "@/lib/calendar-sync"

function toMinutes(time: string): number {
  const [hours, minutes] = String(time || "00:00").split(":").map(Number)
  return (hours * 60) + minutes
}

function asDateOnly(value: Date): string {
  return value.toISOString().split("T")[0]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get("providerId") || ""
    const serviceId = searchParams.get("serviceId") || ""
    const dateParam = searchParams.get("date") || ""
    const excludeBookingId = searchParams.get("excludeBookingId") || ""

    if (!providerId || !dateParam) {
      return NextResponse.json(
        { success: false, error: "providerId and date are required" },
        { status: 400 }
      )
    }

    const targetDate = new Date(dateParam)
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid date" },
        { status: 400 }
      )
    }

    const bookings = await getBookingsByProvider(providerId)
    const dateKey = asDateOnly(targetDate)

    const blockedWindows = bookings
      .filter((item: any) => {
        if (!item?.bookingDate || item?.status === "cancelled") return false
        if (excludeBookingId && String(item?.id || "") === excludeBookingId) return false
        return asDateOnly(new Date(item.bookingDate)) === dateKey
      })
      .map((item: any) => ({
        startTime: item.startTime,
        endTime: item.endTime,
        source: "booking",
      }))

    let calendarWindows: Array<{ startTime: string; endTime: string; source: string }> = []

    if (serviceId) {
      const service = await getServiceById(serviceId)
      const icsUrl = typeof (service as any)?.externalCalendarIcsUrl === "string"
        ? String((service as any).externalCalendarIcsUrl).trim()
        : ""

      if (Boolean((service as any)?.calendarSyncEnabled) && icsUrl) {
        const from = new Date(targetDate)
        from.setHours(0, 0, 0, 0)
        const to = new Date(targetDate)
        to.setHours(23, 59, 59, 999)

        const busy = await getIcsBusyRanges({ icsUrl, from, to })
        calendarWindows = busy
          .filter((range) => asDateOnly(range.start) === dateKey || asDateOnly(range.end) === dateKey)
          .map((range) => ({
            startTime: `${String(range.start.getHours()).padStart(2, "0")}:${String(range.start.getMinutes()).padStart(2, "0")}`,
            endTime: `${String(range.end.getHours()).padStart(2, "0")}:${String(range.end.getMinutes()).padStart(2, "0")}`,
            source: "external_calendar",
          }))
      }
    }

    const merged = [...blockedWindows, ...calendarWindows]
      .filter((slot) => toMinutes(slot.endTime) > toMinutes(slot.startTime))
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))

    return NextResponse.json({
      success: true,
      data: merged,
    })
  } catch (error: any) {
    console.error("Availability API error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch availability" },
      { status: 500 }
    )
  }
}
