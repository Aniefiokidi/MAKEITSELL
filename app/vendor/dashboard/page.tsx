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
  Banknote,
  Wrench,
  Calendar,
  Clock,
  Star,
  Plus,
  CreditCard
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { getSessionToken } from "@/lib/auth-client"
import Link from "next/link"
import VendorLayout from "@/components/vendor/VendorLayout"


export default function VendorDashboardPage() {
  const { user, userProfile, loading } = useAuth();
  const [dashboard, setDashboard] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    status: 'active' | 'suspended' | 'expired';
    expiryDate: Date | null;
    daysUntilExpiry: number;
    accountStatus: 'active' | 'suspended' | 'deleted';
  } | null>(null);

  // Handle subscription renewal
  const handleRenewSubscription = async () => {
    if (!user || !userProfile) return

    try {
      setDataLoading(true)
      const response = await fetch('/api/payments/vendor-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendorId: user.uid,
          email: user.email || userProfile.email
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to initialize payment')
      }

      const result = await response.json()

      if (result.success && result.authorization_url) {
        // Redirect to Paystack payment
        window.location.href = result.authorization_url
      } else {
        throw new Error('Payment initialization failed')
      }
    } catch (error) {
      console.error('Renewal error:', error)
      alert('Failed to process subscription renewal. Please try again.')
    } finally {
      setDataLoading(false)
    }
  }

  // Format currency with commas
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-NG')
  }

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user) return;
      setDataLoading(true);
      try {
        const res = await fetch(`/api/vendor/dashboard?vendorId=${encodeURIComponent(user.uid)}`);
        const data = await res.json();
        if (data.success) {
          setDashboard(data.data);
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setDataLoading(false);
      }
    };
    loadDashboard();
  }, [user]);

  // Show loading while authentication is being checked or userProfile is loading
  if (loading || (user && !userProfile)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {loading ? "Checking authentication..." : "Loading profile..."}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if user is a vendor - redirect if not
  if (!user || userProfile?.role !== "vendor") {
    if (typeof window !== 'undefined') {
      window.location.href = '/unauthorized'
    }
    return null
  }

  const totalRevenue = dashboard?.totalRevenue || 0;
  const totalOrders = dashboard?.totalOrders || 0;
  const totalProducts = dashboard?.totalProducts || 0;
  const revenueChange = dashboard?.revenueChange;
  const ordersChange = dashboard?.ordersChange;
  const productsChange = dashboard?.productsChange;
  const newProductsThisWeek = dashboard?.newProductsThisWeek;
  const conversionRate = dashboard?.conversionRate?.toFixed(1) || "0.0";
  const conversionRateChange = dashboard?.conversionRateChange;
  const lowStockProducts = dashboard?.lowStockProducts || [];
  const recentOrders = dashboard?.recentOrders || [];
  const serviceRevenue = dashboard?.serviceRevenue || 0;
  const totalServices = dashboard?.totalServices || 0;
  const totalBookings = dashboard?.totalBookings || 0;
  const pendingBookings = dashboard?.pendingBookings || 0;
  const activeServices = dashboard?.activeServices || 0;
  const recentBookings = dashboard?.recentBookings || [];

  const vendorType = userProfile?.vendorType || "both"

  return (
    <VendorLayout>
      <div className="animate-fade-in">
        <h1 className="text-lg font-bold" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>Dashboard</h1>
        <p className="text-xs text-muted-foreground">Welcome back! Here's what's happening with your store.</p>
      </div>

      {/* Subscription Status */}
      {subscriptionStatus && (
        <div className="mt-6 mb-6">
          <Card className={`border-l-4 ${
            subscriptionStatus.status === 'active' && subscriptionStatus.daysUntilExpiry > 7 
              ? 'border-l-green-500 bg-green-50' 
              : subscriptionStatus.status === 'active' && subscriptionStatus.daysUntilExpiry <= 7
                ? 'border-l-yellow-500 bg-yellow-50'
                : subscriptionStatus.status === 'expired' 
                  ? 'border-l-orange-500 bg-orange-50'
                  : 'border-l-red-500 bg-red-50'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className={`h-6 w-6 ${
                    subscriptionStatus.status === 'active' && subscriptionStatus.daysUntilExpiry > 7 
                      ? 'text-green-600' 
                      : subscriptionStatus.status === 'active' && subscriptionStatus.daysUntilExpiry <= 7
                        ? 'text-yellow-600'
                        : subscriptionStatus.status === 'expired' 
                          ? 'text-orange-600'
                          : 'text-red-600'
                  }`} />
                  <div>
                    <p className="font-semibold">
                      {subscriptionStatus.status === 'active' && subscriptionStatus.daysUntilExpiry > 7
                        ? 'Subscription Active'
                        : subscriptionStatus.status === 'active' && subscriptionStatus.daysUntilExpiry <= 7
                          ? 'Subscription Expiring Soon'
                          : subscriptionStatus.status === 'expired'
                            ? 'Subscription Expired'
                            : subscriptionStatus.accountStatus === 'suspended'
                              ? 'Account Suspended'
                              : 'Subscription Issue'
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {subscriptionStatus.daysUntilExpiry > 0 
                        ? `Expires in ${subscriptionStatus.daysUntilExpiry} day${subscriptionStatus.daysUntilExpiry === 1 ? '' : 's'}`
                        : subscriptionStatus.daysUntilExpiry === 0 
                          ? 'Expires today'
                          : `Expired ${Math.abs(subscriptionStatus.daysUntilExpiry)} day${Math.abs(subscriptionStatus.daysUntilExpiry) === 1 ? '' : 's'} ago`
                      }
                      {subscriptionStatus.expiryDate && (
                        <span className="ml-2">
                          ({new Date(subscriptionStatus.expiryDate).toLocaleDateString('en-NG')})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(subscriptionStatus.status !== 'active' || subscriptionStatus.daysUntilExpiry <= 7) && (
                    <Button size="sm" onClick={handleRenewSubscription} disabled={dataLoading} className="hover:bg-accent/80 hover:scale-105 transition-all hover:shadow-lg">
                      {dataLoading ? 'Processing...' : 'Renew Subscription'}
                    </Button>
                  )}
                  {subscriptionStatus.accountStatus === 'suspended' && (
                    <Badge variant="destructive">
                      Suspended
                    </Badge>
                  )}
                </div>
              </div>
              {(subscriptionStatus.daysUntilExpiry <= 7 && subscriptionStatus.daysUntilExpiry > 0) && (
                <div className="mt-2 p-2 bg-yellow-100 rounded text-sm text-yellow-800">
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  Your subscription expires soon. Renew now to avoid service interruption.
                </div>
              )}
              {subscriptionStatus.daysUntilExpiry < 0 && subscriptionStatus.accountStatus !== 'suspended' && (
                <div className="mt-2 p-2 bg-orange-100 rounded text-sm text-orange-800">
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  Your subscription is overdue. Account will be suspended after 10 days of non-payment.
                  {Math.abs(subscriptionStatus.daysUntilExpiry) >= 10 && (
                    <span className="block mt-1 font-semibold">
                      Account suspension: {20 - Math.abs(subscriptionStatus.daysUntilExpiry)} days remaining before permanent deletion
                    </span>
                  )}
                </div>
              )}
              {subscriptionStatus.accountStatus === 'suspended' && (
                <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-800">
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  Your account is suspended. Your store is hidden from customers. 
                  {Math.abs(subscriptionStatus.daysUntilExpiry) < 20 && (
                    <span className="block mt-1 font-semibold">
                      Permanent deletion in: {20 - Math.abs(subscriptionStatus.daysUntilExpiry)} days
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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
    conversion: string | number,
    lowStock: any[],
    recent: any[]
  ) {
    // Defensive fallback for undefined/null values
    const safeRevenueChange = typeof revenueChange === 'number' ? revenueChange : 0;
    const safeProductsChange = typeof productsChange === 'number' ? productsChange : 0;
    const safeOrdersChange = typeof ordersChange === 'number' ? ordersChange : 0;
    const safeConversionRateChange = typeof conversionRateChange === 'number' ? conversionRateChange : 0;
    const safeConversion = typeof conversion === 'string' ? conversion : (typeof conversion === 'number' ? conversion.toFixed(1) : '0.0');

    return (
      <>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">₦{formatCurrency(revenue)}</p>
                  <p className="text-xs text-gray-600">Product Revenue</p>
                  <p className="text-xs text-green-600">
                    {`${safeRevenueChange >= 0 ? "+" : ""}${safeRevenueChange.toFixed(1)}% from last month`}
                  </p>
                </div>
                <Banknote className="h-8 w-8 text-accent animate-pulse-glow" />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{productsCount}</p>
                  <p className="text-xs text-gray-600">Products Listed</p>
                  <p className="text-xs text-green-600">
                    {typeof newProductsThisWeek === "number" ? `+${newProductsThisWeek} new this week` : ""}
                    {` (${safeProductsChange >= 0 ? "+" : ""}${safeProductsChange.toFixed(1)}% vs last week)`}
                  </p>
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
                  <p className="text-xs text-green-600">
                    {`${safeOrdersChange >= 0 ? "+" : ""}${safeOrdersChange.toFixed(1)}% from last month`}
                  </p>
                </div>
                <ShoppingCart className="h-8 w-8 text-accent animate-pulse-glow" style={{ animationDelay: '0.4s' }} />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.4s' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{safeConversion}%</p>
                  <p className="text-xs text-gray-600">Conversion Rate</p>
                  <p className="text-xs text-green-600">
                    {`${safeConversionRateChange >= 0 ? "+" : ""}${safeConversionRateChange.toFixed(1)}% from last month`}
                  </p>
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
                    {recent.map((order, index) => (
                      <div key={order.id || order._id || index} className="flex justify-between items-center p-3 rounded-lg hover:bg-accent/5 transition-colors">
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
                    {lowStock.map((product, index) => (
                      <div key={product.id || product._id || index} className="flex justify-between items-center p-2 rounded hover:bg-accent/5">
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
                  <p className="text-xl font-bold">₦{formatCurrency(revenue)}</p>
                  <p className="text-xs text-gray-600">Service Revenue</p>
                  <p className="text-xs text-green-600">Completed bookings</p>
                </div>
                <Banknote className="h-8 w-8 text-accent animate-pulse-glow" />
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
                    {recent.map((booking, index) => (
                      <div key={booking.id || booking._id || index} className="flex justify-between items-center p-3 rounded-lg hover:bg-accent/5 transition-colors">
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
