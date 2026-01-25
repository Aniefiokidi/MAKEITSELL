"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Store, Package, DollarSign, TrendingUp, AlertTriangle, MessageSquare } from "lucide-react"
import AdminLayout from "@/components/admin/AdminLayout"

export default function AdminDashboard() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/dashboard')
        const json = await res.json()
        if (json.success) {
          setData(json.data)
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  if (authLoading || (loading && !data)) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-accent rounded-full"></div>
        </div>
      </AdminLayout>
    )
  }

  if (!user) {
    return null
  }

  const stats = {
    totalUsers: data?.totals?.totalUsers || 0,
    activeVendors: data?.totals?.vendorsCount || 0,
    totalProducts: data?.totals?.totalProducts || 0,
    totalRevenue: data?.totals?.totalRevenue || 0,
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-balance">Dashboard Overview</h1>
          <p className="text-muted-foreground text-sm lg:text-base">Monitor your marketplace performance and key metrics</p>
        </div>

        <div className="grid gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl lg:text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All platform users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Active Vendors</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl lg:text-2xl font-bold">{stats.activeVendors.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Store owners</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl lg:text-2xl font-bold">{stats.totalProducts.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Listed items</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl lg:text-2xl font-bold">₦{stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All-time total</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:gap-6 grid-cols-1 md:grid-cols-3">
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium text-orange-800">Top Vendors</CardTitle>
              <MessageSquare className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl lg:text-2xl font-bold text-orange-800">{(data?.topVendors || []).length}</div>
              <Button size="sm" variant="outline" className="mt-2 w-full lg:w-auto text-orange-700 border-orange-300 bg-transparent text-xs" onClick={() => router.push('/admin/vendors')}>
                View Vendors
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium text-red-800">Total Products</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl lg:text-2xl font-bold text-red-800">{stats.totalProducts}</div>
              <Button size="sm" variant="outline" className="mt-2 w-full lg:w-auto text-red-700 border-red-300 bg-transparent text-xs" onClick={() => router.push('/admin/products')}>
                View Products
              </Button>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium text-green-800">Total Orders</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl lg:text-2xl font-bold text-green-800">{data?.totals?.totalOrders || 0}</div>
              <p className="text-xs text-green-600 mt-1">Completed transactions</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm lg:text-base">Top Vendors by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(data?.topVendors || []).slice(0, 3).map((vendor: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{vendor.storeName}</p>
                      <p className="text-xs text-muted-foreground">{vendor.sales} sales</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm">₦{vendor.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm lg:text-base">Top Customers by Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(data?.topCustomers || []).slice(0, 3).map((customer: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-medium text-sm">Customer</p>
                      <p className="text-xs text-muted-foreground truncate">{customer.customerId}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm">₦{customer.spend.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

