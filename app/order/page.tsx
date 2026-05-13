"use client"
import React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import { useAuth } from "@/contexts/AuthContext"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Header from "@/components/Header"
import { useNotification } from "@/contexts/NotificationContext"

export default function CustomerOrdersPage() {
  const { user } = useAuth()
  const { success, error: notifyError } = useNotification()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [productDetails, setProductDetails] = useState<Record<string, any>>({})
  const [storeNames, setStoreNames] = useState<{ [vendorId: string]: string }>({})
  const [storeFulfillment, setStoreFulfillment] = useState<{ [vendorId: string]: string }>({})
  const [reviewingKey, setReviewingKey] = useState<string | null>(null)
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({})
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({})
  const [reviewSubmitting, setReviewSubmitting] = useState<string | null>(null)
  const [reviewedKeys, setReviewedKeys] = useState<Set<string>>(new Set())

  const [tab, setTab] = useState<'ongoing' | 'completed' | 'cancelled'>('ongoing')
  // Format currency with commas
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-NG')
  }

  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        setLoading(true)
        try {
          const ordersResponse = await fetch(`/api/orders?customerId=${user.uid}`)
          const ordersResult = await ordersResponse.json()
          setOrders(Array.isArray(ordersResult) ? ordersResult : [])

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
          const storeFulfillmentObj: { [vendorId: string]: string } = {}
          await Promise.all(Array.from(vendorIds).map(async (vendorId) => {
            try {
              const res = await fetch(`/api/database/stores?vendorId=${vendorId}`)
              const json = await res.json()
              if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                storeNamesObj[vendorId] = json.data[0].storeName || json.data[0].name || 'Store'
                storeFulfillmentObj[vendorId] = json.data[0].fulfillmentTime || ''
              } else {
                storeNamesObj[vendorId] = 'Store'
              }
            } catch {
              storeNamesObj[vendorId] = 'Store'
            }
          }))
          setStoreNames(storeNamesObj)
          setStoreFulfillment(storeFulfillmentObj)
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
  // Flatten orders so each product is its own card, even if from the same vendor
  const allFlattenedOrders = orders.flatMap(order => {
    if (Array.isArray(order.vendors) && order.vendors.length > 0) {
      return order.vendors.flatMap((vendor: any) => (
        Array.isArray(vendor.items) && vendor.items.length > 0
          ? vendor.items.map((prod: any) => ({
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
      return order.products.map((prod: any) => ({
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

  const getTabBucket = (status: string) => {
    const s = String(status || '').toLowerCase()
    if (s === 'cancelled') return 'cancelled'
    if (['delivered', 'received'].includes(s)) return 'completed'
    return 'ongoing'
  }

  const flattenedOrders = allFlattenedOrders.filter(o => getTabBucket(o.status) === tab)

  return (
    <React.Fragment>
      <main className="min-h-screen bg-linear-to-b from-background via-accent/10 to-background flex flex-col font-sans">
        <Header />
        <section className="flex-1 w-full max-w-7xl mx-auto mt-10 mb-16 px-2 md:px-0">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-center mb-8">Package History</h1>
          
          {/* Tab Toggle */}
          {!loading && allFlattenedOrders.length > 0 && (
            <div className="mb-6 flex gap-2 bg-muted/50 rounded-xl p-1 w-full max-w-sm mx-auto">
              {(['ongoing', 'completed', 'cancelled'] as const).map(t => {
                const count = allFlattenedOrders.filter(o => getTabBucket(o.status) === t).length
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg capitalize transition-all ${
                      tab === t
                        ? 'bg-white shadow text-accent'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t} <span className="text-xs opacity-70">({count})</span>
                  </button>
                )
              })}
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
              <Button size="lg" onClick={() => setTab('ongoing')} className="bg-accent text-white font-bold px-8 py-4 rounded-full shadow-lg hover:bg-accent/80 transition-all">
                View Ongoing Orders
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
                        {storeFulfillment[vendorId] && (
                          <div className="text-xs mt-0.5 text-orange-600 font-medium">
                            ⏱ Ready in: {storeFulfillment[vendorId] === 'same_day' ? 'Same Day' : storeFulfillment[vendorId] === '24_hours' ? '24 Hours' : storeFulfillment[vendorId] === '48_hours' ? '48 Hours' : '1 Week'}
                          </div>
                        )}
                        <div className="text-muted-foreground text-xs mt-0.5">Placed: {order.createdAt ? (typeof order.createdAt === 'string' ? new Date(order.createdAt).toLocaleDateString() : order.createdAt?.toLocaleDateString?.()) : 'date unknown'}</div>
                      </div>
                    </div>
                  {/* Order Timeline */}
                  {(() => {
                    const status = order.status || 'pending'
                    const isCancelled = status === 'cancelled'
                    const stages = isCancelled ? [
                      { key: 'pending', label: 'Placed', dateField: 'createdAt' },
                      { key: 'cancelled', label: 'Cancelled', dateField: 'cancelledAt' },
                    ] : [
                      { key: 'pending', label: 'Order Placed', dateField: 'createdAt' },
                      { key: 'confirmed', label: 'Confirmed', dateField: 'confirmedAt' },
                      { key: 'processing', label: 'Processing', dateField: 'processingAt' },
                      { key: 'shipped', label: 'Shipped', dateField: 'shippedAt' },
                      { key: 'out_for_delivery', label: 'Out for Delivery', dateField: 'outForDeliveryAt' },
                      { key: 'delivered', label: 'Delivered', dateField: 'deliveredAt' },
                      { key: 'received', label: 'Received', dateField: 'receivedAt' },
                    ]
                    const statusOrder = ['pending','pending_payment','confirmed','processing','shipped','shipped_interstate','out_for_delivery','delivered','received']
                    const currentIdx = statusOrder.indexOf(status)
                    return (
                      <div className="mb-4 px-1 pt-1">
                        <div className="relative flex flex-col">
                          {stages.map((stage, si) => {
                            const stageIdx = statusOrder.indexOf(stage.key)
                            const isPast = isCancelled ? (stage.key === 'pending') : stageIdx < currentIdx
                            const isCurrent = stage.key === status || (stage.key === 'shipped' && status === 'shipped_interstate')
                            const stageDate = (order as any)[stage.dateField] || (stage.dateField === 'createdAt' ? order.createdAt : null)
                            const formattedDate = stageDate ? new Date(stageDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : null
                            return (
                              <div key={stage.key} className="flex items-start gap-3 relative">
                                {si < stages.length - 1 && (
                                  <div className={`absolute left-[11px] top-5 w-0.5 ${isPast || isCurrent ? 'bg-accent' : 'bg-border'}`} style={{ height: 'calc(100% + 2px)' }} />
                                )}
                                <div className={`relative z-10 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                  isCancelled && stage.key === 'cancelled' ? 'bg-destructive' :
                                  isCurrent ? 'bg-accent ring-2 ring-accent/30' :
                                  isPast ? 'bg-accent' : 'bg-border'
                                }`}>
                                  {(isPast || isCurrent) && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                  )}
                                </div>
                                <div className={`pb-4 text-xs ${isCurrent ? 'font-bold text-accent' : isPast ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  <span>{stage.label}</span>
                                  {formattedDate && <span className="block text-[10px] text-muted-foreground font-normal">{formattedDate}</span>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
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
                  {order.status === 'delivered' && (
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

                  {/* Rate this store — shown after order is received */}
                  {order.status === 'received' && (() => {
                    const rKey = `${order._parentOrderId || order.orderId || order.id}-${order.storeId || idx}`
                    const isOpen = reviewingKey === rKey
                    const isReviewed = reviewedKeys.has(rKey)
                    if (isReviewed) return (
                      <p className="mt-3 text-xs text-green-600 font-medium text-right">✓ Review submitted</p>
                    )
                    return (
                      <div className="mt-3">
                        {!isOpen ? (
                          <div className="flex justify-end">
                            <Button size="sm" variant="outline" className="border-accent text-accent hover:bg-accent hover:text-white"
                              onClick={() => setReviewingKey(rKey)}>
                              ⭐ Rate this store
                            </Button>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
                            <p className="text-xs font-semibold">Rate your experience with {storeName}</p>
                            <div className="flex gap-1">
                              {[1,2,3,4,5].map(n => (
                                <button key={n} type="button"
                                  onClick={() => setReviewRatings(p => ({ ...p, [rKey]: n }))}>
                                  <svg className={`w-6 h-6 ${n <= (reviewRatings[rKey] ?? 5) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 fill-gray-200'}`} viewBox="0 0 24 24">
                                    <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                                  </svg>
                                </button>
                              ))}
                            </div>
                            <textarea
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-accent"
                              rows={2}
                              placeholder="Share your experience (optional)…"
                              value={reviewComments[rKey] ?? ''}
                              onChange={e => setReviewComments(p => ({ ...p, [rKey]: e.target.value }))}
                            />
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => setReviewingKey(null)}>Cancel</Button>
                              <Button size="sm" disabled={reviewSubmitting === rKey}
                                onClick={async () => {
                                  const storeId = order.storeId || order.vendor?.vendorId
                                  const orderId = order._parentOrderId || order.orderId || order.id
                                  if (!storeId || !orderId) return
                                  setReviewSubmitting(rKey)
                                  try {
                                    const res = await fetch(`/api/store/${storeId}/reviews`, {
                                      method: 'POST',
                                      credentials: 'include',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ orderId, rating: reviewRatings[rKey] ?? 5, comment: reviewComments[rKey] ?? '' }),
                                    })
                                    const data = await res.json()
                                    if (data.success) {
                                      setReviewedKeys(p => new Set([...p, rKey]))
                                      setReviewingKey(null)
                                      success('Review submitted!', 'Thank you for your feedback.')
                                    } else {
                                      notifyError('Could not submit', data.error || 'Please try again')
                                    }
                                  } catch { notifyError('Error', 'Failed to submit review') }
                                  setReviewSubmitting(null)
                                }}>
                                {reviewSubmitting === rKey ? 'Submitting…' : 'Submit'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
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
