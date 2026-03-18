"use client"

import { useEffect, useState } from "react"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { Calendar, Clock, MapPin, Phone, CheckCircle2, XCircle, Clock3 } from "lucide-react"
import { format } from "date-fns"

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
}

export default function VendorBookingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("pending")
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

  const BookingCard = ({ booking }: { booking: Booking }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 lg:p-6">
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
          <p className="text-sm lg:text-base text-muted-foreground mt-2">Manage and approve customer service appointments</p>
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
      </div>
    </VendorLayout>
  )
}
