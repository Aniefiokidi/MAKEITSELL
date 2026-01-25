"use client"

import { useEffect, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface DashboardData {
  totals: {
    totalUsers: number
    vendorsCount: number
    totalProducts: number
    totalRevenue: number
    totalOrders?: number
  }
  topVendors?: { storeName: string; revenue: number; sales: number }[]
  topCustomers?: { customerId: string; spend: number }[]
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/dashboard', { credentials: 'include' })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Failed to load analytics')
        setData(json.data)
      } catch (err: any) {
        setError(err.message || 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Marketplace performance at a glance.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground">Loading analytics...</div>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : data ? (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data.totals.totalUsers.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Vendors</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data.totals.vendorsCount.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data.totals.totalProducts.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">₦{data.totals.totalRevenue.toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top Vendors by Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topVendors && data.topVendors.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Store</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topVendors.slice(0, 5).map((v, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{v.storeName || 'N/A'}</TableCell>
                            <TableCell className="text-right">₦{v.revenue.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{v.sales}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-sm">No vendor data yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Customers by Spend</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topCustomers && data.topCustomers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer ID</TableHead>
                          <TableHead className="text-right">Spend</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topCustomers.slice(0, 5).map((c, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{c.customerId}</TableCell>
                            <TableCell className="text-right">₦{c.spend.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-sm">No customer data yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
