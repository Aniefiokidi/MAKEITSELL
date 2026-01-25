"use client"

import { useEffect, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ReportsData {
  vendorCount: number
  monthlyVendorFee: number
  lifetimeVendorFee: number
  totalOrderRevenue: number
  totalVAT: number
  vatRate: number
  monthlyVendorFeeRate: number
}

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/reports', { credentials: 'include' })
        const json = await res.json()
        if (!json.success) {
          throw new Error(json.error || 'Failed to load reports')
        }
        setData(json.data)
      } catch (err: any) {
        setError(err.message || 'Failed to load reports')
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
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Vendor revenue, subscriptions, and VAT overview.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground">Loading reports...</div>
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Vendors</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.vendorCount.toLocaleString()}</p>
                <p className="text-muted-foreground text-sm">Active vendors in the system</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Vendor Fee</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">₦{data.monthlyVendorFee.toLocaleString()}</p>
                <p className="text-muted-foreground text-sm">Rate: ₦{data.monthlyVendorFeeRate.toLocaleString()} per vendor / month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lifetime Vendor Fee</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">₦{data.lifetimeVendorFee.toLocaleString()}</p>
                <p className="text-muted-foreground text-sm">Calculated from vendors' active months</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total Order Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">₦{data.totalOrderRevenue.toLocaleString()}</p>
                <p className="text-muted-foreground text-sm">All recorded orders</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total VAT</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">₦{data.totalVAT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-muted-foreground text-sm">VAT rate assumed: {(data.vatRate * 100).toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  )
}
