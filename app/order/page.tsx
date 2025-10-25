"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { getOrders, getBookings, Booking } from "@/lib/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, ShoppingCart, Package, Truck, CheckCircle, XCircle, Calendar, Clock, DollarSign, MapPin } from "lucide-react"
import { format } from "date-fns"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProtectedRoute from "@/components/auth/ProtectedRoute"

export default function CustomerOrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        setLoading(true)
        try {
          const [ordersResult, bookingsResult] = await Promise.all([
            getOrders({ customerId: user.uid }),
            getBookings({ customerId: user.uid })
          ])
          setOrders(ordersResult || [])
          setBookings(bookingsResult || [])
        } catch (error) {
          console.error("Error fetching data:", error)
          setOrders([])
          setBookings([])
        } finally {
          setLoading(false)
        }
      }
    }
    fetchData()
  }, [user])

  const getBookingStatusBadge = (status: string) => {
    const variants: any = {
      pending: "outline",
      confirmed: "default",
      completed: "secondary",
      cancelled: "destructive",
      rescheduled: "outline",
    }
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="container mx-auto py-12 flex-1">
          <h1 className="text-3xl font-bold mb-2">My Orders & Bookings</h1>
          <p className="text-muted-foreground mb-8">Track your purchases and service appointments</p>

          <Tabs defaultValue="products" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="products">
                Product Orders ({orders.length})
              </TabsTrigger>
              <TabsTrigger value="services">
                Service Bookings ({bookings.length})
              </TabsTrigger>
            </TabsList>

            {/* Product Orders Tab */}
            <TabsContent value="products" className="mt-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
                  <p className="text-muted-foreground mb-4">You haven't placed any orders yet.</p>
                  <Button asChild>
                    <a href="/shop">Start Shopping</a>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {orders.map((order) => (
                    <Card key={order.id} className="hover-lift">
                      <CardHeader>
                        <CardTitle className="text-lg">Order #{order.id?.substring(0, 8)}</CardTitle>
                        <CardDescription>
                          {order.createdAt?.toDate?.().toLocaleDateString?.() || "Unknown date"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-col gap-2">
                          {order.products?.map((prod: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium truncate flex-1">{prod.title || prod.productId}</span>
                              <span className="text-muted-foreground whitespace-nowrap">x{prod.quantity}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="font-semibold">Total:</span>
                          <span className="text-lg font-bold text-accent">₦{order.totalAmount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              order.status === "delivered" ? "default" : 
                              order.status === "shipped" ? "secondary" : 
                              order.status === "cancelled" ? "destructive" : "outline"
                            }
                          >
                            {order.status}
                          </Badge>
                          {order.status === "delivered" && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {order.status === "shipped" && <Truck className="h-4 w-4 text-blue-500" />}
                          {order.status === "cancelled" && <XCircle className="h-4 w-4 text-red-500" />}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Service Bookings Tab */}
            <TabsContent value="services" className="mt-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-16">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No bookings yet</h3>
                  <p className="text-muted-foreground mb-4">You haven't booked any services yet.</p>
                  <Button asChild>
                    <a href="/services">Browse Services</a>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {bookings.map((booking) => (
                    <Card key={booking.id} className="hover-lift">
                      <CardHeader>
                        <CardTitle className="text-lg line-clamp-1">{booking.serviceTitle}</CardTitle>
                        <CardDescription>{booking.providerName}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{format(booking.bookingDate.toDate(), "MMM d, yyyy")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{booking.startTime} - {booking.endTime}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-accent">${booking.totalPrice}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="capitalize">{booking.locationType}</span>
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          {getBookingStatusBadge(booking.status)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        <Footer />
      </div>
    </ProtectedRoute>
  )
}
