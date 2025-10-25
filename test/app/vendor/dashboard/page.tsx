"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  DollarSign
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import Link from "next/link"
import VendorLayout from "@/components/vendor/VendorLayout"

export default function VendorDashboardPage() {
  const { user, userProfile } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!user) return

      try {
        const { getOrders, getVendorProducts } = await import("@/lib/firestore")

        // Load orders for this vendor
        const vendorOrders = await getOrders({ vendorId: user.uid })
        setOrders(vendorOrders)

        // Load products for this vendor
        const vendorProducts = await getVendorProducts(user.uid)
        setProducts(vendorProducts)
      } catch (error) {
        console.error("Error loading vendor data:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user])

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
  const totalOrders = orders.length
  const totalProducts = products.length
  const conversionRate = totalOrders > 0 ? ((totalOrders / (totalOrders + 50)) * 100).toFixed(1) : "0.0" // Mock conversion rate

  const lowStockProducts = products.filter(product => product.stock < 5)
  const recentOrders = orders.slice(0, 5)

  return (
    <VendorLayout>
      <div>
        <h1 className="text-lg font-bold">Dashboard</h1>
        <p className="text-xs text-muted-foreground">Welcome back! Here's what's happening with your store.</p>
      </div>

      {/* Dashboard Content */}
      <div className="mt-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold">₦{totalRevenue.toFixed(2)}</p>
                    <p className="text-xs text-gray-600">Total Revenue</p>
                    <p className="text-xs text-green-600">+12% from last month</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold">{totalProducts}</p>
                    <p className="text-xs text-gray-600">Products</p>
                    <p className="text-xs text-green-600">+2 new this week</p>
                  </div>
                  <Package className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold">{totalOrders}</p>
                    <p className="text-xs text-gray-600">Orders</p>
                    <p className="text-xs text-green-600">+8% from last month</p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold">{conversionRate}%</p>
                    <p className="text-xs text-gray-600">Conversion Rate</p>
                    <p className="text-xs text-green-600">+0.5% from last month</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Orders and Low Stock */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {recentOrders.length === 0 ? (
                  <p className="text-gray-600">No orders yet.</p>
                ) : (
                  <div className="space-y-4">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="flex justify-between items-center">
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
                )}
                <Button variant="outline" className="mt-4 w-full" asChild>
                  <Link href="/vendor/orders">View All Orders</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5 text-orange-500" />
                  Low Stock Alert
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lowStockProducts.length === 0 ? (
                  <p className="text-gray-600">No low stock products.</p>
                ) : (
                  <div className="space-y-2">
                    {lowStockProducts.map((product) => (
                      <div key={product.id} className="flex justify-between items-center">
                        <span className="text-sm">{product.title}</span>
                        <Badge variant="destructive">{product.stock} left</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" className="mt-4 w-full" asChild>
                  <Link href="/vendor/products">Manage Inventory</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
    </VendorLayout>
  )
}
