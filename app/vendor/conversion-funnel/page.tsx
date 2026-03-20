"use client"

import { useEffect, useMemo, useState } from "react"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import Link from "next/link"

type FunnelStage = {
  key: string
  label: string
  value: number
}

type FunnelRates = {
  visitToView: number
  viewToCart: number
  cartToCheckout: number
  checkoutToOrder: number
  visitToOrder: number
}

export default function VendorConversionFunnelPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [funnelDays, setFunnelDays] = useState("30")
  const [funnel, setFunnel] = useState<{ stages: FunnelStage[]; hints: string[]; trackedEventsInRange: number; lookbackDays: number; rates?: FunnelRates } | null>(null)

  const loadFunnel = async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const response = await fetch(`/api/vendor/dashboard?vendorId=${encodeURIComponent(user.uid)}&funnelDays=${encodeURIComponent(funnelDays)}`, {
        credentials: "include",
      })
      const result = await response.json().catch(() => ({}))
      if (response.ok && result?.success) {
        setFunnel(result?.data?.conversionFunnel || null)
      }
    } catch {
      // Ignore transient failures.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFunnel()
  }, [user?.uid, funnelDays])

  const maxStageValue = useMemo(() => {
    const values = (funnel?.stages || []).map((item) => Number(item.value || 0))
    return Math.max(1, ...values)
  }, [funnel?.stages])

  return (
    <VendorLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Conversion Funnel</h1>
            <p className="text-sm text-muted-foreground">Track store visits to completed checkout performance over your selected time range.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={funnelDays} onValueChange={setFunnelDays}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void loadFunnel()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(funnel?.stages || []).map((stage) => (
            <Card key={stage.key}>
              <CardHeader className="pb-2">
                <CardDescription>{stage.label}</CardDescription>
                <CardTitle>{Number(stage.value || 0).toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (Number(stage.value || 0) / maxStageValue) * 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Stage Conversion Rates</CardTitle>
            <CardDescription>Rates are calculated from real tracked events.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm">Visit → View</span>
              <Badge variant="outline">{Number(funnel?.rates?.visitToView || 0).toFixed(1)}%</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm">View → Cart</span>
              <Badge variant="outline">{Number(funnel?.rates?.viewToCart || 0).toFixed(1)}%</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm">Cart → Checkout</span>
              <Badge variant="outline">{Number(funnel?.rates?.cartToCheckout || 0).toFixed(1)}%</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm">Checkout → Order</span>
              <Badge variant="outline">{Number(funnel?.rates?.checkoutToOrder || 0).toFixed(1)}%</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2 lg:col-span-1">
              <span className="text-sm">Visit → Order</span>
              <Badge>{Number(funnel?.rates?.visitToOrder || 0).toFixed(1)}%</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2 lg:col-span-2">
              <span className="text-sm">Tracked Events ({Number(funnel?.lookbackDays || Number(funnelDays) || 30)}d)</span>
              <Badge variant="secondary">{Number(funnel?.trackedEventsInRange || 0).toLocaleString()}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Optimization Hints</CardTitle>
            <CardDescription>Actionable recommendations based on your funnel signal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(funnel?.hints || []).map((hint, idx) => (
              <p key={idx} className="text-sm text-muted-foreground">• {hint}</p>
            ))}
            <div className="pt-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/vendor/products">Optimize Products</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </VendorLayout>
  )
}
