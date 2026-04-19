"use client"

import { useEffect, useState } from "react"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { Calendar, Clock, MapPin, Phone, CheckCircle2, XCircle, Clock3, Download, List, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns"

interface Booking {
  id: string
  serviceId: string
  customerId: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  serviceName?: string
  serviceTitle?: string
  bookingDate: string | Date
  startTime: string
  endTime: string
  duration: number
  totalPrice: number
  estimatedPrice?: number
  finalPrice?: number | null
  pricingStatus?: "estimated" | "quoted" | "accepted"
  quoteSentAt?: string | Date
  quoteExpiresAt?: string | Date
  quoteReminderCount?: number
  requiresQuote?: boolean
  selectedPackageName?: string
  status: "pending" | "confirmed" | "completed" | "cancelled"
  locationType: string
  location: string
  notes: string
  requirementDetails?: {
    event?: {
      name?: string
      date?: string
      guestCount?: number
      venue?: string
    }
    logistics?: {
      pickupAddress?: string
      dropoffAddress?: string
      packageDescription?: string
      receiverName?: string
      receiverPhone?: string
    }
    creative?: {
      preferredPlatform?: string
      deliverableFormat?: string
    }
  }
}

export default function VendorBookingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("pending")
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()))
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "ics">("csv")
  const [exportScope, setExportScope] = useState<"all" | "month" | "day">("month")
  const [quoteValues, setQuoteValues] = useState<Record<string, string>>({})
  const [quoteSlaHours, setQuoteSlaHours] = useState<Record<string, string>>({})

  useEffect(() => {
    if (user) {
      fetchBookings()
    }
  }, [user])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/database/bookings?providerId=${user?.uid}`)
      const json = await res.json()
      const list = Array.isArray(json) ? json : json.data
      setBookings(list || [])
    } catch (error) {
      console.error("Error fetching bookings:", error)
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/database/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      })
      if (res.ok) {
        setBookings(bookings.map((b) => (b.id === bookingId ? { ...b, status: "confirmed" } : b)))
        toast({ title: "Booking Approved", description: "The booking has been confirmed." })
      }
    } catch (error) {
      console.error("Error approving booking:", error)
      toast({ title: "Error", description: "Failed to approve booking.", variant: "destructive" })
    }
  }

  const handleSendQuote = async (booking: Booking) => {
    const quoteValue = Number(quoteValues[booking.id])
    const slaHours = Number(quoteSlaHours[booking.id] || 24)
    if (!Number.isFinite(quoteValue) || quoteValue <= 0) {
      toast({ title: "Invalid quote", description: "Enter a valid quote amount.", variant: "destructive" })
      return
    }
    if (!Number.isFinite(slaHours) || slaHours < 1 || slaHours > 168) {
      toast({ title: "Invalid SLA", description: "Quote SLA must be between 1 and 168 hours.", variant: "destructive" })
      return
    }

    const quoteExpiresAt = new Date(Date.now() + (slaHours * 60 * 60 * 1000))

    try {
      const res = await fetch(`/api/database/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricingStatus: "quoted",
          finalPrice: quoteValue,
          estimatedPrice: booking.estimatedPrice ?? booking.totalPrice,
          status: "pending",
          quoteExpiresAt,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to send quote")
      }

      setBookings((prev) =>
        prev.map((item) =>
          item.id === booking.id
            ? { ...item, pricingStatus: "quoted", finalPrice: quoteValue, totalPrice: quoteValue, quoteExpiresAt }
            : item
        )
      )

      toast({ title: "Quote sent", description: "Customer can now accept or reject this quote." })
    } catch (error) {
      console.error("Error sending quote:", error)
      toast({ title: "Error", description: "Failed to send quote.", variant: "destructive" })
    }
  }

  const handleReject = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/database/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      })
      if (res.ok) {
        setBookings(bookings.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b)))
        toast({ title: "Booking Rejected", description: "The booking has been cancelled." })
      }
    } catch (error) {
      console.error("Error rejecting booking:", error)
      toast({ title: "Error", description: "Failed to reject booking.", variant: "destructive" })
    }
  }

  const pendingBookings = bookings.filter((b) => b.status === "pending")
  const confirmedBookings = bookings.filter((b) => b.status === "confirmed")
  const completedBookings = bookings.filter((b) => b.status === "completed")
  const cancelledBookings = bookings.filter((b) => b.status === "cancelled")

  const bookingDateKey = (value: string | Date) => format(new Date(value), "yyyy-MM-dd")

  const bookingsByDate = bookings.reduce<Record<string, Booking[]>>((acc, booking) => {
    const key = bookingDateKey(booking.bookingDate)
    if (!acc[key]) acc[key] = []
    acc[key].push(booking)
    return acc
  }, {})

  const selectedDateKey = format(selectedDate, "yyyy-MM-dd")
  const selectedDayBookings = (bookingsByDate[selectedDateKey] || []).sort((a, b) => {
    const aStart = String(a.startTime || "")
    const bStart = String(b.startTime || "")
    return aStart.localeCompare(bStart)
  })

  const monthGridDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  })

  const mobileDateStrip = eachDayOfInterval({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end: addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 13),
  })

  const toIcsDate = (dateValue: string | Date, timeValue: string) => {
    const date = new Date(dateValue)
    const [hh, mm] = String(timeValue || "00:00").split(":").map(Number)
    date.setHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0)
    const yyyy = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const hours = String(date.getHours()).padStart(2, "0")
    const mins = String(date.getMinutes()).padStart(2, "0")
    const secs = String(date.getSeconds()).padStart(2, "0")
    return `${yyyy}${month}${day}T${hours}${mins}${secs}`
  }

  const downloadFile = (filename: string, mime: string, content: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const getExportBookings = () => {
    if (exportScope === "day") {
      return selectedDayBookings
    }

    if (exportScope === "month") {
      return bookings.filter((booking) => isSameMonth(new Date(booking.bookingDate), currentMonth))
    }

    return bookings
  }

  const exportBookings = () => {
    const rows = getExportBookings()
    if (rows.length === 0) {
      toast({ title: "No data", description: "There are no bookings in the selected export scope.", variant: "destructive" })
      return
    }

    const suffix = exportScope === "day"
      ? format(selectedDate, "yyyy-MM-dd")
      : exportScope === "month"
      ? format(currentMonth, "yyyy-MM")
      : "all"

    if (exportFormat === "json") {
      downloadFile(
        `vendor-bookings-${suffix}.json`,
        "application/json;charset=utf-8",
        JSON.stringify(rows, null, 2)
      )
      return
    }

    if (exportFormat === "csv") {
      const header = [
        "bookingId",
        "service",
        "customerName",
        "customerEmail",
        "customerPhone",
        "date",
        "startTime",
        "endTime",
        "status",
        "amount",
        "location",
      ]
      const lines = rows.map((row) => [
        row.id,
        row.serviceName || row.serviceTitle || "",
        row.customerName || "",
        row.customerEmail || "",
        row.customerPhone || "",
        format(new Date(row.bookingDate), "yyyy-MM-dd"),
        row.startTime || "",
        row.endTime || "",
        row.status,
        String(Number(row.finalPrice ?? row.totalPrice ?? row.estimatedPrice ?? 0)),
        row.location || "",
      ])
      const csv = [header, ...lines]
        .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
        .join("\n")
      downloadFile(`vendor-bookings-${suffix}.csv`, "text/csv;charset=utf-8", csv)
      return
    }

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MakeItSell//VendorBookings//EN",
      ...rows.flatMap((row) => {
        const summary = (row.serviceName || row.serviceTitle || "Service Booking").replace(/[,;\\]/g, "")
        const customer = (row.customerName || "Customer").replace(/[,;\\]/g, "")
        const location = (row.location || "").replace(/[,;\\]/g, "")
        const description = `Customer: ${customer} | Status: ${row.status} | Phone: ${row.customerPhone || "N/A"}`.replace(/[,;\\]/g, "")
        return [
          "BEGIN:VEVENT",
          `UID:${row.id}@makeitsell.ng`,
          `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss")}`,
          `DTSTART:${toIcsDate(row.bookingDate, row.startTime)}`,
          `DTEND:${toIcsDate(row.bookingDate, row.endTime)}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${description}`,
          `LOCATION:${location}`,
          "END:VEVENT",
        ]
      }),
      "END:VCALENDAR",
    ].join("\n")

    downloadFile(`vendor-bookings-${suffix}.ics`, "text/calendar;charset=utf-8", lines)
  }

  const getPricingStatusColor = (status?: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-100 text-green-800"
      case "quoted":
        return "bg-blue-100 text-blue-800"
      case "estimated":
      default:
        return "bg-amber-100 text-amber-800"
    }
  }

  const getRequirementHighlights = (booking: Booking) => {
    const details = booking.requirementDetails
    if (!details) return [] as string[]

    if (details.event) {
      return [
        details.event.name ? `Event: ${details.event.name}` : "",
        details.event.date ? `Date: ${details.event.date}` : "",
        Number(details.event.guestCount || 0) > 0 ? `Guests: ${details.event.guestCount}` : "",
        details.event.venue ? `Venue: ${details.event.venue}` : "",
      ].filter(Boolean)
    }

    if (details.logistics) {
      return [
        details.logistics.pickupAddress ? `Pickup: ${details.logistics.pickupAddress}` : "",
        details.logistics.dropoffAddress ? `Drop-off: ${details.logistics.dropoffAddress}` : "",
        details.logistics.receiverName ? `Receiver: ${details.logistics.receiverName}` : "",
        details.logistics.receiverPhone ? `Receiver Phone: ${details.logistics.receiverPhone}` : "",
      ].filter(Boolean)
    }

    if (details.creative) {
      return [
        details.creative.preferredPlatform ? `Platform: ${details.creative.preferredPlatform}` : "",
        details.creative.deliverableFormat ? `Deliverable: ${details.creative.deliverableFormat}` : "",
      ].filter(Boolean)
    }

    return [] as string[]
  }

  const BookingCard = ({ booking }: { booking: Booking }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 lg:p-6">
        {(() => {
          const requirementHighlights = getRequirementHighlights(booking)
          const requirementType = booking.requirementDetails?.event
            ? "Event Requirements"
            : booking.requirementDetails?.logistics
              ? "Delivery Requirements"
              : booking.requirementDetails?.creative
                ? "Creative Brief"
                : ""

          return (
            <>
        <div className="flex justify-between items-start mb-4 gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base lg:text-lg truncate">{booking.serviceName || booking.serviceTitle || "Service Booking"}</h3>
            <p className="text-xs lg:text-sm text-muted-foreground truncate">{booking.customerName || "Customer"}</p>
          </div>
          <Badge
            variant={
              booking.status === "confirmed"
                ? "default"
                : booking.status === "pending"
                ? "outline"
                : booking.status === "completed"
                ? "secondary"
                : "destructive"
            }
          >
            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs lg:text-sm truncate">{format(new Date(booking.bookingDate), "MMM dd, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs lg:text-sm truncate">{booking.startTime} - {booking.endTime}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs lg:text-sm truncate">{booking.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs lg:text-sm truncate">{booking.customerPhone || "Not provided"}</span>
          </div>
        </div>

        {booking.notes && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">Customer Notes:</p>
            <p className="text-sm text-muted-foreground">{booking.notes}</p>
          </div>
        )}

        {requirementHighlights.length > 0 && (
          <div className="mb-4 p-3 bg-accent/5 rounded-lg border border-accent/20">
            <p className="text-sm font-medium mb-1">{requirementType}</p>
            <div className="space-y-1">
              {requirementHighlights.slice(0, 4).map((line, idx) => (
                <p key={`requirement-line-${booking.id}-${idx}`} className="text-xs text-muted-foreground">{line}</p>
              ))}
            </div>
          </div>
        )}

        {booking.requiresQuote && (
          <div className="mb-4 p-3 bg-accent/5 rounded-lg border border-accent/20">
            <p className="text-sm font-medium mb-1">Quote Status</p>
            <Badge className={getPricingStatusColor(booking.pricingStatus)}>
              {(booking.pricingStatus || 'estimated').toUpperCase()}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              Est: ₦{Number(booking.estimatedPrice ?? booking.totalPrice ?? 0).toLocaleString('en-NG')}
              {booking.finalPrice != null ? ` • Final: ₦${Number(booking.finalPrice).toLocaleString('en-NG')}` : ''}
            </p>
            {booking.quoteExpiresAt && booking.pricingStatus === "quoted" && (
              <p className="text-xs text-amber-700 mt-1">
                Expires: {format(new Date(booking.quoteExpiresAt), "MMM d, yyyy HH:mm")}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <p className="font-semibold text-base lg:text-lg">₦{Number(booking.finalPrice ?? booking.totalPrice ?? booking.estimatedPrice ?? 0).toLocaleString('en-NG')}</p>
          <div className="flex gap-2 w-full sm:w-auto">
            {booking.status === "pending" && booking.requiresQuote && booking.pricingStatus !== "accepted" && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Final quote"
                  value={quoteValues[booking.id] ?? String(booking.finalPrice ?? "")}
                  onChange={(e) =>
                    setQuoteValues((prev) => ({
                      ...prev,
                      [booking.id]: e.target.value,
                    }))
                  }
                  className="h-9 w-full sm:w-32 rounded-md border border-input bg-background px-3 text-sm"
                />
                <input
                  type="number"
                  min="1"
                  max="168"
                  placeholder="SLA hrs"
                  value={quoteSlaHours[booking.id] ?? "24"}
                  onChange={(e) =>
                    setQuoteSlaHours((prev) => ({
                      ...prev,
                      [booking.id]: e.target.value,
                    }))
                  }
                  className="h-9 w-full sm:w-24 rounded-md border border-input bg-background px-3 text-sm"
                />
                <Button size="sm" variant="default" onClick={() => handleSendQuote(booking)}>
                  Send Quote
                </Button>
              </div>
            )}

            {booking.status === "pending" && (!booking.requiresQuote || booking.pricingStatus === "accepted") && (
              <>
                <Button size="sm" variant="default" onClick={() => handleApprove(booking.id)} className="gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleReject(booking.id)} className="gap-1">
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
            {booking.status === "confirmed" && (
              <Button size="sm" variant="outline" disabled className="gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Approved
              </Button>
            )}
            {booking.status === "cancelled" && (
              <Button size="sm" variant="outline" disabled className="gap-1">
                <XCircle className="h-4 w-4" />
                Rejected
              </Button>
            )}
          </div>
        </div>
            </>
          )
        })()}
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <VendorLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin">Loading...</div>
        </div>
      </VendorLayout>
    )
  }

  return (
    <VendorLayout>
      <div className="space-y-4 lg:space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Service Bookings</h1>
          <p className="text-sm lg:text-base text-muted-foreground mt-2">Manage bookings in calendar or list format, then export in your preferred file type.</p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex rounded-xl border bg-card p-1 w-full md:w-auto">
            <Button
              type="button"
              variant={viewMode === "calendar" ? "default" : "ghost"}
              className="flex-1 md:flex-none"
              onClick={() => setViewMode("calendar")}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Calendar View
            </Button>
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="flex-1 md:flex-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4 mr-2" />
              List View
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={exportScope} onValueChange={(value: "all" | "month" | "day") => setExportScope(value)}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Selected Day</SelectItem>
                <SelectItem value="month">Visible Month</SelectItem>
                <SelectItem value="all">All Bookings</SelectItem>
              </SelectContent>
            </Select>
            <Select value={exportFormat} onValueChange={(value: "csv" | "json" | "ics") => setExportFormat(value)}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="ics">ICS</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={exportBookings}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex flex-col lg:flex-row items-center lg:justify-between gap-2 text-center lg:text-left">
                <div className="flex-1">
                  <p className="text-xs lg:text-sm text-muted-foreground">Pending</p>
                  <p className="text-xl lg:text-2xl font-bold">{pendingBookings.length}</p>
                </div>
                <Clock3 className="h-6 w-6 lg:h-8 lg:w-8 text-yellow-500 opacity-50 shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex flex-col lg:flex-row items-center lg:justify-between gap-2 text-center lg:text-left">
                <div className="flex-1">
                  <p className="text-xs lg:text-sm text-muted-foreground">Confirmed</p>
                  <p className="text-xl lg:text-2xl font-bold">{confirmedBookings.length}</p>
                </div>
                <CheckCircle2 className="h-6 w-6 lg:h-8 lg:w-8 text-green-500 opacity-50 shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex flex-col lg:flex-row items-center lg:justify-between gap-2 text-center lg:text-left">
                <div className="flex-1">
                  <p className="text-xs lg:text-sm text-muted-foreground">Completed</p>
                  <p className="text-xl lg:text-2xl font-bold">{completedBookings.length}</p>
                </div>
                <CheckCircle2 className="h-6 w-6 lg:h-8 lg:w-8 text-blue-500 opacity-50 shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex flex-col lg:flex-row items-center lg:justify-between gap-2 text-center lg:text-left">
                <div className="flex-1">
                  <p className="text-xs lg:text-sm text-muted-foreground">Rejected</p>
                  <p className="text-xl lg:text-2xl font-bold">{cancelledBookings.length}</p>
                </div>
                <XCircle className="h-6 w-6 lg:h-8 lg:w-8 text-red-500 opacity-50 shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>

        {viewMode === "calendar" ? (
          <div className="space-y-4">
            <Card className="md:hidden border-0 shadow-none bg-transparent">
              <CardContent className="p-0">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {mobileDateStrip.map((day) => {
                    const key = format(day, "yyyy-MM-dd")
                    const dayBookings = bookingsByDate[key] || []
                    const selected = isSameDay(day, selectedDate)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSelectedDate(day)
                          setCurrentMonth(startOfMonth(day))
                        }}
                        className={`min-w-[74px] rounded-2xl border px-3 py-2 text-left transition ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}
                      >
                        <p className="text-[10px] uppercase tracking-wide opacity-80">{format(day, "EEE")}</p>
                        <p className="text-lg font-semibold leading-none mt-1">{format(day, "d")}</p>
                        <p className="text-[10px] mt-1">{dayBookings.length > 0 ? `${dayBookings.length} booked` : "Free"}</p>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="hidden md:block">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {monthGridDays.map((day) => {
                    const key = format(day, "yyyy-MM-dd")
                    const dayBookings = bookingsByDate[key] || []
                    const isCurrent = isSameMonth(day, currentMonth)
                    const isSelected = isSameDay(day, selectedDate)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDate(day)}
                        className={`min-h-[108px] rounded-xl border p-2 text-left transition ${isSelected ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40"} ${isCurrent ? "bg-card" : "bg-muted/30 text-muted-foreground"}`}
                      >
                        <p className="text-sm font-semibold">{format(day, "d")}</p>
                        <div className="mt-1 space-y-1">
                          {dayBookings.slice(0, 2).map((booking) => (
                            <p key={booking.id} className="text-[11px] truncate rounded bg-primary/10 px-1.5 py-0.5">
                              {booking.customerName || "Customer"}
                            </p>
                          ))}
                          {dayBookings.length > 2 && (
                            <p className="text-[11px] text-muted-foreground">+{dayBookings.length - 2} more</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{format(selectedDate, "EEEE, MMMM d, yyyy")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedDayBookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookings on this day.</p>
                ) : (
                  selectedDayBookings.map((booking) => (
                    <div key={booking.id} className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{booking.customerName || "Customer"}</p>
                          <p className="text-xs text-muted-foreground">{booking.serviceName || booking.serviceTitle || "Service"}</p>
                        </div>
                        <Badge variant={booking.status === "confirmed" ? "default" : booking.status === "completed" ? "secondary" : booking.status === "cancelled" ? "destructive" : "outline"}>
                          {booking.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{booking.startTime} - {booking.endTime}</span>
                        <span>{booking.location || "N/A"}</span>
                        <span>{booking.customerPhone || "No phone"}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
            <TabsTrigger value="pending" className="text-xs lg:text-sm py-2">Pending ({pendingBookings.length})</TabsTrigger>
            <TabsTrigger value="confirmed" className="text-xs lg:text-sm py-2">Confirmed ({confirmedBookings.length})</TabsTrigger>
            <TabsTrigger value="completed" className="text-xs lg:text-sm py-2">Completed ({completedBookings.length})</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs lg:text-sm py-2">Rejected ({cancelledBookings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingBookings.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Clock3 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No pending bookings</p>
                </CardContent>
              </Card>
            ) : (
              pendingBookings.map((booking) => <BookingCard key={booking.id} booking={booking} />)
            )}
          </TabsContent>

          <TabsContent value="confirmed" className="space-y-4">
            {confirmedBookings.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No confirmed bookings</p>
                </CardContent>
              </Card>
            ) : (
              confirmedBookings.map((booking) => <BookingCard key={booking.id} booking={booking} />)
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedBookings.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No completed bookings</p>
                </CardContent>
              </Card>
            ) : (
              completedBookings.map((booking) => <BookingCard key={booking.id} booking={booking} />)
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            {cancelledBookings.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No rejected bookings</p>
                </CardContent>
              </Card>
            ) : (
              cancelledBookings.map((booking) => <BookingCard key={booking.id} booking={booking} />)
            )}
          </TabsContent>
        </Tabs>
        )}
      </div>
    </VendorLayout>
  )
}
