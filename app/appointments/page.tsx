"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar as BookingCalendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { Calendar as CalendarIcon, Clock, MapPin, User, MessageSquare, CheckCircle, AlertCircle, XCircle } from "lucide-react"
import { format } from "date-fns"
import { buildPublicServicePath } from "@/lib/public-links"

interface Appointment {
  id: string
  serviceId: string
  providerId?: string
  serviceTitle: string
  providerName: string
  bookingDate: Date
  startTime: string
  endTime: string
  duration: number
  totalPrice: number
  estimatedPrice?: number
  finalPrice?: number | null
  pricingStatus?: "estimated" | "quoted" | "accepted"
  quoteExpiresAt?: Date | string
  requiresQuote?: boolean
  cancellationFeeApplied?: boolean
  cancellationFeeAmount?: number
  cancellationFeeStatus?: "none" | "charged" | "pending" | "waived"
  rescheduleCount?: number
  selectedPackageName?: string
  status: "pending" | "confirmed" | "completed" | "cancelled"
  location: string
  locationType: "online" | "in-person" | "both" | "store" | "home-service"
  notes?: string
  customerPhone?: string
}

export default function AppointmentsPage() {
  const { user, userProfile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed" | "cancelled">("upcoming")
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false)
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined)
  const [rescheduleTime, setRescheduleTime] = useState("")
  const [rescheduleBlockedSlots, setRescheduleBlockedSlots] = useState<Array<{ startTime: string; endTime: string; source: string }>>([])
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false)
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }
    fetchAppointments()
  }, [user, router])

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/database/bookings?customerId=${user?.uid}`)
      const data = await response.json()
      if (data.success) {
        setAppointments(data.data)
      }
    } catch (error) {
      console.error("Error fetching appointments:", error)
    } finally {
      setLoading(false)
    }
  }

  const resolveServicePath = async (appointment: Appointment): Promise<string | null> => {
    try {
      const response = await fetch(`/api/database/services/${encodeURIComponent(appointment.serviceId)}`, {
        cache: "no-store",
      })
      const payload = await response.json()
      if (response.ok && payload?.success && payload?.data) {
        return buildPublicServicePath(payload.data)
      }
    } catch (error) {
      console.error("Failed to resolve service slug path:", error)
    }

    toast({
      title: "Unable to open service",
      description: "Could not resolve the public service link. Please try again.",
      variant: "destructive",
    })
    return null
  }

  const filteredAppointments = appointments.filter((apt) => {
    if (filter === "all") return true
    if (filter === "upcoming") {
      return apt.status === "pending" || apt.status === "confirmed"
    }
    return apt.status === filter
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "pending":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case "completed":
        return <CheckCircle className="h-5 w-5 text-blue-500" />
      case "cancelled":
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "completed":
        return "bg-blue-100 text-blue-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleAcceptQuote = async (appointmentId: string) => {
    try {
      const response = await fetch(`/api/database/bookings/${appointmentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pricingStatus: "accepted",
          status: "confirmed",
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        throw new Error(errorBody?.error || "Failed to accept quote")
      }

      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appointmentId
            ? { ...item, pricingStatus: "accepted", status: "confirmed" }
            : item
        )
      )
      toast({ title: "Quote accepted", description: "Your booking has been confirmed." })
    } catch (error) {
      console.error("Error accepting quote:", error)
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to accept quote.", variant: "destructive" })
    }
  }

  const handleRejectQuote = async (appointmentId: string) => {
    try {
      const response = await fetch(`/api/database/bookings/${appointmentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "cancelled",
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        throw new Error(errorBody?.error || "Failed to reject quote")
      }

      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appointmentId
            ? { ...item, status: "cancelled" }
            : item
        )
      )
      toast({ title: "Quote rejected", description: "This booking has been cancelled." })
    } catch (error) {
      console.error("Error rejecting quote:", error)
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to reject quote.", variant: "destructive" })
    }
  }

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const response = await fetch(`/api/database/bookings/${appointmentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ actionType: "cancel", reason: "Cancelled by customer" }),
      })

      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(body?.error || "Failed to cancel appointment")
      }

      const updated = body?.data
      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appointmentId
            ? {
                ...item,
                status: "cancelled",
                cancellationFeeApplied: Boolean(updated?.cancellationFeeApplied),
                cancellationFeeAmount: Number(updated?.cancellationFeeAmount || 0),
                cancellationFeeStatus: updated?.cancellationFeeStatus || item.cancellationFeeStatus,
              }
            : item
        )
      )

      const feeAmount = Number(updated?.cancellationFeeAmount || 0)
      const feeMessage = feeAmount > 0
        ? ` Cancellation fee: N${feeAmount.toLocaleString("en-NG")}.`
        : ""
      toast({ title: "Appointment cancelled", description: `The booking was cancelled.${feeMessage}` })
    } catch (error) {
      console.error("Error cancelling appointment:", error)
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to cancel appointment.", variant: "destructive" })
    }
  }

  const fetchRescheduleAvailability = async (appointment: Appointment, date: Date) => {
    if (!appointment.providerId) {
      setRescheduleBlockedSlots([])
      return
    }

    try {
      setLoadingRescheduleSlots(true)
      const query = new URLSearchParams({
        providerId: appointment.providerId,
        serviceId: appointment.serviceId,
        date: format(date, "yyyy-MM-dd"),
        excludeBookingId: appointment.id,
      })
      const response = await fetch(`/api/database/bookings/availability?${query.toString()}`)
      const payload = await response.json()
      if (payload?.success && Array.isArray(payload.data)) {
        setRescheduleBlockedSlots(payload.data)
      } else {
        setRescheduleBlockedSlots([])
      }
    } catch {
      setRescheduleBlockedSlots([])
    } finally {
      setLoadingRescheduleSlots(false)
    }
  }

  const openRescheduleModal = (appointment: Appointment) => {
    const currentDate = new Date(appointment.bookingDate)
    setRescheduleTarget(appointment)
    setRescheduleDate(currentDate)
    setRescheduleTime(appointment.startTime)
    setIsRescheduleOpen(true)
    void fetchRescheduleAvailability(appointment, currentDate)
  }

  const blockedTimeSet = useMemo(() => {
    const blocked = new Set<string>()
    for (const window of rescheduleBlockedSlots) {
      const [startH, startM] = String(window.startTime || "00:00").split(":").map(Number)
      const [endH, endM] = String(window.endTime || "00:00").split(":").map(Number)
      let cursor = (startH * 60) + startM
      const end = (endH * 60) + endM
      while (cursor < end) {
        const h = Math.floor(cursor / 60)
        const m = cursor % 60
        blocked.add(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
        cursor += 30
      }
    }
    return blocked
  }, [rescheduleBlockedSlots])

  const rescheduleTimeOptions = useMemo(() => {
    const slots: string[] = []
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 30]) {
        const slot = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
        if (!blockedTimeSet.has(slot)) {
          slots.push(slot)
        }
      }
    }
    return slots
  }, [blockedTimeSet])

  const handleRescheduleSubmit = async () => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) {
      toast({ title: "Incomplete details", description: "Select a date and time to reschedule.", variant: "destructive" })
      return
    }

    const duration = Number(rescheduleTarget.duration || 60)
    const [hour, minute] = rescheduleTime.split(":").map(Number)
    const endMinutes = minute + duration
    const endHour = hour + Math.floor(endMinutes / 60)
    const endMinute = endMinutes % 60
    const newEndTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`

    try {
      setRescheduleSubmitting(true)
      const response = await fetch(`/api/database/bookings/${rescheduleTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "reschedule",
          newBookingDate: format(rescheduleDate, "yyyy-MM-dd"),
          newStartTime: rescheduleTime,
          newEndTime,
        }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        throw new Error(errorBody?.error || "Failed to reschedule")
      }

      const payload = await response.json()
      setAppointments((prev) =>
        prev.map((item) =>
          item.id === rescheduleTarget.id
            ? {
                ...item,
                bookingDate: payload?.data?.bookingDate || item.bookingDate,
                startTime: payload?.data?.startTime || item.startTime,
                endTime: payload?.data?.endTime || item.endTime,
                status: payload?.data?.status || "pending",
                rescheduleCount: Number(payload?.data?.rescheduleCount || item.rescheduleCount || 0),
              }
            : item
        )
      )
      setIsRescheduleOpen(false)
      setRescheduleTarget(null)
      setRescheduleBlockedSlots([])
      toast({ title: "Appointment rescheduled", description: "Your appointment has been moved and awaits provider confirmation." })
    } catch (error) {
      console.error("Error rescheduling appointment:", error)
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to reschedule appointment.", variant: "destructive" })
    } finally {
      setRescheduleSubmitting(false)
    }
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

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-b from-background via-background to-accent/5">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8 p-6 md:p-8 bg-linear-to-br from-accent/5 via-accent/15 to-accent/50 backdrop-blur-2xl rounded-3xl border border-accent/30 shadow-2xl shadow-accent/20 hover:shadow-3xl hover:shadow-accent/30 transition-all duration-500">
          <div className="text-center md:text-left">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-2 text-accent dark:text-white/70" style={{ 
              fontFamily: '"Bebas Neue", "Impact", sans-serif',
              textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))'
            }}>
              YOUR APPOINTMENTS
            </h1>
            <p className="text-accent dark:text-white/70 text-sm sm:text-base md:text-lg">
              Manage and track all your service appointments in one place
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-3 mb-8 ">
          {(["all", "upcoming", "completed", "cancelled"] as const).map((tab) => (
            <Button
              key={tab}
              variant={filter === tab ? "default" : "outline"}
              onClick={() => setFilter(tab)}
              className={`capitalize transition-all ${
                filter === tab 
                  ? "bg-accent text-white/90 hover:bg-white/90 hover:text-accent border-accent/30" 
                  : "border-accent/30"
              }`}
            >
              {tab === "upcoming" ? "Upcoming & Confirmed" : tab}
            </Button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-40 bg-muted" />
              </Card>
            ))}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CalendarIcon className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-2xl font-bold mb-2">No Appointments Yet</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                {filter === "upcoming" 
                  ? "You don't have any upcoming appointments. Browse services and book one today!"
                  : `You don't have any ${filter} appointments.`}
              </p>
              <Button onClick={() => router.push("/services")} size="lg" className="bg-accent text-white/90 hover:bg-white/90 hover:text-accent border-accent/30 transition-all">
                Browse Services
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {filteredAppointments.map((appointment) => (
              <Card
                key={appointment.id}
                className="overflow-hidden hover:shadow-lg transition-shadow border-l-4"
                style={{
                  borderLeftColor:
                    appointment.status === "confirmed"
                      ? "#22c55e"
                      : appointment.status === "pending"
                        ? "#eab308"
                        : appointment.status === "completed"
                          ? "#3b82f6"
                          : "#ef4444",
                }}
              >
                <CardHeader className="pb-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-3">
                        <h3 className="text-2xl font-bold text-accent">{appointment.serviceTitle}</h3>
                        <Badge className={getStatusColor(appointment.status)}>
                          <span className="inline-flex items-center gap-1">
                            {getStatusIcon(appointment.status)}
                            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                          </span>
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mb-2">
                        With <span className="font-semibold text-foreground">{appointment.providerName}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-accent">
                        ₦{Number(appointment.finalPrice ?? appointment.totalPrice ?? appointment.estimatedPrice ?? 0).toLocaleString('en-NG')}
                      </div>
                      <p className="text-sm text-muted-foreground">{appointment.duration} mins</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Appointment Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Date & Time */}
                    <div className="flex items-start gap-3 p-4 bg-accent/5 rounded-lg">
                      <CalendarIcon className="h-5 w-5 text-accent mt-1 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Date</p>
                        <p className="text-lg font-bold">
                          {format(new Date(appointment.bookingDate), "MMM dd, yyyy")}
                        </p>
                      </div>
                    </div>

                    {/* Time Slot */}
                    <div className="flex items-start gap-3 p-4 bg-accent/5 rounded-lg">
                      <Clock className="h-5 w-5 text-accent mt-1 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Time</p>
                        <p className="text-lg font-bold">
                          {appointment.startTime} - {appointment.endTime}
                        </p>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-start gap-3 p-4 bg-accent/5 rounded-lg">
                      <MapPin className="h-5 w-5 text-accent mt-1 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Location</p>
                        <p className="text-lg font-bold capitalize">{appointment.locationType}</p>
                        {appointment.location && (
                          <p className="text-sm text-muted-foreground">{appointment.location}</p>
                        )}
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="flex items-start gap-3 p-4 bg-accent/5 rounded-lg">
                      <User className="h-5 w-5 text-accent mt-1 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Contact</p>
                        {appointment.customerPhone && (
                          <p className="text-lg font-bold">{appointment.customerPhone}</p>
                        )}
                        <p className="text-sm text-muted-foreground truncate">
                          {userProfile?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {appointment.notes && (
                    <div className="p-4 bg-card border border-border rounded-lg">
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Notes</p>
                      <p className="text-foreground">{appointment.notes}</p>
                    </div>
                  )}

                  {appointment.requiresQuote && (
                    <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Quote</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-foreground">Status:</p>
                        <Badge className={getPricingStatusColor(appointment.pricingStatus)}>
                          {(appointment.pricingStatus || 'estimated').toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Estimated: ₦{Number(appointment.estimatedPrice ?? appointment.totalPrice ?? 0).toLocaleString('en-NG')}
                        {appointment.finalPrice != null ? ` • Final: ₦${Number(appointment.finalPrice).toLocaleString('en-NG')}` : ''}
                      </p>
                      {appointment.quoteExpiresAt && appointment.pricingStatus === "quoted" && (
                        <p className="text-xs text-amber-700 mt-1">
                          Quote expires: {format(new Date(appointment.quoteExpiresAt), "MMM d, yyyy HH:mm")}
                        </p>
                      )}
                    </div>
                  )}

                  {appointment.status === "cancelled" && appointment.cancellationFeeApplied && Number(appointment.cancellationFeeAmount || 0) > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-1">Cancellation Fee</p>
                      <p className="text-sm text-amber-900">
                        N{Number(appointment.cancellationFeeAmount || 0).toLocaleString('en-NG')} ({appointment.cancellationFeeStatus || 'pending'})
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={async () => {
                        const resolvedPath = await resolveServicePath(appointment)
                        if (resolvedPath) {
                          router.push(resolvedPath)
                        }
                      }}
                    >
                      <MapPin className="h-4 w-4" />
                      View Service
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        /* TODO: Open messaging modal */
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Message Provider
                    </Button>
                    {appointment.status === "confirmed" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openRescheduleModal(appointment)}>
                          Reschedule
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleCancelAppointment(appointment.id)}>
                          Cancel Appointment
                        </Button>
                      </>
                    )}
                    {appointment.status === "pending" && appointment.requiresQuote && appointment.pricingStatus === "quoted" && (
                      <>
                        <Button size="sm" onClick={() => handleAcceptQuote(appointment.id)}>
                          Accept Quote
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRejectQuote(appointment.id)}>
                          Reject Quote
                        </Button>
                      </>
                    )}
                    {(appointment.status === "completed" || appointment.status === "cancelled") && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          const addOns = (appointment as any).selectedAddOns || []
                          const addOnIds = Array.isArray(addOns) ? addOns.map((item: any) => item.id).filter(Boolean) : []
                          const query = new URLSearchParams()
                          if ((appointment as any).selectedPackageId) query.set("package", String((appointment as any).selectedPackageId))
                          if (addOnIds.length > 0) query.set("addons", addOnIds.join(","))
                          const basePath = await resolveServicePath(appointment)
                          if (basePath) {
                            router.push(`${basePath}?${query.toString()}`)
                          }
                        }}
                      >
                        Rebook
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              Choose a new date and available slot. Conflicting slots are automatically blocked.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Select Date</p>
              <BookingCalendar
                mode="single"
                selected={rescheduleDate}
                onSelect={(date) => {
                  setRescheduleDate(date)
                  setRescheduleTime("")
                  if (rescheduleTarget && date) {
                    void fetchRescheduleAvailability(rescheduleTarget, date)
                  }
                }}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Select Time</p>
              <Select value={rescheduleTime} onValueChange={setRescheduleTime}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingRescheduleSlots ? "Loading available slots..." : "Choose available slot"} />
                </SelectTrigger>
                <SelectContent>
                  {rescheduleTimeOptions.map((slot) => (
                    <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Conflict Preview</p>
              {loadingRescheduleSlots ? (
                <p className="text-xs text-muted-foreground">Loading conflicts...</p>
              ) : rescheduleBlockedSlots.length === 0 ? (
                <p className="text-xs text-muted-foreground">No conflicts found for selected date.</p>
              ) : (
                <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
                  {rescheduleBlockedSlots.map((slot, index) => (
                    <div key={`${slot.startTime}-${slot.endTime}-${index}`} className="text-xs flex items-center justify-between">
                      <span>{slot.startTime} - {slot.endTime}</span>
                      <Badge variant="outline" className="text-[10px]">{slot.source === "external_calendar" ? "Calendar" : "Booking"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRescheduleOpen(false)} disabled={rescheduleSubmitting}>Cancel</Button>
            <Button onClick={handleRescheduleSubmit} disabled={!rescheduleDate || !rescheduleTime || rescheduleSubmitting}>
              {rescheduleSubmitting ? "Rescheduling..." : "Confirm Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  )
}
