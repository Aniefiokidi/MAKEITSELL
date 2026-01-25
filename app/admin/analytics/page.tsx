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
  topCustomers?: { customerId: string; spend: number; name?: string; email?: string }[]
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
          <h1 className="text-2xl lg:text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm lg:text-base">Marketplace performance at a glance.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading analytics...</div>
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
            <div className="grid gap-4 lg:gap-6 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs lg:text-sm font-medium">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl lg:text-3xl font-bold">{data.totals.totalUsers.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs lg:text-sm font-medium">Vendors</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl lg:text-3xl font-bold">{data.totals.vendorsCount.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs lg:text-sm font-medium">Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl lg:text-3xl font-bold">{data.totals.totalProducts.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs lg:text-sm font-medium">Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl lg:text-3xl font-bold">₦{data.totals.totalRevenue.toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm lg:text-base">Top Vendors by Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topVendors && data.topVendors.length > 0 ? (
                    <div className="space-y-4">
                      {/* Mobile view - List */}
                      <div className="lg:hidden space-y-3">
                        {data.topVendors.slice(0, 5).map((v, idx) => (
                          <div key={idx} className="flex justify-between items-start gap-2 p-2 bg-muted/50 rounded">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{v.storeName || 'N/A'}</p>
                              <p className="text-xs text-muted-foreground">{v.sales} sales</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-sm">₦{v.revenue.toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop view - Table */}
                      <div className="hidden lg:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Store</TableHead>
                              <TableHead className="text-right text-xs">Revenue</TableHead>
                              <TableHead className="text-right text-xs">Sales</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.topVendors.slice(0, 5).map((v, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs">{v.storeName || 'N/A'}</TableCell>
                                <TableCell className="text-right text-xs font-semibold">₦{v.revenue.toLocaleString()}</TableCell>
                                <TableCell className="text-right text-xs">{v.sales}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No vendor data yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm lg:text-base">Top Customers by Spend</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topCustomers && data.topCustomers.length > 0 ? (
                    <div className="space-y-4">
                      {/* Mobile view - List */}
                      <div className="lg:hidden space-y-3">
                        {data.topCustomers.slice(0, 5).map((c, idx) => (
                          <div key={idx} className="flex justify-between items-start gap-2 p-2 bg-muted/50 rounded">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{c.name || c.customerId}</p>
                              <p className="text-xs text-muted-foreground truncate">{c.email || c.customerId}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-sm">₦{c.spend.toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop view - Table */}
                      <div className="hidden lg:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Customer</TableHead>
                              <TableHead className="text-right text-xs">Spend</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.topCustomers.slice(0, 5).map((c, idx) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  <div className="flex flex-col text-xs">
                                    <span className="font-medium">{c.name || c.customerId}</span>
                                    <span className="text-muted-foreground">{c.email || c.customerId}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right text-xs font-semibold">₦{c.spend.toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
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
