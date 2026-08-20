"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Package, TrendingDown, TrendingUp } from "lucide-react"

type BestSellerWindow = "7d" | "30d" | "90d" | "all"

interface BestSellerProduct {
  productId: string
  name: string
  image: string | null
  category: string | null
  vendorId: string
  vendorName: string | null
  storeId: string | null
  unitsSold: number
  revenue: number
  previousUnitsSold: number | null
  changePercent: number | null
  trend: "up" | "down" | "flat" | "new"
  projectedNextPeriodUnits: number | null
}

interface BestSellersData {
  window: BestSellerWindow
  dailyBreakdown: { date: string; unitsSold: number }[]
  products: BestSellerProduct[]
}

const WINDOW_OPTIONS: { value: BestSellerWindow; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All-time" },
]

function TrendBadge({ product }: { product: BestSellerProduct }) {
  if (product.trend === "new") {
    return <span className="text-xs font-semibold text-blue-600">New</span>
  }
  if (product.changePercent === null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const isUp = product.trend === "up"
  const isFlat = product.trend === "flat"
  if (isFlat) {
    return <span className="text-xs text-muted-foreground">No change</span>
  }
  const Icon = isUp ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isUp ? "text-green-600" : "text-red-600"}`}>
      <Icon className="h-3 w-3" />
      {isUp ? "+" : ""}
      {product.changePercent.toFixed(1)}%
    </span>
  )
}

export default function BestSellersPage() {
  const [window, setWindowValue] = useState<BestSellerWindow>("30d")
  const [data, setData] = useState<BestSellersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/best-sellers?window=${window}`, { credentials: "include" })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || "Failed to load best sellers")
        if (!cancelled) setData(json)
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load best sellers")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [window])

  const windowLabel = WINDOW_OPTIONS.find((w) => w.value === window)?.label || window

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Best Sellers</h1>
          <p className="text-muted-foreground text-sm lg:text-base">
            Top 10 products by real settled sales, with trend and a short-term projection.
          </p>
          <div className="mt-3 flex gap-2">
            {WINDOW_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={window === opt.value ? "default" : "outline"}
                onClick={() => setWindowValue(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading best sellers...</div>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : data && data.products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No settled sales in this window yet.
            </CardContent>
          </Card>
        ) : data ? (
          <>
            <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm lg:text-base">Top 10 by Units Sold</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.products}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="unitsSold" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm lg:text-base">Units Sold Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={data.dailyBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="unitsSold" stroke="#ef4444" fill="#fecaca" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm lg:text-base">Product Ranking</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Mobile view - List */}
                <div className="lg:hidden space-y-3">
                  {data.products.map((p, idx) => (
                    <div key={p.productId} className="flex items-start gap-3 p-2 bg-muted/50 rounded">
                      <span className="text-sm font-bold text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                      {p.image ? (
                        <Image src={p.image} alt={p.name} width={40} height={40} className="rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.category || "Uncategorized"}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs">{p.unitsSold} sold</span>
                          <TrendBadge product={p} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm">₦{p.revenue.toLocaleString()}</p>
                        {p.projectedNextPeriodUnits !== null && (
                          <p className="text-xs text-muted-foreground">~{p.projectedNextPeriodUnits} next {windowLabel}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop view - Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-right text-xs">Units Sold</TableHead>
                        <TableHead className="text-right text-xs">Revenue</TableHead>
                        <TableHead className="text-right text-xs">Trend</TableHead>
                        <TableHead className="text-right text-xs">Projected Next {windowLabel}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.products.map((p, idx) => (
                        <TableRow key={p.productId}>
                          <TableCell className="text-xs font-semibold">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {p.image ? (
                                <Image src={p.image} alt={p.name} width={32} height={32} className="rounded object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                              )}
                              <span className="text-xs font-medium truncate max-w-[180px]">{p.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{p.category || "Uncategorized"}</TableCell>
                          <TableCell className="text-right text-xs font-semibold">{p.unitsSold}</TableCell>
                          <TableCell className="text-right text-xs font-semibold">₦{p.revenue.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <TrendBadge product={p} />
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {p.projectedNextPeriodUnits !== null ? p.projectedNextPeriodUnits : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
