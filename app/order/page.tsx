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
  const [completionFilter, setCompletionFilter] = useState<'confirmed' | 'non_confirmed'>('non_confirmed')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [stagePreviewByOrder, setStagePreviewByOrder] = useState<Record<string, string>>({})

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

  const isConfirmedBucket = (status: string) => {
    return ['confirmed', 'processing', 'shipped', 'shipped_interstate', 'out_for_delivery', 'delivered', 'received'].includes(String(status || '').toLowerCase())
  }

  // Apply filters
  const flattenedOrders = allFlattenedOrders.filter(order => {
    // Confirmed vs non-confirmed toggle
    if (completionFilter === 'confirmed') {
      if (!isConfirmedBucket(order.status)) return false
    } else if (completionFilter === 'non_confirmed') {
      if (isConfirmedBucket(order.status)) return false
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
                  <label className="block text-sm font-semibold mb-2">Order Group</label>
                  <div className="flex gap-2">
                    <Button
                      variant={completionFilter === 'confirmed' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCompletionFilter('confirmed')}
                      className="flex-1"
                    >
                      Confirmed ({allFlattenedOrders.filter(o => isConfirmedBucket(o.status)).length})
                    </Button>
                    <Button
                      variant={completionFilter === 'non_confirmed' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCompletionFilter('non_confirmed')}
                      className="flex-1"
                    >
                      Non Confirmed ({allFlattenedOrders.filter(o => !isConfirmedBucket(o.status)).length})
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
              <Button size="lg" onClick={() => { setCompletionFilter('non_confirmed'); setStatusFilter('all'); }} className="bg-accent text-white font-bold px-8 py-4 rounded-full shadow-lg hover:bg-accent/80 transition-all">
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
                const productSubtotal = Number.isFinite(Number(order?.vendor?.total))
                  ? Number(order.vendor.total)
                  : (Array.isArray(order.vendors) && order.vendors.length > 0
                    ? Number(order.vendors.reduce((sum: number, v: any) => sum + Number(v?.total || 0), 0))
                    : Number(order.product?.price || 0) * Number(order.product?.quantity || 1))
                const grossTotal = Number.isFinite(Number(order?.totalAmount)) ? Number(order.totalAmount) : productSubtotal
                const deliveryFee = Number.isFinite(Number(order?.deliveryFee))
                  ? Number(order.deliveryFee)
                  : (Array.isArray(order?.vendors) && order.vendors.length > 1
                    ? 0
                    : Math.max(0, grossTotal - productSubtotal))
                const displayTotal = productSubtotal + deliveryFee
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
                  <div className="mb-6 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
                    {(() => {
                      const orderKey = `${order._parentOrderId || order.orderId || order.id}-${idx}`
                      const stageOptions = [
                        { value: 'pending', label: 'Pending', dateKey: 'createdAt', desc: 'Awaiting vendor review.' },
                        { value: 'pending_payment', label: 'Pending Payment', dateKey: 'pendingPaymentAt', desc: 'Awaiting payment confirmation.' },
                        { value: 'confirmed', label: 'Confirmed', dateKey: 'confirmedAt', desc: 'Order confirmed by vendor.' },
                        { value: 'processing', label: 'Processing', dateKey: 'processingAt', desc: 'Order is being processed.' },
                        { value: 'shipped', label: 'Shipped', dateKey: 'shippedAt', desc: '' },
                        { value: 'shipped_interstate', label: 'Shipped (Interstate)', dateKey: 'shippedInterstateAt', desc: '' },
                        { value: 'out_for_delivery', label: 'Out for Delivery', dateKey: 'outForDeliveryAt', desc: '' },
                        { value: 'delivered', label: 'Delivered', dateKey: 'deliveredAt', desc: '' },
                        { value: 'received', label: 'Received', dateKey: 'receivedAt', desc: '' },
                        { value: 'cancelled', label: 'Cancelled', dateKey: 'cancelledAt', desc: 'Order was cancelled.' },
                      ]
                      const selectedStage = stagePreviewByOrder[orderKey] || order.status || 'pending'
                      const selectedStageData = stageOptions.find((option) => option.value === selectedStage) || stageOptions[0]
                      const stageDate = order[selectedStageData.dateKey] || (selectedStageData.dateKey === 'createdAt' ? order.createdAt : undefined)

                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-semibold text-muted-foreground">Stage</label>
                            <select
                              value={selectedStage}
                              onChange={(e) => setStagePreviewByOrder((prev) => ({ ...prev, [orderKey]: e.target.value }))}
                              className="w-40 px-2 py-1 text-xs border border-border rounded-md bg-background text-foreground"
                            >
                              {stageOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{selectedStageData.label}</Badge>
                            {stageDate && (
                              <span className="text-xs text-muted-foreground">
                                {typeof stageDate === 'string' ? new Date(stageDate).toLocaleDateString() : stageDate?.toLocaleDateString?.()}
                              </span>
                            )}
                          </div>
                          {selectedStageData.desc && (
                            <p className="text-xs text-muted-foreground">{selectedStageData.desc}</p>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                  <div className="mt-6 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Product Subtotal:</span>
                      <span className="font-semibold">₦{formatCurrency(productSubtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-muted-foreground">Delivery Fee:</span>
                      <span className="font-semibold">{deliveryFee > 0 ? `₦${formatCurrency(deliveryFee)}` : 'FREE'}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/60">
                      <span className="font-semibold">Total:</span>
                      <span className="text-lg font-bold text-accent">₦{formatCurrency(displayTotal)}</span>
                    </div>
                  </div>
                  <div className="flex justify-end items-center mt-3">
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
