"use client"
import React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Header from "@/components/Header"
import { useNotification } from "@/contexts/NotificationContext"
interface Booking {
  id: string
  customerId: string
  vendorId: string
  serviceId: string
  serviceName: string
  date: string
  time: string
  status: string
  totalAmount: number
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  notes?: string
  storeName?: string
  location?: string
  createdAt: Date
}

export default function CustomerOrdersPage() {
  const { user } = useAuth()
  const { success, error: notifyError } = useNotification()
  const [orders, setOrders] = useState<any[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [productDetails, setProductDetails] = useState<Record<string, any>>({})
  const [storeDetails, setStoreDetails] = useState<Record<string, any>>({})
  const [storeNames, setStoreNames] = useState<{ [vendorId: string]: string }>({})
  
  // Filter states
  const [completionFilter, setCompletionFilter] = useState<'all' | 'complete' | 'incomplete'>('incomplete')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Format currency with commas
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-NG')
  }

  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        setLoading(true)
        try {
          const [ordersResponse, bookingsResponse] = await Promise.all([
            fetch(`/api/orders?customerId=${user.uid}`),
            fetch(`/api/bookings?customerId=${user.uid}`)
          ])
          const ordersResult = await ordersResponse.json()
          const bookingsResult = await bookingsResponse.json()
          setOrders(Array.isArray(ordersResult) ? ordersResult : [])
          setBookings(Array.isArray(bookingsResult) ? bookingsResult : [])

          // Fetch product and store details for each order
          const productIds = new Set<string>()
          const vendorIds = new Set<string>()
          ;(Array.isArray(ordersResult) ? ordersResult : []).forEach(order => {
            if (Array.isArray(order.vendors)) {
              order.vendors.forEach((vendor: any) => {
                if (vendor.vendorId) vendorIds.add(vendor.vendorId)
                if (Array.isArray(vendor.items)) {
                  vendor.items.forEach((prod: any) => {
                    if (prod.productId) productIds.add(prod.productId)
                  })
                }
              })
            } else {
              order.products?.forEach((prod: any) => {
                if (prod.productId) productIds.add(prod.productId)
              })
              if (order.storeId) vendorIds.add(order.storeId)
            }
          })
          // Fetch all product details
          const productDetailsObj: Record<string, any> = {}
          await Promise.all(Array.from(productIds).map(async (pid) => {
            try {
              const res = await fetch(`/api/database/products/${pid}`)
              if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) productDetailsObj[pid] = json.data;
              }
            } catch {}
          }))
          setProductDetails(productDetailsObj)
          // Fetch all store names by vendorId
          const storeNamesObj: { [vendorId: string]: string } = {}
          await Promise.all(Array.from(vendorIds).map(async (vendorId) => {
            try {
              const res = await fetch(`/api/database/stores?vendorId=${vendorId}`)
              const json = await res.json()
              if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                storeNamesObj[vendorId] = json.data[0].storeName || json.data[0].name || 'Store'
              } else {
                storeNamesObj[vendorId] = 'Store'
              }
            } catch {
              storeNamesObj[vendorId] = 'Store'
            }
          }))
          setStoreNames(storeNamesObj)
        } catch (error) {
          // handle error if needed
        } finally {
          setLoading(false)
        }
      }
    }
    fetchData();
  }, [user]);

  // Debug: Log fetched data
  useEffect(() => {
    if (!loading) {
      console.log('ORDERS:', orders);
      console.log('PRODUCT DETAILS:', productDetails);
      console.log('STORE DETAILS:', storeDetails);
    }
  }, [loading, orders, productDetails, storeDetails]);
  // Flatten orders so each product is its own card, even if from the same vendor
  const allFlattenedOrders = orders.flatMap(order => {
    if (Array.isArray(order.vendors) && order.vendors.length > 0) {
      return order.vendors.flatMap((vendor: any, vIdx: number) => (
        Array.isArray(vendor.items) && vendor.items.length > 0
          ? vendor.items.map((prod: any, pIdx: number) => ({
              ...order,
              _parentOrderId: order.orderId || order.id,
              vendor,
              product: prod,
              storeId: vendor.vendorId,
              storeName: vendor.vendorName,
              status: vendor.status || order.status,
            }))
          : []
      ))
    } else if (Array.isArray(order.products) && order.products.length > 0) {
      return order.products.map((prod: any, pIdx: number) => ({
        ...order,
        _parentOrderId: order.orderId || order.id,
        product: prod,
        storeId: order.storeId,
        storeName: order.storeName,
      }))
    } else {
      return [{ ...order, _parentOrderId: order.orderId || order.id }]
    }
  })

  // Apply filters
  const flattenedOrders = allFlattenedOrders.filter(order => {
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
    <React.Fragment>
      <main className="min-h-screen bg-linear-to-b from-background via-accent/10 to-background flex flex-col font-sans">
        <Header />
        <section className="flex-1 w-full max-w-7xl mx-auto mt-10 mb-16 px-2 md:px-0">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-center mb-8">Package History</h1>
          
          {/* Filters */}
          {!loading && allFlattenedOrders.length > 0 && (
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
                      All ({allFlattenedOrders.length})
                    </Button>
                    <Button
                      variant={completionFilter === 'complete' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCompletionFilter('complete')}
                      className="flex-1"
                    >
                      Complete ({allFlattenedOrders.filter(o => ['delivered', 'received'].includes(o.status)).length})
                    </Button>
                    <Button
                      variant={completionFilter === 'incomplete' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCompletionFilter('incomplete')}
                      className="flex-1"
                    >
                      In Progress ({allFlattenedOrders.filter(o => !['delivered', 'received', 'cancelled'].includes(o.status)).length})
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
                Showing {flattenedOrders.length} of {allFlattenedOrders.length} orders
              </div>
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <span className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></span>
            </div>
          ) : allFlattenedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <span className="text-6xl mb-4">🛒</span>
              <h2 className="text-3xl font-bold mb-2">No Orders Yet</h2>
              <p className="text-muted-foreground mb-6">You haven't placed any product orders yet. Start shopping now!</p>
              <Button asChild size="lg" className="bg-accent text-white font-bold px-8 py-4 rounded-full shadow-lg hover:bg-accent/80 transition-all">
                <a href="/stores">Browse Stores</a>
              </Button>
            </div>
          ) : flattenedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <span className="text-6xl mb-4">🔍</span>
              <h2 className="text-3xl font-bold mb-2">No Orders Match Your Filters</h2>
              <p className="text-muted-foreground mb-6">Try adjusting your filters to see more orders.</p>
              <Button size="lg" onClick={() => { setCompletionFilter('all'); setStatusFilter('all'); }} className="bg-accent text-white font-bold px-8 py-4 rounded-full shadow-lg hover:bg-accent/80 transition-all">
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {flattenedOrders.map((order, idx) => {
                const prod = order.product;
                const prodDetail = prod?.productId ? productDetails[prod.productId] : null;
                const productName = prodDetail?.title || prod?.title || prodDetail?.name || prod?.name || 'Product Name';
                const productImage =
                  prodDetail?.image ||
                  prodDetail?.imageUrl ||
                  prodDetail?.images?.[0] ||
                  prodDetail?.thumbnail ||
                  prod?.image ||
                  prod?.imageUrl ||
                  prod?.images?.[0] ||
                  prod?.thumbnail ||
                  '/images/placeholder-product.svg';
                // Store name logic: use fetched storeNames by vendorId, fallback to vendorName, then order.storeName, then 'Store'
                const vendorId = order.vendor?.vendorId || order.storeId;
                const storeName = (vendorId && storeNames[vendorId])
                  || order.vendor?.vendorName
                  || order.storeName
                  || 'Store';
                return (
                  <div key={order._parentOrderId + '-' + (order.storeId || idx) + '-' + (prod?.productId || idx)} className="bg-card text-card-foreground rounded-xl shadow-lg border border-border p-6 flex flex-col">
                    <div className="flex flex-row items-center gap-3 mb-6">
                      <div className="relative h-12 w-12 rounded-md overflow-hidden bg-muted shrink-0">
                        <Image src={productImage} alt={productName} fill className="object-cover" onError={e => { (e.target as HTMLImageElement).src = '/images/placeholder-product.svg' }} />
                      </div>
                      <div className="flex flex-col justify-center">
                        <div className="font-bold text-lg leading-tight">Order #{order._parentOrderId?.substring(0, 8).toUpperCase()}</div>
                        <div className="text-base font-semibold leading-tight">{productName}</div>
                        <div className="text-sm text-muted-foreground leading-tight">by {storeName}</div>
                        <div className="text-muted-foreground text-xs mt-0.5">Placed: {order.createdAt ? (typeof order.createdAt === 'string' ? new Date(order.createdAt).toLocaleDateString() : order.createdAt?.toLocaleDateString?.()) : 'date unknown'}</div>
                      </div>
                    </div>
                  {/* Stepper */}
                  <div className="mb-6 relative">
                    {/* Vertical line behind all steps */}
                    <span className="absolute left-2.5 top-2 w-px h-[calc(100%-1.5rem)] bg-accent/20 z-0"></span>
                    {[
                      { label: 'ORDER PLACED', date: order.createdAt, desc: '', badge: 'ORDER PLACED' },
                      { label: 'PENDING CONFIRMATION', date: order.createdAt, desc: 'We are in the process of confirming your order. You will receive an SMS / Call shortly.', badge: 'PENDING CONFIRMATION' },
                      { label: 'SHIPPED', date: order.shippedAt, desc: '', badge: 'SHIPPED' },
                      { label: 'DELIVERED', date: order.deliveredAt, desc: '', badge: 'DELIVERED' },
                      { label: 'RECEIVED', date: (order as any).receivedAt, desc: '', badge: 'RECEIVED' },
                    ].map((step, sidx, arr) => {
                      const isActive = (() => {
                        if (step.label === 'ORDER PLACED') return true;
                        if (step.label === 'PENDING CONFIRMATION') return ['pending', 'pending_payment', 'confirmed', 'processing', 'shipped', 'shipped_interstate', 'out_for_delivery', 'delivered', 'received'].includes(order.status);
                        if (step.label === 'SHIPPED') return ['shipped', 'shipped_interstate', 'out_for_delivery', 'delivered', 'received'].includes(order.status);
                        if (step.label === 'DELIVERED') return ['delivered', 'received'].includes(order.status);
                        if (step.label === 'RECEIVED') return order.status === 'received';
                        return false;
                      })();
                      const isCurrent = (() => {
                        if (step.label === 'ORDER PLACED') return order.status === 'pending' || order.status === 'pending_payment';
                        if (step.label === 'PENDING CONFIRMATION') return ['confirmed', 'processing'].includes(order.status);
                        if (step.label === 'SHIPPED') return ['shipped', 'shipped_interstate', 'out_for_delivery'].includes(order.status);
                        if (step.label === 'DELIVERED') return order.status === 'delivered';
                        if (step.label === 'RECEIVED') return order.status === 'received';
                        return false;
                      })();
                      return (
                        <div key={step.label} className="mb-8 last:mb-0 flex items-start relative z-10">
                          <div className="relative flex flex-col items-center mr-4" style={{ minWidth: 20 }}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center border-2 z-10 text-xs font-bold ${isActive ? 'bg-accent text-white border-accent shadow' : 'bg-white text-accent border-accent/40'} ${isCurrent ? 'ring-2 ring-accent/40' : ''}`}>{isActive ? <>&#10003;</> : ''}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide mb-1 ${isActive ? 'bg-accent/90 text-white' : 'bg-muted text-muted-foreground border border-muted-foreground/20'}`}>{step.badge}</span>
                            <div className="text-xs text-muted-foreground">{step.date ? (typeof step.date === 'string' ? new Date(step.date).toLocaleDateString() : step.date?.toLocaleDateString?.()) : ''}</div>
                            {step.desc && <div className="text-xs text-muted-foreground max-w-xs">{step.desc}</div>}
                            {step.label === 'DELIVERED' && order.deliveredAt && (
                              <div className="text-xs text-accent mt-1">Delivered on {typeof order.deliveredAt === 'string' ? new Date(order.deliveredAt).toLocaleDateString() : order.deliveredAt?.toLocaleDateString?.()}</div>
                            )}
                            {step.label === 'RECEIVED' && (order as any).receivedAt && (
                              <div className="text-xs text-green-600 mt-1">Received on {typeof (order as any).receivedAt === 'string' ? new Date((order as any).receivedAt).toLocaleDateString() : (order as any).receivedAt?.toLocaleDateString?.()}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between items-center mt-6">
                    <div>
                      <div className="font-semibold">Total:</div>
                      <div className="text-lg font-bold text-accent">₦{formatCurrency(order.totalAmount)}</div>
                    </div>
                    <div>
                      <Badge variant={order.status === "delivered" ? "default" : order.status === "shipped" ? "secondary" : order.status === "cancelled" ? "destructive" : "outline"}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                  {/* Customer Acknowledgment */}
                  {(order.status === 'delivered') && (
                    <div className="mt-4 flex justify-end">
                      <Button
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/orders', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ orderId: order._parentOrderId || order.orderId || order.id, status: 'received' })
                            })
                            const json = await res.json()
                            if (json?.success) {
                              const targetId = order._parentOrderId || order.orderId || order.id
                              const now = new Date().toISOString()
                              setOrders(prev => prev.map(o => {
                                const oid = o.orderId || o.id
                                if (oid === targetId) return { ...o, status: 'received', receivedAt: now }
                                return o
                              }))
                              success('Thanks! Marked as received')
                            } else {
                              notifyError(json?.error || 'Failed to acknowledge receipt')
                            }
                          } catch (e: any) {
                            notifyError(e?.message || 'Failed to acknowledge receipt')
                          }
                        }}
                      >
                        I have received this
                      </Button>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          )}
        </section>
      </main>
    </React.Fragment>
  );
}
