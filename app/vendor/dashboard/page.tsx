"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Wrench,
  Calendar,
  Clock,
  Star,
  Plus
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import Link from "next/link"
import VendorLayout from "@/components/vendor/VendorLayout"

export default function VendorDashboardPage() {
  const { user, userProfile } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!user) return

      try {
        const { getOrders, getVendorProducts, getServices, getBookings } = await import("@/lib/firestore")

        const vendorType = userProfile?.vendorType || "both"

        // Load goods data if vendor sells goods
        if (vendorType === "goods" || vendorType === "both") {
          const vendorOrders = await getOrders({ vendorId: user.uid })
          setOrders(vendorOrders)

          const vendorProducts = await getVendorProducts(user.uid)
          setProducts(vendorProducts)
        }

        // Load services data if vendor offers services
        if (vendorType === "services" || vendorType === "both") {
          const vendorServices = await getServices({ providerId: user.uid })
          setServices(vendorServices)

          const vendorBookings = await getBookings({ providerId: user.uid })
          setBookings(vendorBookings)
        }
      } catch (error) {
        console.error("Error loading vendor data:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user, userProfile?.vendorType])

  // Check if user is a vendor
  if (!user || userProfile?.role !== "vendor") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You need to be a vendor to access this page.
            </p>
            <Button asChild>
              <a href="/become-seller">Become a Seller</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0)
  const serviceRevenue = bookings
    .filter(b => b.status === "completed")
    .reduce((sum, booking) => sum + booking.totalPrice, 0)
  const totalOrders = orders.length
  const totalProducts = products.length
  const totalServices = services.length
  const totalBookings = bookings.length
  const pendingBookings = bookings.filter(b => b.status === "pending").length
  const conversionRate = totalOrders > 0 ? ((totalOrders / (totalOrders + 50)) * 100).toFixed(1) : "0.0"

  const lowStockProducts = products.filter(product => product.stock < 5)
  const recentOrders = orders.slice(0, 5)
  const recentBookings = bookings.slice(0, 5)
  const activeServices = services.filter(s => s.status === "active").length

  const vendorType = userProfile?.vendorType || "both"

  return (
    <VendorLayout>
      <div className="animate-fade-in">
        <h1 className="text-lg font-bold" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>Dashboard</h1>
        <p className="text-xs text-muted-foreground">Welcome back! Here's what's happening with your store.</p>
      </div>

      {/* Dashboard Content */}
      <div className="mt-8">
        {vendorType === "both" ? (
          /* BOTH: Tabbed Dashboard */
          <Tabs defaultValue="goods" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="goods" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                My Goods
              </TabsTrigger>
              <TabsTrigger value="services" className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                My Services
              </TabsTrigger>
            </TabsList>

            {/* GOODS TAB */}
            <TabsContent value="goods" className="space-y-6">
              {renderGoodsDashboard(totalRevenue, totalProducts, totalOrders, conversionRate, lowStockProducts, recentOrders)}
            </TabsContent>

            {/* SERVICES TAB */}
            <TabsContent value="services" className="space-y-6">
              {renderServicesDashboard(serviceRevenue, totalServices, totalBookings, pendingBookings, activeServices, recentBookings)}
            </TabsContent>
          </Tabs>
        ) : vendorType === "goods" ? (
          /* GOODS ONLY: Direct Dashboard */
          renderGoodsDashboard(totalRevenue, totalProducts, totalOrders, conversionRate, lowStockProducts, recentOrders)
        ) : (
          /* SERVICES ONLY: Direct Dashboard */
          renderServicesDashboard(serviceRevenue, totalServices, totalBookings, pendingBookings, activeServices, recentBookings)
        )}
      </div>
    </VendorLayout>
  )

  // Goods Dashboard Renderer
  function renderGoodsDashboard(
    revenue: number,
    productsCount: number,
    ordersCount: number,
    conversion: string,
    lowStock: any[],
    recent: any[]
  ) {
    return (
      <>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">₦{revenue.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">Product Revenue</p>
                  <p className="text-xs text-green-600">+12% from last month</p>
                </div>
                <DollarSign className="h-8 w-8 text-accent animate-pulse-glow" />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{productsCount}</p>
                  <p className="text-xs text-gray-600">Products Listed</p>
                  <p className="text-xs text-green-600">+2 new this week</p>
                </div>
                <Package className="h-8 w-8 text-accent animate-pulse-glow" style={{ animationDelay: '0.2s' }} />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.3s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{ordersCount}</p>
                  <p className="text-xs text-gray-600">Total Orders</p>
                  <p className="text-xs text-green-600">+8% from last month</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-accent animate-pulse-glow" style={{ animationDelay: '0.4s' }} />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.4s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{conversion}%</p>
                  <p className="text-xs text-gray-600">Conversion Rate</p>
                  <p className="text-xs text-green-600">+0.5% from last month</p>
                </div>
                <TrendingUp className="h-8 w-8 text-accent animate-pulse-glow" style={{ animationDelay: '0.6s' }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders and Low Stock */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest product orders from customers</CardDescription>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-gray-600 mb-4">No orders yet</p>
                  <Button asChild variant="outline">
                    <Link href="/vendor/products/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Product
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {recent.map((order) => (
                      <div key={order.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-accent/5 transition-colors">
                        <div>
                          <p className="font-medium">Order #{order.id.slice(-8)}</p>
                          <p className="text-sm text-gray-600">
                            {order.createdAt?.toDate?.()?.toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline">{order.status}</Badge>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="mt-4 w-full" asChild>
                    <Link href="/vendor/orders">View All Orders</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-orange-500" />
                Low Stock Alert
              </CardTitle>
              <CardDescription>Products running low on inventory</CardDescription>
            </CardHeader>
            <CardContent>
              {lowStock.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-600">All products well stocked!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {lowStock.map((product) => (
                      <div key={product.id} className="flex justify-between items-center p-2 rounded hover:bg-accent/5">
                        <span className="text-sm">{product.title}</span>
                        <Badge variant="destructive">{product.stock} left</Badge>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="mt-4 w-full" asChild>
                    <Link href="/vendor/products">Manage Inventory</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  // Services Dashboard Renderer
  function renderServicesDashboard(
    revenue: number,
    servicesCount: number,
    bookingsCount: number,
    pending: number,
    active: number,
    recent: any[]
  ) {
    return (
      <>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">₦{revenue.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">Service Revenue</p>
                  <p className="text-xs text-green-600">Completed bookings</p>
                </div>
                <DollarSign className="h-8 w-8 text-accent animate-pulse-glow" />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{servicesCount}</p>
                  <p className="text-xs text-gray-600">Services Offered</p>
                  <p className="text-xs text-blue-600">{active} active</p>
                </div>
                <Wrench className="h-8 w-8 text-accent animate-pulse-glow" style={{ animationDelay: '0.2s' }} />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.3s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{bookingsCount}</p>
                  <p className="text-xs text-gray-600">Total Bookings</p>
                  <p className="text-xs text-amber-600">{pending} pending</p>
                </div>
                <Calendar className="h-8 w-8 text-accent animate-pulse-glow" style={{ animationDelay: '0.4s' }} />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.4s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">4.8</p>
                  <p className="text-xs text-gray-600">Average Rating</p>
                  <div className="flex items-center mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-accent animate-pulse-glow" style={{ animationDelay: '0.6s' }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Bookings and Service Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>Latest service appointments</CardDescription>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-gray-600 mb-4">No bookings yet</p>
                  <Button asChild variant="outline">
                    <Link href="/vendor/services/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Service
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {recent.map((booking) => (
                      <div key={booking.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-accent/5 transition-colors">
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">{booking.customerName}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(booking.bookingDate).toLocaleDateString()} at {booking.startTime}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant={
                            booking.status === "confirmed" ? "default" : 
                            booking.status === "pending" ? "secondary" : 
                            booking.status === "completed" ? "outline" : 
                            "destructive"
                          }
                        >
                          {booking.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="mt-4 w-full" asChild>
                    <Link href="/vendor/bookings">View All Bookings</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Performance</CardTitle>
              <CardDescription>Your service metrics overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-green-50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                      <Wrench className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">Active Services</p>
                      <p className="text-sm text-gray-600">Currently available</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{active}</p>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-amber-50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">Pending Approvals</p>
                      <p className="text-sm text-gray-600">Awaiting confirmation</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">{pending}</p>
                </div>

                <Button variant="outline" className="w-full" asChild>
                  <Link href="/vendor/services">Manage Services</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }
}
