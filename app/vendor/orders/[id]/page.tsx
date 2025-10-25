"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { getDocument } from "@/lib/firestore"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Loader2, ArrowLeft, Package, User, MapPin, CreditCard, Calendar, Truck } from "lucide-react"

export default function VendorOrderDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrder = async () => {
      if (user && id) {
        setLoading(true)
        try {
          const result = await getDocument("orders", id as string) as any
          if (result && result.vendorId === user.uid) {
            setOrder(result)
          } else {
            router.push("/vendor/orders")
          }
        } catch (error) {
          console.error("Error fetching order:", error)
          router.push("/vendor/orders")
        } finally {
          setLoading(false)
        }
      }
    }
    fetchOrder()
  }, [user, id, router])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "default"
      case "shipped":
        return "secondary"
      case "cancelled":
        return "destructive"
      default:
        return "outline"
    }
  }

  if (loading) {
    return (
      <VendorLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </VendorLayout>
    )
  }

  if (!order) {
    return (
      <VendorLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Order not found</p>
          <Button onClick={() => router.push("/vendor/orders")} className="mt-4">
            Back to Orders
          </Button>
        </div>
      </VendorLayout>
    )
  }

  return (
    <VendorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/vendor/orders")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Order Details</h1>
              <p className="text-muted-foreground">Order #{order.id?.slice(0, 8)}</p>
            </div>
          </div>
          <Badge variant={getStatusColor(order.status)}>
            {order.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Order Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-medium">{order.id?.slice(0, 12)}...</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Order Date</span>
                <span className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {order.createdAt?.toDate?.()?.toLocaleDateString() || "N/A"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Amount</span>
                <span className="font-bold text-lg">₦{order.totalAmount?.toLocaleString() || 0}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Payment Status</span>
                <Badge variant="outline">{order.paymentStatus || "Pending"}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Customer Name</span>
                <span className="font-medium">{order.customerName || "N/A"}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Customer ID</span>
                <span className="font-medium">{order.customerId?.slice(0, 12)}...</span>
              </div>
              <Separator />
              <div className="flex items-start justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Shipping Address
                </span>
                <span className="font-medium text-right max-w-[60%]">
                  {order.shippingAddress ? (
                    typeof order.shippingAddress === 'object' ? (
                      <div className="text-sm">
                        {order.shippingAddress.street && <div>{order.shippingAddress.street}</div>}
                        {order.shippingAddress.city && <div>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}</div>}
                        {order.shippingAddress.country && <div>{order.shippingAddress.country}</div>}
                      </div>
                    ) : (
                      order.shippingAddress
                    )
                  ) : (
                    "No address provided"
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.products?.map((product: any, index: number) => (
                <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.title || "Product"}
                      className="w-20 h-20 object-cover rounded-md"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold">{product.title || product.productId}</h3>
                    <p className="text-sm text-muted-foreground">Quantity: {product.quantity}</p>
                    {product.color && <p className="text-sm text-muted-foreground">Color: {product.color}</p>}
                    {product.size && <p className="text-sm text-muted-foreground">Size: {product.size}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">₦{(product.price * product.quantity).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">₦{product.price} each</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shipping Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Shipping Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Status</span>
                <Badge variant={getStatusColor(order.status)}>{order.status}</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="font-medium">
                  {order.updatedAt?.toDate?.()?.toLocaleString() || "N/A"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button onClick={() => router.push("/vendor/orders")} variant="outline">
            Back to Orders
          </Button>
          {order.status === "pending" && (
            <>
              <Button onClick={() => alert("Mark as shipped functionality coming soon")}>
                Mark as Shipped
              </Button>
              <Button 
                variant="destructive"
                onClick={() => alert("Cancel order functionality coming soon")}
              >
                Cancel Order
              </Button>
            </>
          )}
        </div>
      </div>
    </VendorLayout>
  )
}
