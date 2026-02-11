"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
// import { getOrders } from "@/lib/firestore"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, ShoppingCart, Package, Truck, CheckCircle, XCircle } from "lucide-react"
import OrderDetailsSlider from "@/components/vendor/OrderDetailsSlider"
import { useNotification } from "@/contexts/NotificationContext"

export default function VendorOrdersPage() {
  const { user } = useAuth()
  const { success } = useNotification()
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [showSlider, setShowSlider] = useState(false)
  
  // Filter states
  const [completionFilter, setCompletionFilter] = useState<'all' | 'complete' | 'incomplete'>('incomplete')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchOrders = async () => {
    if (user) {
      setLoading(true)
      try {
        const res = await fetch(`/api/vendor/orders?vendorId=${user.uid}`);
        const data = await res.json();
        setOrders(data.orders || []);
      } catch (error) {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user])

  const handleStatusUpdated = async () => {
    success('Order status updated')
    await fetchOrders()
    setShowSlider(false)
  }

  // Apply filters
  const filteredOrders = orders.filter(order => {
    // Completion filter
    if (completionFilter === 'complete') {
      if (!['delivered', 'received'].includes(order.status)) return false
    } else if (completionFilter === 'incomplete') {
      if (['delivered', 'received', 'cancelled'].includes(order.status)) return false
    }
    
    // Status filter
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false
    }
    
    return true
  })

  return (
    <VendorLayout>
      <>
        <div className="container mx-auto py-12">
          <h1 className="text-3xl font-bold mb-6">Orders</h1>
          <p className="text-muted-foreground mb-8">View and manage all orders for your store</p>
          
          {/* Filters */}
          {!loading && orders.length > 0 && (
            <div className="mb-6 bg-card rounded-lg p-4 shadow-md border border-border">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Completion Filter */}
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2">Order Status</label>
                  <div className="flex gap-2">
                    <Button
                      variant={completionFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCompletionFilter('all')}
                      className="flex-1"
                    >
                      All ({orders.length})
                    </Button>
                    <Button
                      variant={completionFilter === 'complete' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCompletionFilter('complete')}
                      className="flex-1"
                    >
                      Complete ({orders.filter(o => ['delivered', 'received'].includes(o.status)).length})
                    </Button>
                    <Button
                      variant={completionFilter === 'incomplete' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCompletionFilter('incomplete')}
                      className="flex-1"
                    >
                      In Progress ({orders.filter(o => !['delivered', 'received', 'cancelled'].includes(o.status)).length})
                    </Button>
                  </div>
                </div>
                
                {/* Delivery Stage Filter */}
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2">Delivery Stage</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="all">All Stages</option>
                    <option value="pending">Pending</option>
                    <option value="pending_payment">Pending Payment</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="shipped_interstate">Shipped (Interstate)</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="received">Received</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              
              {/* Results count */}
              <div className="mt-3 text-sm text-muted-foreground">
                Showing {filteredOrders.length} of {orders.length} orders
              </div>
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
              <p className="text-muted-foreground">You haven't received any orders yet.</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No orders match your filters</h3>
              <p className="text-muted-foreground">Try adjusting your filters to see more orders.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredOrders.map((order) => (
                <Card key={order.orderId || order.id} className="bg-accent/10 backdrop-blur-md border-white/20 shadow-lg">
                  <CardHeader>
                    <CardTitle>Order #{(order.orderId || order.id || "").toString().substring(0, 8).toUpperCase()}</CardTitle>
                    <CardDescription>
                      Placed on {order.createdAt ? (typeof order.createdAt === 'string' ? new Date(order.createdAt).toLocaleDateString() : order.createdAt?.toLocaleDateString?.()) : "Unknown date"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3">
                      {order.products?.map((prod: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-2 border border-white/10 rounded-md bg-white/5 backdrop-blur-sm">
                          {prod.image && (
                            <img
                              src={prod.image}
                              alt={prod.title || "Product"}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 flex items-center gap-3">
                            <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium">{prod.title || prod.productId}</p>
                              <p className="text-sm text-muted-foreground">
                                Qty: {prod.quantity} × ₦{prod.price}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-semibold">Total:</span>
                      <span className="text-lg font-bold">₦{order.totalAmount?.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={order.status === "delivered" ? "default" : order.status === "shipped" ? "secondary" : order.status === "cancelled" ? "destructive" : "outline"}>
                        {order.status}
                      </Badge>
                      {order.status === "delivered" && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {order.status === "shipped" && <Truck className="h-5 w-5 text-blue-500" />}
                      {order.status === "cancelled" && <XCircle className="h-5 w-5 text-red-500" />}
                    </div>
                    <Button 
                      variant="outline" 
                      className="mt-4 w-full hover:bg-accent/10 hover:text-accent transition-all"
                      onClick={() => { setSelectedOrder(order); setShowSlider(true); }}
                    >
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <OrderDetailsSlider open={showSlider} onOpenChange={setShowSlider} order={selectedOrder} onStatusUpdated={handleStatusUpdated} />
      </>
    </VendorLayout>
  )
}
