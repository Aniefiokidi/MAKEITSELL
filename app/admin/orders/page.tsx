"use client"

import { useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search } from "lucide-react"

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

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
    }
    return <Badge variant={variants[status] || "outline"}>{status || "pending"}</Badge>
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Orders Management</h1>
          <p className="text-muted-foreground">Track and review all customer orders</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by order ID, customer, store, or status"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-accent rounded-full"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No orders found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Stores</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((order) => (
                      <TableRow key={order.id || order._id || order.orderId}>
                        <TableCell className="font-medium">{order.orderId || order.id || "N/A"}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{order.customerName || "N/A"}</p>
                            <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {Array.isArray(order.storeNames) && order.storeNames.length > 0
                              ? order.storeNames.join(", ")
                              : "N/A"}
                          </p>
                        </TableCell>
                        <TableCell>{statusBadge(order.status)}</TableCell>
                        <TableCell>{statusBadge(order.paymentStatus)}</TableCell>
                        <TableCell>₦{Number(order.totalAmount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
