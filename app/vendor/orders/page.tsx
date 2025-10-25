"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { getOrders } from "@/lib/firestore"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, ShoppingCart, Package, Truck, CheckCircle, XCircle } from "lucide-react"

export default function VendorOrdersPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      if (user) {
        setLoading(true)
        try {
          const result = await getOrders({ vendorId: user.uid })
          setOrders(result || [])
        } catch (error) {
          setOrders([])
        } finally {
          setLoading(false)
        }
      }
    }
    fetchOrders()
  }, [user])

  return (
    <VendorLayout>
      <div className="container mx-auto py-12">
        <h1 className="text-3xl font-bold mb-6">Orders</h1>
        <p className="text-muted-foreground mb-8">View and manage all orders for your store</p>
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {orders.map((order) => (
              <Card key={order.id} className="shadow-md">
                <CardHeader>
                  <CardTitle>Order #{order.id}</CardTitle>
                  <CardDescription>
                    Placed on {order.createdAt?.toDate?.().toLocaleDateString?.() || "Unknown date"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3">
                    {order.products?.map((prod: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 p-2 border rounded-md">
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
                    className="mt-4 w-full"
                    onClick={() => router.push(`/vendor/orders/${order.id}`)}
                  >
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </VendorLayout>
  )
}
