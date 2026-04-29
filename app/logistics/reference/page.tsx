"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, MapPin, Phone, Package, RefreshCw } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import LogisticsLayout from "@/components/logistics/LogisticsLayout"
import { logisticsEmailAllowedForRegion, resolveLogisticsRegion } from "@/lib/logistics-access"

type LogisticsOrder = {
  rowId: string
  orderId: string
  vendorId?: string
  storeId?: string
  createdAt: string
  orderStatus: string
  paymentStatus: string
  totalAmount: number
  shippingFee?: number | null
  shippingFeeLabel?: string
  customerName: string
  customerPhone: string
  customerEmail: string
  storeName: string
  storeOwnerName: string
  pickupLocation: string
  pickupPhone: string
  dropoffLocation: string
  dropoffPhone: string
  instructions: string
  items: Array<{
    title?: string
    quantity?: number
    price?: number
  }>
}

const region = resolveLogisticsRegion("lagos")

export default function LogisticsReferencePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [orders, setOrders] = useState<LogisticsOrder[]>([])

  const prioritizedOrders = useMemo(() => {
    const sorted = [...orders]
    sorted.sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime()
      const bTime = new Date(b.createdAt || 0).getTime()
      return bTime - aTime
    })
    return sorted
  }, [orders])

  const totalValue = useMemo(
    () => prioritizedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    [prioritizedOrders]
  )

  const isAllowedUser = logisticsEmailAllowedForRegion(user?.email, region)

  const fetchOrders = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/logistics/orders?view=received&region=lagos", {
        method: "GET",
        credentials: "include",
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok || !result?.success) {
        if (response.status === 401) {
          router.push("/login")
          return
        }

        if (response.status === 403) {
          router.push("/")
          return
        }

        throw new Error(result?.error || "Failed to load reference orders")
      }

      setOrders(Array.isArray(result.orders) ? result.orders : [])
    } catch (err: any) {
      setOrders([])
      setError(err?.message || "Failed to load reference orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    if (!isAllowedUser) {
      router.push("/")
      return
    }

    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.email])

  if (authLoading || (!isAllowedUser && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <LogisticsLayout regionKey="lagos">
      <div className="container mx-auto px-0 py-0 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Received Packages Reference</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Historical archive for orders marked as received.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/logistics">
              <Button variant="secondary">Back to Active</Button>
            </Link>
            <Button variant="outline" onClick={fetchOrders} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Received Entries</p>
              <p className="text-2xl font-bold">{prioritizedOrders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Archived Order Value</p>
              <p className="text-2xl font-bold">₦{totalValue.toLocaleString("en-NG")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Filter Rule</p>
              <p className="text-2xl font-bold">status = received</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {prioritizedOrders.map((order, index) => (
            <Card key={order.rowId || `${order.orderId}-${order.vendorId || order.storeId || index}`}>
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Order ID</p>
                    <p className="font-semibold">{order.orderId}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge variant="outline">{order.orderStatus === "out_for_delivery" ? "en route" : order.orderStatus}</Badge>
                    <Badge variant="outline">payment: {order.paymentStatus}</Badge>
                    <Badge>₦{Number(order.totalAmount || 0).toLocaleString("en-NG")}</Badge>
                    <Badge variant="secondary">shipping: {order.shippingFee == null ? "TBD" : `₦${Number(order.shippingFee).toLocaleString("en-NG")}`}</Badge>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <p className="font-semibold">Pickup</p>
                    <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5" /> {order.pickupLocation}</p>
                    <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {order.pickupPhone || "No pickup phone"}</p>
                    <p><span className="text-muted-foreground">Shipping Fee:</span> {order.shippingFeeLabel || (order.shippingFee == null ? "TBD" : `NGN ${Number(order.shippingFee).toLocaleString("en-NG")}`)}</p>
                    <p><span className="text-muted-foreground">Store:</span> {order.storeName}</p>
                    <p><span className="text-muted-foreground">Store Owner:</span> {order.storeOwnerName}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold">Drop-off</p>
                    <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5" /> {order.dropoffLocation}</p>
                    <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {order.dropoffPhone || order.customerPhone || "No customer phone"}</p>
                    <p><span className="text-muted-foreground">Customer:</span> {order.customerName}</p>
                    <p><span className="text-muted-foreground">Customer Email:</span> {order.customerEmail || "N/A"}</p>
                  </div>
                </div>

                <div className="rounded-lg border p-3 bg-accent/5">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">IMPORTANT INSTRUCTIONS</p>
                  <p className="text-sm">{order.instructions}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Package className="h-4 w-4" /> Items</p>
                  <div className="space-y-1">
                    {(order.items || []).map((item, itemIndex) => (
                      <div key={itemIndex} className="text-sm flex items-center justify-between rounded-md border px-3 py-2">
                        <span>{item?.title || "Item"}</span>
                        <span className="text-muted-foreground">
                          Qty {Number(item?.quantity || 0)} {typeof item?.price === "number" ? `- ₦${Number(item.price).toLocaleString("en-NG")}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {prioritizedOrders.length === 0 && !loading && (
            <Card>
              <CardHeader>
                <CardTitle>No Received Orders Yet</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Orders marked as received will appear here for reference.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </LogisticsLayout>
  )
}
