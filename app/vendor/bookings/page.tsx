"use client"

import { useEffect, useState } from "react"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// TODO: Replace with API call to fetch bookings from MongoDB
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { Calendar, Clock, DollarSign, MapPin, User, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { format } from "date-fns"

export default function VendorBookingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    if (user) {
      fetchBookings()
    }
  }, [user])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      // TODO: Replace with API call to fetch bookings
      // Example:
      // const response = await fetch("/api/bookings?providerId=" + user?.uid)
      // const data = await response.json()
      // setBookings(data)
      setBookings([]) // Stub: empty array
    } catch (error) {
      console.error("Error fetching bookings:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (bookingId: string, status: string) => {
    // TODO: Implement booking status update via API
    toast({
      title: "Booking Updated",
      description: `Booking has been ${status}`,
    })
    fetchBookings()
  }

  const getStatusBadge = (status: string) => {
    // TODO: Replace with real status badge logic
    return <Badge>{status}</Badge>
  }

  const filteredBookings = activeTab === "all" 
    ? bookings 
    : bookings.filter(b => b.status === activeTab)

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === "pending").length,
    confirmed: bookings.filter(b => b.status === "confirmed").length,
    completed: bookings.filter(b => b.status === "completed").length,
    revenue: bookings.filter(b => b.status === "completed").reduce((sum, b) => sum + b.totalPrice, 0),
  }

  return (
    <VendorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">Manage your service bookings</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Bookings</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Confirmed</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.confirmed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{stats.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Revenue</CardDescription>
              <CardTitle className="text-3xl text-accent">${stats.revenue.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Bookings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-muted rounded w-1/2" />
                      <div className="h-4 bg-muted rounded w-1/3 mt-2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : filteredBookings.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No bookings found</h3>
                  <p className="text-muted-foreground">
                    {activeTab === "all" ? "You don't have any bookings yet" : `No ${activeTab} bookings`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredBookings.map((booking) => (
                  <Card key={booking.id} className="hover-lift">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="text-xl">{booking.serviceTitle}</CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {booking.customerName}
                          </CardDescription>
                        </div>
                        {getStatusBadge(booking.status)}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Date</p>
                            <p className="font-medium">
                              {format(booking.bookingDate.toDate(), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Time</p>
                            <p className="font-medium">
                              {booking.startTime} - {booking.endTime}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Price</p>
                            <p className="font-medium text-accent">${booking.totalPrice}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">Location</p>
                            <p className="font-medium capitalize">{booking.locationType}</p>
                          </div>
                        </div>
                      </div>

                      {booking.notes && (
                        <div className="bg-muted p-3 rounded-lg">
                          <p className="text-sm font-semibold mb-1">Customer Notes:</p>
                          <p className="text-sm text-muted-foreground">{booking.notes}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Contact:</span>
                        <span>{booking.customerEmail}</span>
                        {booking.customerPhone && <span>• {booking.customerPhone}</span>}
                      </div>

                      {/* Action Buttons */}
                      {booking.status === "pending" && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            onClick={() => handleStatusUpdate(booking.id!, "confirmed")}
                            className="flex-1"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Confirm
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleStatusUpdate(booking.id!, "cancelled")}
                            className="flex-1 text-destructive"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Decline
                          </Button>
                        </div>
                      )}

                      {booking.status === "confirmed" && (
                        <Button
                          onClick={() => handleStatusUpdate(booking.id!, "completed")}
                          className="w-full"
                        >
                          Mark as Completed
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </VendorLayout>
  )
}
