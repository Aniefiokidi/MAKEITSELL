"use client"

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'

export default function OverseerDashboardPage() {
  const { user } = useAuth()
  const { error: notifyError } = useNotification()
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    if ((user.email || '').toLowerCase() !== 'makeitsell@gmail.com') {
      if (typeof window !== 'undefined') window.location.href = '/unauthorized'
      return
    }
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/dashboard')
        const json = await res.json()
        if (json.success) setData(json.data)
        else notifyError(json.error || 'Failed to load admin metrics')
      } catch (e: any) {
        notifyError(e?.message || 'Failed to load admin metrics')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Please log in</CardTitle>
            <CardDescription>Sign in to access the overseer dashboard.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-accent/10 to-background">
      <Header />
      <div className="container mx-auto px-4 py-10">
        <h1 className="text-3xl font-black mb-6">Overseer Dashboard</h1>
        {loading ? (
          <div className="flex justify-center py-20"><span className="animate-spin h-8 w-8 border-t-2 border-b-2 border-accent rounded-full"></span></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Totals</CardTitle>
                <CardDescription>Platform-wide metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Revenue</div>
                    <div className="text-xl font-bold">₦{(data?.totals?.totalRevenue || 0).toLocaleString('en-NG')}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Orders</div>
                    <div className="text-xl font-bold">{data?.totals?.totalOrders || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Products</div>
                    <div className="text-xl font-bold">{data?.totals?.totalProducts || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Users</div>
                    <div className="text-xl font-bold">{data?.totals?.totalUsers || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Vendors</div>
                    <div className="text-xl font-bold">{data?.totals?.vendorsCount || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Customers</div>
                    <div className="text-xl font-bold">{data?.totals?.customersCount || 0}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top Vendors by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Vendor ID</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Sales (Qty)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.topVendors || []).map((v: any) => (
                      <TableRow key={v.vendorId}>
                        <TableCell>{v.storeName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{v.vendorId}</TableCell>
                        <TableCell>₦{(v.revenue || 0).toLocaleString('en-NG')}</TableCell>
                        <TableCell>{v.sales || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Customers by Spend</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer ID</TableHead>
                      <TableHead>Spend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.topCustomers || []).map((c: any) => (
                      <TableRow key={c.customerId}>
                        <TableCell className="text-xs text-muted-foreground">{c.customerId}</TableCell>
                        <TableCell>₦{(c.spend || 0).toLocaleString('en-NG')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top Products by Units Sold</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Product ID</TableHead>
                      <TableHead>Units</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.topProducts || []).map((p: any) => (
                      <TableRow key={p.productId}>
                        <TableCell>{p.title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.productId}</TableCell>
                        <TableCell>{p.qty || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Longest Tenure Vendors</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(data?.vendorsByTenure || []).map((s: any) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <span>{s.storeName || s.name || 'Store'}</span>
                      <Badge variant="outline" className="text-xs">Since {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'Unknown'}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscriptions Expiring Soon</CardTitle>
                <CardDescription>Within 14 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(data?.expiringSubscriptions || []).length === 0 ? (
                    <li className="text-muted-foreground">None detected</li>
                  ) : (
                    (data?.expiringSubscriptions || []).map((s: any) => (
                      <li key={s.vendorId} className="flex items-center justify-between">
                        <span>{s.storeName}</span>
                        <Badge variant="secondary">{new Date(s.subscriptionExpiresAt).toLocaleDateString()}</Badge>
                      </li>
                    ))
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
