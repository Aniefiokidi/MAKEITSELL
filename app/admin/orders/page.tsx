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
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch("/api/admin/orders")
        const data = await res.json()
        if (data.success) {
          if (data.orders && data.orders[0]) {
            console.log('[Admin Orders] First order items[0]:', data.orders[0].items?.[0])
          }
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
    const fromDate = dateFrom ? new Date(dateFrom).getTime() : null
    const toDate = dateTo ? new Date(dateTo).getTime() : null
    
    // Flatten orders into individual item rows
    const itemRows = orders.flatMap((order) => {
      const items = Array.isArray(order.items) ? order.items : []
      if (items.length === 0) {
        // If no items, show the order once
        return [{
          ...order,
          itemTitle: 'N/A',
          itemQuantity: 1,
          itemImage: null,
          itemPrice: 0,
          isRealItem: false
        }]
      }
      // Each item becomes its own row
      return items.map((item, idx) => ({
        ...order,
        itemTitle: item.title || item.name || 'Product',
        itemQuantity: item.quantity || 1,
        itemImage: item.images?.[0],
        itemPrice: item.price || 0,
        itemIndex: idx,
        isRealItem: true
      }))
    })
    
    const filtered = itemRows.filter((row) => {
      // Search filter
      const matchSearch = 
        (row.orderId || "").toLowerCase().includes(term) ||
        (row.customerEmail || "").toLowerCase().includes(term) ||
        (row.customerName || "").toLowerCase().includes(term) ||
        (row.itemTitle || "").toLowerCase().includes(term) ||
        (row.status || "").toLowerCase().includes(term) ||
        (row.paymentStatus || "").toLowerCase().includes(term) ||
        (Array.isArray(row.storeNames) ? row.storeNames.join(" ").toLowerCase().includes(term) : false)
      
      if (!matchSearch) return false
      
      // Status filter
      if (statusFilter !== "all" && row.status !== statusFilter) return false
      
      // Date range filter
      const orderDate = row.createdAt ? new Date(row.createdAt).getTime() : null
      if (fromDate && orderDate && orderDate < fromDate) return false
      if (toDate && orderDate && orderDate > toDate) return false
      
      return true
    })
    
    // Sort by newest first (descending by createdAt)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateB - dateA
    })
  }, [orders, search, statusFilter, dateFrom, dateTo])

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = filtered.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const getStatusTimestamp = (order: any) => {
    switch (order.status) {
      case 'shipped':
        return order.shippedAt ? new Date(order.shippedAt).toLocaleDateString() : '-'
      case 'delivered':
        return order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString() : '-'
      case 'received':
        return order.receivedAt ? new Date(order.receivedAt).toLocaleDateString() : '-'
      case 'cancelled':
        return order.cancelledAt ? new Date(order.cancelledAt).toLocaleDateString() : '-'
      default:
        return order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'
    }
  }

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
            <CardTitle className="text-base lg:text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium block mb-2">Order Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-2">From Date</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-2">To Date</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={() => { setStatusFilter('all'); setDateFrom(''); setDateTo(''); setCurrentPage(1); }} className="w-full h-9 text-sm">
                  Clear Filters
                </Button>
              </div>
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
                  {paginatedItems.map((row) => (
                    <Card key={`${row.orderId}-${row.itemIndex || 0}`} className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Order ID:</span>
                            <span className="text-right font-mono text-xs break-all">{row.orderId || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Customer:</span>
                            <div className="text-right">
                              <p className="text-xs font-medium">{row.customerName || "N/A"}</p>
                              <p className="text-xs text-muted-foreground">{row.customerEmail}</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Store:</span>
                            <span className="text-xs">{Array.isArray(row.storeNames) && row.storeNames.length > 0 ? row.storeNames[0] : "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Product:</span>
                            <div className="text-right flex items-center gap-2">
                              {row.itemImage && (
                                <img src={row.itemImage} alt={row.itemTitle} className="h-8 w-8 rounded object-cover" />
                              )}
                              <p className="text-xs font-medium">{row.itemTitle}</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Qty:</span>
                            <span className="text-xs font-medium">{row.itemQuantity === 1 ? 'One' : row.itemQuantity}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Amount:</span>
                            <span className="text-xs font-semibold">₦{Number(row.itemPrice * row.itemQuantity || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Order Status:</span>
                            <Select value={row.status || "pending"} onValueChange={(val) => handleStatusUpdate(row.orderId, val)} disabled={updatingOrderId === row.orderId}>
                              <SelectTrigger className="w-28 h-8 text-xs">
                                {updatingOrderId === row.orderId ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
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
                            <div>{statusBadge(row.paymentStatus)}</div>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Date:</span>
                            <span className="text-xs">{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "N/A"}</span>
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
                        <TableHead className="text-xs">Store</TableHead>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-xs">Qty</TableHead>
                        <TableHead className="text-xs">Order Status</TableHead>
                        <TableHead className="text-xs">Status Time</TableHead>
                        <TableHead className="text-xs">Payment</TableHead>
                        <TableHead className="text-xs">Amount</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map((row) => (
                        <TableRow key={`${row.orderId}-${row.itemIndex || 0}`} className="hover:bg-muted/50">
                          <TableCell className="font-medium text-xs">{row.orderId || row.id || "N/A"}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-xs">{row.customerName || "N/A"}</p>
                              <p className="text-xs text-muted-foreground">{row.customerEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs">
                              {Array.isArray(row.storeNames) && row.storeNames.length > 0
                                ? row.storeNames[0]
                                : "N/A"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2 items-center">
                              {row.itemImage && (
                                <img src={row.itemImage} alt={row.itemTitle} className="h-8 w-8 rounded object-cover" />
                              )}
                              <p className="text-xs font-medium">{row.itemTitle}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {row.itemQuantity === 1 ? 'One' : row.itemQuantity}
                          </TableCell>
                          <TableCell>
                            <Select value={row.status || "pending"} onValueChange={(val) => handleStatusUpdate(row.orderId, val)} disabled={updatingOrderId === row.orderId}>
                              <SelectTrigger className="w-28 h-8 text-xs">
                                {updatingOrderId === row.orderId ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
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
                          <TableCell className="text-xs">{getStatusTimestamp(row)}</TableCell>
                          <TableCell>{statusBadge(row.paymentStatus)}</TableCell>
                          <TableCell className="text-xs font-semibold">₦{Number(row.itemPrice * row.itemQuantity || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">
                            {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-end items-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-8 px-3 text-xs"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(page)}
                          className="h-8 w-8 p-0 text-xs"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="h-8 px-3 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
