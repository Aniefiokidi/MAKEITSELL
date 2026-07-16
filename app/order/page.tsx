"use client"
import React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import { useAuth } from "@/contexts/AuthContext"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Header from "@/components/Header"
import Link from "next/link"
import { useNotification } from "@/contexts/NotificationContext"
import { Package, Truck, CheckCircle2, Clock, ShieldCheck, MapPin } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pending_payment: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  shipped_interstate: 'bg-indigo-100 text-indigo-800',
  out_for_delivery: 'bg-cyan-100 text-cyan-800',
  delivered: 'bg-green-100 text-green-800',
  received: 'bg-green-200 text-green-900',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-200 text-green-900',
}

const PAYMENT_BADGE: Record<string, { label: string; cls: string }> = {
  escrow: { label: '🔒 Secured in Escrow', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  paid: { label: '✓ Paid', cls: 'bg-green-50 text-green-700 border border-green-200' },
  completed: { label: '✓ Paid', cls: 'bg-green-50 text-green-700 border border-green-200' },
  refunded: { label: '↩ Refunded', cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
  pending: { label: '⏳ Payment Pending', cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
}

function addBusinessDays(date: Date, days: number) {
  const d = new Date(date)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function CustomerOrdersPage() {
  const { user } = useAuth()
  const { success, error: notifyError } = useNotification()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [productDetails, setProductDetails] = useState<Record<string, any>>({})
  const [storeNames, setStoreNames] = useState<{ [vendorId: string]: string }>({})
  const [storeStates, setStoreStates] = useState<{ [vendorId: string]: string }>({})
  const [reviewingKey, setReviewingKey] = useState<string | null>(null)
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({})
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({})
  const [reviewSubmitting, setReviewSubmitting] = useState<string | null>(null)
  const [reviewedKeys, setReviewedKeys] = useState<Set<string>>(new Set())
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'ongoing' | 'completed' | 'cancelled'>('ongoing')
  const [trackingByRowId, setTrackingByRowId] = useState<Record<string, { trackingToken: string; status: string }>>({})

  const formatCurrency = (amount: number) => amount.toLocaleString('en-NG')

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      setLoading(true)
      try {
        const ordersResponse = await fetch(`/api/orders?customerId=${user.uid}`)
        const ordersResult = await ordersResponse.json()
        setOrders(Array.isArray(ordersResult) ? ordersResult : [])

        const rowIds = new Set<string>();
        (Array.isArray(ordersResult) ? ordersResult : []).forEach((order: any) => {
          const orderId = order.orderId || order.id
          if (Array.isArray(order.vendors)) {
            order.vendors.forEach((vendor: any) => {
              rowIds.add(`${orderId}:${vendor.vendorId || ''}`)
            })
          } else if (orderId) {
            rowIds.add(`${orderId}:${order.storeId || ''}`)
          }
        })
        if (rowIds.size > 0) {
          fetch(`/api/riders/tracking-lookup?rowIds=${Array.from(rowIds).map(encodeURIComponent).join(',')}`, {
            credentials: 'include',
          })
            .then((res) => res.json())
            .then((json) => {
              if (json?.success) setTrackingByRowId(json.tracking || {})
            })
            .catch(() => {})
        }

        const productIds = new Set<string>()
        const vendorIds = new Set<string>();
        (Array.isArray(ordersResult) ? ordersResult : []).forEach((order: any) => {
          if (Array.isArray(order.vendors)) {
            order.vendors.forEach((vendor: any) => {
              if (vendor.vendorId) vendorIds.add(vendor.vendorId)
              if (Array.isArray(vendor.items)) {
                vendor.items.forEach((prod: any) => { if (prod.productId) productIds.add(prod.productId) })
              }
            })
          } else {
            order.products?.forEach((prod: any) => { if (prod.productId) productIds.add(prod.productId) })
            if (order.storeId) vendorIds.add(order.storeId)
          }
        })

        const productDetailsObj: Record<string, any> = {}
        await Promise.all(Array.from(productIds).map(async (pid) => {
          try {
            const res = await fetch(`/api/database/products/${pid}`)
            if (res.ok) {
              const json = await res.json()
              if (json.success && json.data) productDetailsObj[pid] = json.data
            }
          } catch {}
        }))
        setProductDetails(productDetailsObj)

        const storeNamesObj: { [vendorId: string]: string } = {}
        const storeStatesObj: { [vendorId: string]: string } = {}
        await Promise.all(Array.from(vendorIds).map(async (vendorId) => {
          try {
            const res = await fetch(`/api/database/stores?vendorId=${vendorId}`)
            const json = await res.json()
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
              storeNamesObj[vendorId] = json.data[0].storeName || json.data[0].name || 'Store'
              storeStatesObj[vendorId] = json.data[0].state || ''
            } else {
              storeNamesObj[vendorId] = 'Store'
            }
          } catch {
            storeNamesObj[vendorId] = 'Store'
          }
        }))
        setStoreNames(storeNamesObj)
        setStoreStates(storeStatesObj)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  const allFlattenedOrders = orders.flatMap(order => {
    if (Array.isArray(order.vendors) && order.vendors.length > 0) {
      return order.vendors.flatMap((vendor: any) =>
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
      )
    } else if (Array.isArray(order.products) && order.products.length > 0) {
      return order.products.map((prod: any) => ({
        ...order,
        _parentOrderId: order.orderId || order.id,
        product: prod,
        storeId: order.storeId,
        storeName: order.storeName,
      }))
    }
    return [{ ...order, _parentOrderId: order.orderId || order.id }]
  })

  const getTabBucket = (status: string) => {
    const s = String(status || '').toLowerCase()
    if (s === 'cancelled' || s === 'refunded') return 'cancelled'
    if (['delivered', 'received', 'completed'].includes(s)) return 'completed'
    return 'ongoing'
  }

  const flattenedOrders = allFlattenedOrders.filter(o => getTabBucket(o.status) === tab)

  const tabCounts = {
    ongoing: allFlattenedOrders.filter(o => getTabBucket(o.status) === 'ongoing').length,
    completed: allFlattenedOrders.filter(o => getTabBucket(o.status) === 'completed').length,
    cancelled: allFlattenedOrders.filter(o => getTabBucket(o.status) === 'cancelled').length,
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-accent/5 to-background flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-6xl mx-auto mt-10 mb-16 px-4 md:px-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">My Orders</h1>
            <p className="text-muted-foreground mt-1 text-sm">Track and manage your purchases</p>
          </div>

          {/* Tab Bar */}
          {!loading && allFlattenedOrders.length > 0 && (
            <div className="mb-8 flex gap-1 bg-muted/60 rounded-xl p-1 w-full max-w-md mx-auto shadow-sm">
              {(['ongoing', 'completed', 'cancelled'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg capitalize transition-all ${
                    tab === t
                      ? 'bg-card shadow-md text-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t}
                  <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-accent/10 text-accent' : 'opacity-60'}`}>
                    {tabCounts[t]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-24">
              <div className="flex flex-col items-center gap-3">
                <span className="animate-spin rounded-full h-10 w-10 border-[3px] border-accent border-t-transparent"></span>
                <span className="text-sm text-muted-foreground">Loading your orders…</span>
              </div>
            </div>
          ) : allFlattenedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <Package className="h-10 w-10 text-accent" />
              </div>
              <h2 className="text-2xl font-bold mb-2">No Orders Yet</h2>
              <p className="text-muted-foreground mb-6 text-center max-w-xs">You haven't placed any orders yet. Start shopping now!</p>
              <Button asChild size="lg" className="bg-accent text-white font-bold px-8 rounded-full shadow hover:bg-accent/80 transition-all">
                <a href="/stores">Browse Stores</a>
              </Button>
            </div>
          ) : flattenedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold mb-2">No {tab} orders</h2>
              <Button size="lg" onClick={() => setTab('ongoing')} variant="outline" className="mt-2">
                View Ongoing Orders
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {flattenedOrders.map((order, idx) => {
                const prod = order.product
                const prodDetail = prod?.productId ? productDetails[prod.productId] : null
                const productName = prodDetail?.title || prod?.title || prodDetail?.name || prod?.name || 'Product'
                const productImage =
                  prodDetail?.image || prodDetail?.imageUrl || prodDetail?.images?.[0] ||
                  prod?.image || prod?.imageUrl || prod?.images?.[0] || '/images/placeholder-product.svg'

                const vendorId = order.vendor?.vendorId || order.storeId
                const storeName = (vendorId && storeNames[vendorId]) || order.vendor?.vendorName || order.storeName || 'Store'

                // Delivery estimate: compare store state vs shipping state
                const orderState = String(order.shippingInfo?.state || order.shippingAddress?.state || '').trim().toLowerCase()
                const vendorState = String((vendorId && storeStates[vendorId]) || '').trim().toLowerCase()
                const isSameState = orderState && vendorState && orderState === vendorState
                const deliveryDaysMin = isSameState ? 1 : 3
                const deliveryDaysMax = isSameState ? 2 : 5
                const deliveryLabel = `${deliveryDaysMin}–${deliveryDaysMax} business days`

                // Estimated delivery window from order date
                const orderDate = order.createdAt ? new Date(order.createdAt) : null
                const estDeliveryFrom = orderDate ? addBusinessDays(orderDate, deliveryDaysMin) : null
                const estDeliveryTo = orderDate ? addBusinessDays(orderDate, deliveryDaysMax) : null
                const estDeliveryStr = estDeliveryFrom && estDeliveryTo
                  ? `${formatDate(estDeliveryFrom)} – ${formatDate(estDeliveryTo)}`
                  : null

                const productSubtotal = Number.isFinite(Number(order?.vendor?.total))
                  ? Number(order.vendor.total)
                  : (Array.isArray(order.vendors) && order.vendors.length > 0
                    ? Number(order.vendors.reduce((sum: number, v: any) => sum + Number(v?.total || 0), 0))
                    : Number(order.product?.price || 0) * Number(order.product?.quantity || 1))
                const grossTotal = Number.isFinite(Number(order?.totalAmount)) ? Number(order.totalAmount) : productSubtotal
                const deliveryFee = Number.isFinite(Number(order?.deliveryFee))
                  ? Number(order.deliveryFee)
                  : Math.max(0, grossTotal - productSubtotal)
                const displayTotal = productSubtotal + deliveryFee

                const paymentBadge = PAYMENT_BADGE[order.paymentStatus] || null
                const statusColor = STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'

                const isCancelled = ['cancelled', 'refunded'].includes(order.status)
                const stages = isCancelled ? [
                  { key: 'pending', label: 'Order Placed', dateField: 'createdAt' },
                  { key: 'cancelled', label: order.status === 'refunded' ? 'Refunded' : 'Cancelled', dateField: 'cancelledAt' },
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
                const currentIdx = statusOrder.indexOf(order.status)

                return (
                  <div
                    key={`${order._parentOrderId}-${order.storeId || idx}-${prod?.productId || idx}`}
                    className="bg-card rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Card Header */}
                    <div className="p-4 border-b border-border/60 flex items-start gap-3">
                      <div className="relative h-14 w-14 rounded-xl overflow-hidden bg-muted shrink-0">
                        <Image
                          src={productImage} alt={productName} fill sizes="56px" className="object-cover"
                          onError={e => { (e.target as HTMLImageElement).src = '/images/placeholder-product.svg' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm leading-tight">Order #{order._parentOrderId?.substring(0, 8).toUpperCase()}</p>
                            <p className="text-sm font-semibold leading-tight mt-0.5 truncate">{productName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">by {storeName}</p>
                          </div>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}>
                            {order.status?.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Delivery estimate — only for active orders */}
                        {!isCancelled && !['delivered','received','completed'].includes(order.status) && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                            <Truck className="h-3.5 w-3.5 shrink-0" />
                            <span>Delivered within {deliveryLabel}</span>
                          </div>
                        )}
                        {!isCancelled && !['delivered','received','completed'].includes(order.status) && estDeliveryStr && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">Est. {estDeliveryStr}</p>
                        )}

                        <p className="text-[11px] text-muted-foreground mt-1">
                          Placed: {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Payment badge */}
                    {paymentBadge && (
                      <div className={`mx-4 mt-3 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${paymentBadge.cls}`}>
                        {order.paymentStatus === 'escrow' && <ShieldCheck className="h-3.5 w-3.5 shrink-0" />}
                        {paymentBadge.label}
                        {order.paymentStatus === 'escrow' && (
                          <span className="ml-auto opacity-70">Held securely</span>
                        )}
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="px-4 pt-4 pb-2">
                      <div className="relative flex flex-col">
                        {stages.map((stage, si) => {
                          const stageIdx = statusOrder.indexOf(stage.key)
                          const isPast = isCancelled ? stage.key === 'pending' : stageIdx < currentIdx
                          const isCurrent = stage.key === order.status || (stage.key === 'shipped' && order.status === 'shipped_interstate')
                          const stageDate = (order as any)[stage.dateField] || (stage.dateField === 'createdAt' ? order.createdAt : null)
                          const formattedDate = stageDate
                            ? new Date(stageDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
                            : null
                          return (
                            <div key={stage.key} className="flex items-start gap-3 relative">
                              {si < stages.length - 1 && (
                                <div
                                  className={`absolute left-[11px] top-5 w-0.5 ${isPast || isCurrent ? 'bg-accent' : 'bg-border'}`}
                                  style={{ height: 'calc(100% + 2px)' }}
                                />
                              )}
                              <div className={`relative z-10 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                isCancelled && stage.key !== 'pending' ? 'bg-destructive' :
                                isCurrent ? 'bg-accent ring-2 ring-accent/30' :
                                isPast ? 'bg-accent' : 'bg-border'
                              }`}>
                                {(isPast || isCurrent) && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                  </svg>
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

                    {/* Price Summary */}
                    <div className="mx-4 mb-4 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Product Subtotal</span>
                        <span className="font-medium text-foreground">₦{formatCurrency(productSubtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <span>Delivery Fee</span>
                        <span className="font-medium text-foreground">{deliveryFee > 0 ? `₦${formatCurrency(deliveryFee)}` : 'FREE'}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                        <span className="font-semibold text-sm">Total</span>
                        <span className="text-base font-bold text-accent">₦{formatCurrency(displayTotal)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-4 space-y-2">
                      {/* Track delivery */}
                      {(() => {
                        const rowVendorId = order.vendor?.vendorId || order.storeId || ''
                        const rowId = `${order._parentOrderId}:${rowVendorId}`
                        const tracking = trackingByRowId[rowId]
                        if (!tracking || !['assigned', 'picked_up', 'en_route', 'arrived'].includes(tracking.status)) return null
                        return (
                          <Link href={`/track/${tracking.trackingToken}`}>
                            <Button size="sm" variant="outline" className="w-full flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" /> Track Your Delivery Live
                            </Button>
                          </Link>
                        )
                      })()}
                      {/* Cancel */}
                      {!['out_for_delivery','delivered','received','cancelled','refunded','completed'].includes(order.status) && (
                        confirmCancelId === (order._parentOrderId || order.orderId || order.id) ? (
                          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                            <p className="text-xs font-semibold text-destructive">Cancel this order?</p>
                            <p className="text-xs text-muted-foreground">
                              {['escrow','completed','paid'].includes(order.paymentStatus)
                                ? `₦${formatCurrency(Number(order.totalAmount || 0))} will be refunded to your wallet.`
                                : 'This action cannot be undone.'}
                            </p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="destructive" disabled={cancellingId === (order._parentOrderId || order.orderId || order.id)}
                                onClick={async () => {
                                  const oid = order._parentOrderId || order.orderId || order.id
                                  setCancellingId(oid)
                                  try {
                                    const res = await fetch('/api/orders/cancel', {
                                      method: 'POST', credentials: 'include',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ orderId: oid }),
                                    })
                                    const json = await res.json()
                                    if (json.success) {
                                      setOrders(prev => prev.map(o =>
                                        (o.orderId || o.id) === oid ? { ...o, status: 'cancelled', cancelledAt: new Date().toISOString() } : o
                                      ))
                                      success('Order cancelled', json.message)
                                    } else {
                                      notifyError(json.error || 'Failed to cancel order')
                                    }
                                  } catch (e: any) {
                                    notifyError(e?.message || 'Failed to cancel order')
                                  } finally {
                                    setCancellingId(null)
                                    setConfirmCancelId(null)
                                  }
                                }}>
                                {cancellingId === (order._parentOrderId || order.orderId || order.id) ? 'Cancelling…' : 'Yes, Cancel'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmCancelId(null)}>Keep Order</Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
                            onClick={() => setConfirmCancelId(order._parentOrderId || order.orderId || order.id)}>
                            Cancel Order
                          </Button>
                        )
                      )}

                      {/* Confirm receipt */}
                      {order.status === 'delivered' && (
                        <Button className="w-full bg-green-600 text-white hover:bg-green-700"
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
                                setOrders(prev => prev.map(o =>
                                  (o.orderId || o.id) === targetId ? { ...o, status: 'received', receivedAt: new Date().toISOString() } : o
                                ))
                                success('Thanks! Marked as received')
                              } else {
                                notifyError(json?.error || 'Failed to acknowledge receipt')
                              }
                            } catch (e: any) {
                              notifyError(e?.message || 'Failed to acknowledge receipt')
                            }
                          }}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          I have received this
                        </Button>
                      )}

                      {/* Rate store */}
                      {order.status === 'received' && (() => {
                        const rKey = `${order._parentOrderId || order.orderId || order.id}-${order.storeId || idx}`
                        const isOpen = reviewingKey === rKey
                        const isReviewed = reviewedKeys.has(rKey)
                        if (isReviewed) return (
                          <p className="text-xs text-green-600 font-medium text-center py-1">✓ Review submitted</p>
                        )
                        return isOpen ? (
                          <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-2">
                            <p className="text-xs font-semibold">Rate your experience with {storeName}</p>
                            <div className="flex gap-1">
                              {[1,2,3,4,5].map(n => (
                                <button key={n} type="button" onClick={() => setReviewRatings(p => ({ ...p, [rKey]: n }))}>
                                  <svg className={`w-6 h-6 ${n <= (reviewRatings[rKey] ?? 5) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 fill-gray-200'}`} viewBox="0 0 24 24">
                                    <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                                  </svg>
                                </button>
                              ))}
                            </div>
                            <textarea
                              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-accent"
                              rows={2} placeholder="Share your experience (optional)…"
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
                                      method: 'POST', credentials: 'include',
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
                        ) : (
                          <Button size="sm" variant="outline" className="w-full border-accent/40 text-accent hover:bg-accent hover:text-white"
                            onClick={() => setReviewingKey(rKey)}>
                            ⭐ Rate this store
                          </Button>
                        )
                      })()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
    </div>
  )
}
