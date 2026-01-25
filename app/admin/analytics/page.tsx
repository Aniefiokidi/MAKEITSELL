"use client"

import { useEffect, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts"

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

interface AnalyticsData {
  categories: Array<{ name: string; count: number; revenue: number }>
  serviceTypes: Array<{ type: string; count: number; revenue: number }>
  orderStatusStats: Record<string, number>
  paymentStatusStats: Record<string, number>
  totalServices: number
  totalServiceRevenue: number
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#6366f1']

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, analyticsRes] = await Promise.all([
          fetch('/api/admin/dashboard', { credentials: 'include' }),
          fetch('/api/admin/analytics', { credentials: 'include' }),
        ])
        
        const dashJson = await dashRes.json()
        if (!dashJson.success) throw new Error(dashJson.error || 'Failed to load dashboard')
        setData(dashJson.data)

        const analyticsJson = await analyticsRes.json()
        if (analyticsJson.success) {
          setAnalytics(analyticsJson)
        }
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

            {/* Charts Section */}
            <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-2">
              {/* Categories by Revenue */}
              {analytics?.categories && analytics.categories.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm lg:text-base">Top Categories by Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.categories.slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => `₦${Number(value).toLocaleString()}`} />
                        <Bar dataKey="revenue" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Order Status Distribution */}
              {analytics?.orderStatusStats && Object.keys(analytics.orderStatusStats).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm lg:text-base">Order Status Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={Object.entries(analytics.orderStatusStats).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.entries(analytics.orderStatusStats).map((_, idx) => (
                            <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Category Product Count */}
              {analytics?.categories && analytics.categories.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm lg:text-base">Products per Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.categories.slice(0, 8)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#06b6d4" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Payment Status Distribution */}
              {analytics?.paymentStatusStats && Object.keys(analytics.paymentStatusStats).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm lg:text-base">Payment Status Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={Object.entries(analytics.paymentStatusStats).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.entries(analytics.paymentStatusStats).map((_, idx) => (
                            <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
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
