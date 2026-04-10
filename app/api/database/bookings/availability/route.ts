import { NextRequest, NextResponse } from "next/server"
import { getBookingsByProvider, getServiceById } from "@/lib/mongodb-operations"
import { getIcsBusyRanges } from "@/lib/calendar-sync"

function toMinutes(time: string): number {
  const [hours, minutes] = String(time || "00:00").split(":").map(Number)
  return (hours * 60) + minutes
}

function asDateOnly(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get("providerId") || ""
    const serviceId = searchParams.get("serviceId") || ""
    const dateParam = searchParams.get("date") || ""
    const checkInParam = searchParams.get("checkInDate") || ""
    const checkOutParam = searchParams.get("checkOutDate") || ""
    const roomTypeId = searchParams.get("roomTypeId") || ""
    const excludeBookingId = searchParams.get("excludeBookingId") || ""

    const hasStayQuery = Boolean(checkInParam && checkOutParam && serviceId && roomTypeId)

    if (!providerId || (!dateParam && !hasStayQuery)) {
      return NextResponse.json(
        { success: false, error: "providerId and either date or stay parameters are required" },
        { status: 400 }
      )
    }

    const bookings = await getBookingsByProvider(providerId)

    if (hasStayQuery) {
      const checkInDate = new Date(checkInParam)
      const checkOutDate = new Date(checkOutParam)
      if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
        return NextResponse.json(
          { success: false, error: "Invalid stay date range" },
          { status: 400 }
        )
      }

      const service = await getServiceById(serviceId)
      const roomTypes = Array.isArray((service as any)?.hospitalityDetails?.roomTypes)
        ? (service as any).hospitalityDetails.roomTypes
        : []
      const roomType = roomTypes.find((item: any) => String(item?.id || "") === roomTypeId)
      const totalRooms = Math.max(0, Number(roomType?.roomCount || 0))

      const bookedRooms = bookings
        .filter((item: any) => {
          if (!item || item.status === "cancelled") return false
          if (excludeBookingId && String(item?.id || "") === excludeBookingId) return false
          const stay = item?.stayDetails
          if (!stay?.checkInDate || !stay?.checkOutDate) return false
          if (String(stay?.roomTypeId || "") !== roomTypeId) return false
          const existingCheckIn = new Date(stay.checkInDate)
          const existingCheckOut = new Date(stay.checkOutDate)
          if (Number.isNaN(existingCheckIn.getTime()) || Number.isNaN(existingCheckOut.getTime())) return false
          return rangesOverlap(checkInDate, checkOutDate, existingCheckIn, existingCheckOut)
        })
        .reduce((sum: number, item: any) => sum + Math.max(0, Number(item?.stayDetails?.rooms || 1)), 0)

      const remainingRooms = Math.max(0, totalRooms - bookedRooms)

      return NextResponse.json({
        success: true,
        data: [],
        stayAvailability: {
          roomTypeId,
          totalRooms,
          bookedRooms,
          remainingRooms,
          isBookedOut: remainingRooms <= 0,
        },
      })
    }

    const targetDate = new Date(dateParam)
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid date" },
        { status: 400 }
      )
    }

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
