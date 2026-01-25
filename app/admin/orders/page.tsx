"use client"

import { useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Loader2 } from "lucide-react"

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch("/api/admin/orders")
        const data = await res.json()
        if (data.success) {
          setOrders(data.orders || [])
        }
      } catch (error) {
        console.error("Failed to fetch orders:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return orders.filter((o) =>
      (o.orderId || "").toLowerCase().includes(term) ||
      (o.customerEmail || "").toLowerCase().includes(term) ||
      (o.customerName || "").toLowerCase().includes(term) ||
      (o.status || "").toLowerCase().includes(term) ||
      (o.paymentStatus || "").toLowerCase().includes(term) ||
      (Array.isArray(o.storeNames) ? o.storeNames.join(" ").toLowerCase().includes(term) : false)
    )
  }, [orders, search])

  const statusBadge = (status: string) => {
    const variants: Record<string, "secondary" | "destructive" | "outline"> = {
      completed: "secondary",
      delivered: "secondary",
      paid: "secondary",
      processing: "outline",
      pending: "outline",
      failed: "destructive",
      cancelled: "destructive",
      shipped: "outline",
      received: "secondary",
    }
    return <Badge variant={variants[status] || "outline"}>{status || "pending"}</Badge>
  }

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId)
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus })
      })
      const data = await res.json()
      if (data.success) {
        setOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, status: newStatus } : o))
      }
    } catch (error) {
      console.error('Failed to update order status:', error)
    } finally {
      setUpdatingOrderId(null)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Orders Management</h1>
          <p className="text-muted-foreground text-sm lg:text-base">Track and review all customer orders</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Search Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by order ID, customer, store, or status"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">All Orders ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-accent rounded-full"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No orders found</div>
            ) : (
              <div className="space-y-4">
                {/* Mobile view - Card layout */}
                <div className="lg:hidden space-y-4">
                  {filtered.map((order) => (
                    <Card key={order.id || order._id || order.orderId} className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Order ID:</span>
                            <span className="text-right font-mono text-xs break-all">{order.orderId || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Customer:</span>
                            <div className="text-right">
                              <p className="text-xs font-medium">{order.customerName || "N/A"}</p>
                              <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Stores:</span>
                            <span className="text-right text-xs">{Array.isArray(order.storeNames) && order.storeNames.length > 0 ? order.storeNames.join(", ") : "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Order Status:</span>
                            <Select value={order.status || "pending"} onValueChange={(val) => handleStatusUpdate(order.orderId, val)} disabled={updatingOrderId === order.orderId}>
                              <SelectTrigger className="w-32 h-8 text-xs">
                                {updatingOrderId === order.orderId ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="received">Received</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Payment:</span>
                            <div>{statusBadge(order.paymentStatus)}</div>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Total Amount:</span>
                            <span className="font-semibold">₦{Number(order.totalAmount || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Date:</span>
                            <span className="text-xs">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A"}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop view - Table layout */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Order ID</TableHead>
                        <TableHead className="text-xs">Customer</TableHead>
                        <TableHead className="text-xs">Stores</TableHead>
                        <TableHead className="text-xs">Order Status</TableHead>
                        <TableHead className="text-xs">Payment</TableHead>
                        <TableHead className="text-xs">Total</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((order) => (
                        <TableRow key={order.id || order._id || order.orderId}>
                          <TableCell className="font-medium text-xs">{order.orderId || order.id || "N/A"}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-xs">{order.customerName || "N/A"}</p>
                              <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs">
                              {Array.isArray(order.storeNames) && order.storeNames.length > 0
                                ? order.storeNames.join(", ")
                                : "N/A"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Select value={order.status || "pending"} onValueChange={(val) => handleStatusUpdate(order.orderId, val)} disabled={updatingOrderId === order.orderId}>
                              <SelectTrigger className="w-32 h-8 text-xs">
                                {updatingOrderId === order.orderId ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="received">Received</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>{statusBadge(order.paymentStatus)}</TableCell>
                          <TableCell className="text-xs font-semibold">₦{Number(order.totalAmount || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">
                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
