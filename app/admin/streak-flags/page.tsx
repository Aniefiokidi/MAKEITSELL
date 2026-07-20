"use client"

import { useEffect, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Flag } from "lucide-react"

type FlagRow = {
  vendorId: string
  vendorName: string
  vendorEmail: string
  targetOrderCount: number
  floorOrderCount: number
  lowestProductPriceAtLock: number
  currentStreak: number
  updatedAt: string
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n || 0)

export default function AdminStreakFlagsPage() {
  const [rows, setRows] = useState<FlagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actingOn, setActingOn] = useState<string | null>(null)

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const response = await fetch("/api/admin/streak-flags", { credentials: "include" })
      const result = await response.json()
      if (result?.success) setRows(Array.isArray(result.rows) ? result.rows : [])
    } catch {
      setRows([])
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAction = async (vendorId: string, action: "fix-target" | "dismiss") => {
    setActingOn(vendorId)
    try {
      await fetch("/api/admin/streak-flags", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, action }),
      })
      setRows((prev) => prev.filter((r) => r.vendorId !== vendorId))
    } finally {
      setActingOn(null)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Streak Target Flags</h1>
            <p className="text-muted-foreground text-sm lg:text-base">
              Vendors whose locked monthly order-count target no longer clears the real floor for their
              current lowest-priced product — usually because prices changed after the target was set.
              The GMV floor check at monthly evaluation already blocks payout either way; this is about
              keeping the displayed target honest.
            </p>
          </div>
          <Button variant="outline" onClick={() => fetchData(true)} disabled={refreshing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flag className="h-5 w-5" /> Flagged Vendors ({rows.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No vendors currently flagged.</p>
            ) : (
              rows.map((row) => (
                <div key={row.vendorId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{row.vendorName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{row.vendorEmail}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="outline">Locked target: {row.targetOrderCount} orders</Badge>
                      <Badge variant="destructive">Real floor: {row.floorOrderCount} orders</Badge>
                      <Badge variant="outline">Lowest price: {formatCurrency(row.lowestProductPriceAtLock)}</Badge>
                      <Badge variant="outline">Streak: {row.currentStreak}mo</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingOn === row.vendorId}
                      onClick={() => handleAction(row.vendorId, "dismiss")}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      disabled={actingOn === row.vendorId}
                      onClick={() => handleAction(row.vendorId, "fix-target")}
                    >
                      Raise target to {row.floorOrderCount}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
