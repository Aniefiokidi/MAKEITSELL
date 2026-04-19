"use client"

import React, { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
// Utility for delaying navigation
function useFlyNavigate() {
  const [fly, setFly] = useState(false);
  const timeoutRef = useRef<any>(null);
  const trigger = (cb: () => void) => {
    setFly(true);
    timeoutRef.current = setTimeout(() => {
      cb();
      setFly(false);
    }, 600); // match animation duration
  };
  useEffect(() => () => clearTimeout(timeoutRef.current), []);
  return [fly, trigger] as const;
}
import { ProductQuickView } from "@/components/ui/product-quick-view"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"
import { useCart } from "@/contexts/CartContext"
import { useNotification } from "@/contexts/NotificationContext"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Header from "@/components/Header"
import HeroShuffleCarousel from "@/components/HeroShuffleCarousel"
import Footer from "@/components/Footer"
import { Shield, Users, Truck, Sparkles, ArrowRight, Smartphone, ShoppingBag, Sparkles as Beauty, HomeIcon, Settings, CarFront, UserCheck, Coffee, Verified, Clock, Banknote, Camera, Briefcase, Wrench, Palette, Dumbbell, GraduationCap, Scissors, Laptop } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"
import { buildPublicServicePath } from "@/lib/public-links"
import { personalizeProducts, personalizeServices, trackProductQuickView, trackServiceView } from "@/lib/personalization"

function TrendingProducts() {
  const [products, setProducts] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState<any[]>([])
  const [recentlyViewedServices, setRecentlyViewedServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const { addItem } = useCart ? useCart() : { addItem: () => {} }
  const notification = useNotification ? useNotification() : null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getProductImage = (product: any) => {
    const source = Array.isArray(product?.images) ? product.images.find((item: unknown) => typeof item === "string" && item.trim()) : ""
    return source || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&h=900&fit=crop"
  }

  const getServiceDisplayPrice = (service: any) => {
    const packages = (service?.packageOptions || []).filter((pkg: any) => pkg?.active !== false)
    const minPrice = packages.length
      ? Math.min(...packages.map((pkg: any) => Number(pkg?.price || 0)))
      : Number(service?.price || 0)

    if (service?.requiresQuote) {
      return `From ${formatCurrency(minPrice)}`
    }

    return formatCurrency(minPrice)
  }

  useEffect(() => {
    async function fetchTrending() {
      try {
        const response = await fetch("/api/home/trending")
        const data = await response.json()

        if (!response.ok || !data?.success) {
          setProducts([])
          setServices([])
          return
        }

        setProducts(Array.isArray(data?.data?.products) ? data.data.products : [])
        setServices(Array.isArray(data?.data?.services) ? data.data.services : [])
      } catch {
        setProducts([])
        setServices([])
      } finally {
        setLoading(false)
      }
    }
    fetchTrending()
  }, [])

  const recommendedProducts = personalizeProducts(products).slice(0, 4)
  const recommendedServices = personalizeServices(services).slice(0, 2)

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const raw = localStorage.getItem("mis:user-activity:v1")
      if (!raw) {
        setRecentlyViewedProducts([])
        setRecentlyViewedServices([])
        return
      }

      const parsed = JSON.parse(raw)
      const productViews = Array.isArray(parsed?.productQuickViews) ? parsed.productQuickViews : []
      const serviceViews = Array.isArray(parsed?.serviceViews) ? parsed.serviceViews : []

      const productMap = new Map(
        (products || []).map((item: any) => [String(item?.id || item?._id || ""), item])
      )
      const serviceMap = new Map(
        (services || []).map((item: any) => [String(item?.id || item?._id || ""), item])
      )

      const resolvedProducts: any[] = []
      const seenProductIds = new Set<string>()
      for (const entry of [...productViews].sort((a: any, b: any) => Number(b?.ts || 0) - Number(a?.ts || 0))) {
        const id = String(entry?.id || "")
        if (!id || seenProductIds.has(id)) continue
        const matched = productMap.get(id)
        if (!matched) continue
        seenProductIds.add(id)
        resolvedProducts.push(matched)
        if (resolvedProducts.length >= 4) break
      }

      const resolvedServices: any[] = []
      const seenServiceIds = new Set<string>()
      for (const entry of [...serviceViews].sort((a: any, b: any) => Number(b?.ts || 0) - Number(a?.ts || 0))) {
        const id = String(entry?.id || "")
        if (!id || seenServiceIds.has(id)) continue
        const matched = serviceMap.get(id)
        if (!matched) continue
        seenServiceIds.add(id)
        resolvedServices.push(matched)
        if (resolvedServices.length >= 4) break
      }

      setRecentlyViewedProducts(resolvedProducts)
      setRecentlyViewedServices(resolvedServices)
    } catch {
      setRecentlyViewedProducts([])
      setRecentlyViewedServices([])
    }
  }, [products, services])

  if (loading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="rounded-3xl border border-accent/15 bg-white p-4 sm:p-6 shadow-sm">
          <div className="h-6 w-48 bg-neutral-200 rounded-md animate-pulse mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={`recommended-skeleton-${i}`} className="border border-neutral-200 rounded-2xl p-3 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-20 h-20 rounded-xl bg-neutral-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-5/6 bg-neutral-200 rounded" />
                    <div className="h-3 w-2/3 bg-neutral-200 rounded" />
                    <div className="h-8 w-20 bg-neutral-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4 md:gap-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={`product-${i}`} className="animate-pulse bg-white rounded-2xl border border-neutral-200 h-[290px]" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={`service-${i}`} className="animate-pulse bg-white rounded-2xl border border-neutral-200 h-60" />
          ))}
        </div>
      </div>
    )
  }
  if (!products.length && !services.length) {
    return <div className="text-center text-muted-foreground">No trending items found.</div>
  }
  return (
    <>
      <div className="space-y-8 sm:space-y-10">
        <div className="rounded-3xl border border-accent/20 bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-lg sm:text-xl font-semibold text-neutral-900">Recommended for You</h3>
            <Badge variant="outline" className="text-xs border-accent/30 text-accent">Personalized</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 stagger-grid">
            {recommendedProducts.map((product: any) => (
              <Card
                key={`rec-product-${product.id}`}
                className="overflow-hidden border border-neutral-200 hover:border-accent/50 hover:shadow-md transition-all duration-300 cursor-pointer card-lift"
                onClick={() => {
                  trackProductQuickView({
                    id: String(product.id || product._id || ""),
                    category: product.category,
                    title: product.title || product.name,
                    storeName: product.storeName || product.vendorName,
                  })
                  setSelectedProduct(product)
                  setQuickViewOpen(true)
                }}
              >
                <div className="flex gap-3 p-3">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted shrink-0">
                    <img
                      src={getProductImage(product)}
                      alt={product.title || product.name || "Product image"}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-900 line-clamp-2">{product.title || product.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{product.storeName || product.vendorName || "Store"}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-accent">{formatCurrency(Number(product.price || 0))}</span>
                      <Button
                        size="sm"
                        className="h-8 px-3"
                        onClick={(event) => {
                          event.stopPropagation()
                          addItem({
                            productId: product.id,
                            id: product.id,
                            title: product.title || product.name || '',
                            price: product.price,
                            image: product.images?.[0] || '',
                            maxStock: product.stock || 100,
                            vendorId: product.vendorId,
                            vendorName: product.storeName || product.vendorName || 'Unknown Vendor'
                          })
                          notification?.success('Product added to cart', product.title || product.name || 'Added to cart', 2500)
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {recommendedServices.map((service: any) => {
              const serviceId = String(service.id || service._id || "")
              return (
                <Card
                  key={`rec-service-${serviceId}`}
                  className="border border-neutral-200 hover:border-accent/50 hover:shadow-md transition-all duration-300 card-lift"
                >
                  <div className="p-3 space-y-2">
                    <p className="text-sm font-semibold text-neutral-900 line-clamp-2">{service.title || service.name || "Service"}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{service.providerName || service.vendorName || "Provider"}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-accent">{getServiceDisplayPrice(service)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3"
                        onClick={() => {
                          trackServiceView({
                            id: serviceId,
                            title: service.title || service.name,
                            category: service.category,
                            providerName: service.providerName || service.vendorName,
                            location: service.location || service.city || service.state,
                          })
                          if (!serviceId) return
                          window.dispatchEvent(new CustomEvent('slideOutNavigate', { detail: { target: buildPublicServicePath(service) } }))
                        }}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        {(recentlyViewedProducts.length > 0 || recentlyViewedServices.length > 0) && (
          <div className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-neutral-900">Recently Viewed</h3>
              <Badge variant="outline" className="text-xs">Quick return</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 stagger-grid">
              {recentlyViewedProducts.map((product: any) => (
                <Card
                  key={`recent-product-${String(product?.id || product?._id || "")}`}
                  className="overflow-hidden border border-neutral-200 hover:border-accent/40 hover:shadow-md transition-all cursor-pointer card-lift"
                  onClick={() => {
                    setSelectedProduct(product)
                    setQuickViewOpen(true)
                  }}
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    <img
                      src={getProductImage(product)}
                      alt={product.title || product.name || "Product image"}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 space-y-1">
                    <p className="text-xs font-semibold line-clamp-2">{product.title || product.name}</p>
                    <p className="text-[11px] text-accent font-semibold">{formatCurrency(Number(product.price || 0))}</p>
                  </div>
                </Card>
              ))}

              {recentlyViewedServices.map((service: any) => {
                const serviceId = String(service?.id || service?._id || "")
                const serviceName = service.title || service.name || "Service"
                return (
                  <Card
                    key={`recent-service-${serviceId}`}
                    className="overflow-hidden border border-neutral-200 hover:border-accent/40 hover:shadow-md transition-all cursor-pointer card-lift"
                    onClick={() => {
                      if (!serviceId) return
                      window.dispatchEvent(new CustomEvent('slideOutNavigate', { detail: { target: buildPublicServicePath(service) } }))
                    }}
                  >
                    <div className="aspect-square bg-muted overflow-hidden">
                      {service.images && service.images.length > 0 && service.images[0] ? (
                        <img
                          src={service.images[0]}
                          alt={serviceName}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full bg-linear-to-br from-accent/15 to-accent/5">
                          <Settings className="h-10 w-10 text-accent/70" />
                        </div>
                      )}
                    </div>
                    <div className="p-2 space-y-1">
                      <p className="text-xs font-semibold line-clamp-2">{serviceName}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{service.providerName || service.vendorName || "Provider"}</p>
                      <p className="text-[11px] text-accent font-semibold">{getServiceDisplayPrice(service)}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!serviceId) return
                          window.dispatchEvent(new CustomEvent('slideOutNavigate', { detail: { target: buildPublicServicePath(service) } }))
                        }}
                      >
                        Open service
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg md:text-xl font-bold text-neutral-900">Top Items This Week</h3>
            <Link href="/products" className="text-xs sm:text-sm text-accent hover:underline">View all products</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4 md:gap-6 stagger-grid">
            {products.map((product: any) => (
          <Card 
            key={product.id} 
            className="border border-neutral-200 shadow-sm overflow-hidden relative hover:shadow-lg transition-all duration-300 rounded-2xl active:scale-95 md:active:scale-100 cursor-pointer card-lift"
            onClick={() => {
              trackProductQuickView({
                id: String(product.id || product._id || ""),
                category: product.category,
                title: product.title || product.name,
                storeName: product.storeName || product.vendorName,
              })
              setSelectedProduct(product)
              setQuickViewOpen(true)
            }}
          >
            <div className="group overflow-hidden">
              <div className="aspect-square overflow-hidden bg-muted">
                <img
                  src={getProductImage(product)}
                  alt={product.title || product.name || "Product image"}
                  loading="lazy"
                  decoding="async"
                  className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${product.stock === 0 ? 'grayscale' : ''}`}
                />
              </div>

              {product.stock === 0 && (
                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                  <div className="bg-red-600 text-white px-4 py-1 transform -rotate-45 font-bold text-xs shadow-lg">
                    OUT OF STOCK
                  </div>
                </div>
              )}
              <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                {product.featured && (
                  <Badge className="bg-yellow-500 text-black font-semibold text-[10px] px-2 py-0.5">
                    Featured
                  </Badge>
                )}
                {(product.stock ?? 0) < 10 && (product.stock ?? 0) > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
                    Only {product.stock} left
                  </Badge>
                )}
              </div>
            </div>
            <div className="p-3 space-y-2">
              <p className="text-sm font-semibold text-neutral-900 line-clamp-2">{product.title || product.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{product.storeName || product.vendorName || 'Store'}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-accent">{formatCurrency(Number(product.price || 0))}</span>
                <span className="text-[11px] text-muted-foreground">{product.category || 'General'}</span>
              </div>
              <Button 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  addItem({
                    productId: product.id,
                    id: product.id,
                    title: product.title || product.name || '',
                    price: product.price,
                    image: product.images?.[0] || '',
                    maxStock: product.stock || 100,
                    vendorId: product.vendorId,
                    vendorName: product.storeName || product.vendorName || 'Unknown Vendor'
                  })
                  if (notification) {
                    notification.success(
                      'Product added to cart',
                      product.title || product.name || 'Added to cart',
                      3000
                    )
                  }
                }}
                disabled={product.stock === 0}
                className="w-full h-8 text-xs hover:scale-[1.01] active:scale-95 transition-all"
              >
                Add to cart
              </Button>
            </div>
          </Card>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg md:text-xl font-bold text-neutral-900">Top Services Booked</h3>
            <Link href="/services" className="text-xs sm:text-sm text-accent hover:underline">View all services</Link>
          </div>
          {services.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 stagger-grid">
              {services.map((service: any) => {
                const serviceName = service.title || service.name || service.serviceTitle || 'Service'
                const serviceId = service.id || service._id

                return (
                <Card
                  key={serviceId || serviceName}
                  className="h-full p-0 gap-0 hover:shadow-lg hover:scale-[1.01] transition-all duration-300 group overflow-hidden border border-neutral-200 rounded-2xl relative card-lift"
                >
                  <div className="aspect-4/5 relative overflow-hidden rounded-t-2xl">
                    {service.images && service.images.length > 0 && service.images[0] ? (
                      <img
                        src={service.images[0]}
                        alt={serviceName}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-linear-to-br from-accent/15 to-accent/5">
                        <Settings className="h-10 w-10 text-accent/70" />
                      </div>
                    )}

                  </div>
                  <div className="p-3 space-y-2">
                    <h3 className="text-sm font-semibold text-neutral-900 line-clamp-2">{serviceName}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Verified className="h-3 w-3 text-accent" />
                      <span className="line-clamp-1">{service.providerName || service.vendorName || "Provider"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-accent">{getServiceDisplayPrice(service)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3"
                        onClick={() => {
                          trackServiceView({
                            id: String(serviceId || ""),
                            title: serviceName,
                            category: service.category,
                            providerName: service.providerName || service.vendorName,
                            location: service.location || service.city || service.state,
                          })
                          if (!serviceId) return
                          window.dispatchEvent(new CustomEvent('slideOutNavigate', { detail: { target: buildPublicServicePath(service) } }))
                        }}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                </Card>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No service booking data available yet.</p>
          )}
        </div>
      </div>
      <ProductQuickView
        product={selectedProduct}
        open={quickViewOpen}
        onClose={() => {
          setQuickViewOpen(false)
          setSelectedProduct(null)
        }}
        onAddToCart={p => {
          addItem({
            productId: p.id,
            id: p.id,
            title: p.title || p.name || '',
            price: p.price,
            image: p.images?.[0] || '',
            maxStock: p.stock || 100,
            vendorId: p.vendorId,
            vendorName: (p as any).storeName || p.vendorName || 'Unknown Vendor'
          })
          if (notification) {
            notification.success(
              'Product added to cart',
              p.title || p.name || 'Added to cart',
              3000
            )
          }
        }}
        storeName={selectedProduct?.storeName || selectedProduct?.vendorName || selectedProduct?.vendor?.name || 'Unknown Vendor'}
      />
    </>
  )
}

// Move HeroButtons here, above HomePage
function HeroButtons({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter()
  const storesHref = '/stores'
  const servicesHref = isLoggedIn ? '/services' : '/signup?type=vendor'

  const triggerSlideNavigation = (
    e: React.MouseEvent<HTMLAnchorElement>,
    target: string,
    direction: 'left' | 'right' = 'right'
  ) => {
    e.preventDefault()
    window.dispatchEvent(new CustomEvent('slideOutNavigate', { detail: { target, direction } }))
  }

  useEffect(() => {
    router.prefetch(storesHref)
    router.prefetch(servicesHref)
  }, [isLoggedIn, router])

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-2">
        <Link
          href={storesHref}
          prefetch
          className="px-6 sm:px-8 py-3 text-[clamp(1rem,4.1vw,1.125rem)] font-semibold rounded-full shadow-2xl bg-accent text-white border-2 border-accent transition-all duration-300 hover:bg-accent/10 hover:text-accent hover:border-accent flex items-center justify-center group overflow-hidden relative min-w-[clamp(180px,74vw,260px)] sm:min-w-[260px]"
          onMouseEnter={() => router.prefetch(storesHref)}
          onTouchStart={() => router.prefetch(storesHref)}
          onClick={(e) => triggerSlideNavigation(e, storesHref, 'right')}
        >
          <span className="w-full text-center">{isLoggedIn ? 'Check out Stores' : 'Start Shopping'}</span>
          <span
            className={
              "inline-flex items-center absolute right-4 sm:right-3 top-1/2 -translate-y-1/2 transition-transform group-hover:translate-x-1 motion-reduce:transform-none animate-bounce-x"
            }
          >
            <svg width="24" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-white group-hover:text-accent">
              <path d="M3 12h18M15 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
        <Link
          href={servicesHref}
          prefetch
          className="px-6 sm:px-8 py-3 text-[clamp(1rem,4.1vw,1.125rem)] font-semibold rounded-full shadow-2xl border-2 border-accent text-accent bg-white hover:bg-accent/10 transition-all duration-300 flex items-center justify-center group overflow-hidden relative min-w-[clamp(180px,74vw,260px)] sm:min-w-[260px]"
          onMouseEnter={() => router.prefetch(servicesHref)}
          onTouchStart={() => router.prefetch(servicesHref)}
          onClick={(e) => triggerSlideNavigation(e, servicesHref, 'right')}
        >
          <span className="w-full text-center">{isLoggedIn ? 'Check out Services' : 'Become a Seller'}</span>
          <span
            className={
              "inline-flex items-center absolute right-4 sm:right-3 top-1/2 -translate-y-1/2 transition-transform group-hover:translate-x-1 motion-reduce:transform-none animate-bounce-x"
            }
          >
            <svg width="24" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-accent group-hover:text-white">
              <path d="M3 12h18M15 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
      </div>
      <style jsx global>{`
        @keyframes bounce-x {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(6px); }
        }
        .animate-bounce-x {
          animation: bounce-x 1s infinite;
        }
      `}</style>
    </>
  );
}

export default function HomePage() {
  const HOME_SCROLL_KEY = "mis:scroll:home:v1"
  const { user } = useAuth()
  const [searchValue, setSearchValue] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams()
  const [showDeletedMessage, setShowDeletedMessage] = useState(false)
  const [fadeIn, setFadeIn] = useState(false)
  const [fadeInFeatures, setFadeInFeatures] = useState(false)

  useEffect(() => {
    if (searchParams.get('account_deleted') === 'true') {
      setShowDeletedMessage(true)
      // Hide message after 5 seconds
      setTimeout(() => setShowDeletedMessage(false), 5000)
    }
  }, [searchParams])

  useEffect(() => {
    // Trigger fade-in effect on component mount
    const timer = setTimeout(() => setFadeIn(true), 100)
    const timer2 = setTimeout(() => setFadeInFeatures(true), 300)
    return () => { clearTimeout(timer)
      clearTimeout(timer2)
    }
  }, [])

  // Slide-out state for page transition
  const [slideOut, setSlideOut] = useState(false);
  const [slideTarget, setSlideTarget] = useState('');
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  const saveHomeScrollPosition = () => {
    if (typeof window === "undefined") return
    sessionStorage.setItem(HOME_SCROLL_KEY, String(window.scrollY))
  }

  useEffect(() => {
    if (typeof window === "undefined") return

    const savedScroll = sessionStorage.getItem(HOME_SCROLL_KEY)
    if (!savedScroll) return

    const targetScroll = Number(savedScroll)
    if (Number.isNaN(targetScroll)) {
      sessionStorage.removeItem(HOME_SCROLL_KEY)
      return
    }

    let attempts = 0
    const maxAttempts = 12

    const restore = () => {
      window.scrollTo({ top: targetScroll, behavior: "auto" })
      attempts += 1

      if (attempts < maxAttempts && Math.abs(window.scrollY - targetScroll) > 2) {
        window.requestAnimationFrame(restore)
        return
      }

      sessionStorage.removeItem(HOME_SCROLL_KEY)
    }

    window.requestAnimationFrame(restore)
  }, [])

  // Listen for slide trigger from HeroButtons
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail && e.detail.target) {
        setSlideTarget(e.detail.target);
        setSlideDirection(e.detail.direction === 'left' ? 'left' : 'right');
        setSlideOut(true);
      }
    };
    window.addEventListener('slideOutNavigate', handler);
    return () => window.removeEventListener('slideOutNavigate', handler);
  }, []);

  // Navigate after animation
  useEffect(() => {
    if (slideOut && slideTarget) {
      const timer = setTimeout(() => {
        saveHomeScrollPosition()
        window.location.href = slideTarget;
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [slideOut, slideTarget]);

  return (
    <div className="min-h-screen flex flex-col relative pt-3 sm:pt-0">
      <div
        className={`min-h-screen flex flex-col transition-opacity duration-1000 ${fadeIn ? 'opacity-100' : 'opacity-0'} main-slide-anim${slideOut ? (slideDirection === 'left' ? ' slide-out-left' : ' slide-out-right') : ''}`}
      >
        <Header homeBg={true} />
        <main
          className="flex-1 relative z-20"
          onClickCapture={(event) => {
            const target = event.target as HTMLElement | null
            const anchor = target?.closest("a[href]") as HTMLAnchorElement | null
            if (!anchor) return

            const href = anchor.getAttribute("href")
            if (!href || !href.startsWith("/")) return

            saveHomeScrollPosition()
          }}
        >
          {showDeletedMessage && (
            <div className="container mx-auto px-4 pt-4">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Your account has been successfully deleted. Thank you for using Make It Sell!
                </AlertDescription>
              </Alert>
            </div>
          )}
          {/* HERO SECTION */}
          <section className="relative min-h-screen flex items-center justify-center pt-6 sm:pt-4 md:pt-0 mt-0 md:-mt-20 overflow-hidden">
            <div className="container mx-auto px-4 sm:px-8 max-w-[1600px]">
              <div className="flex flex-col-reverse items-center justify-center text-center gap-1 sm:gap-4 md:flex-row md:text-left md:items-center md:gap-0">
                {/* Left: Texts */}
                <div className="w-full md:w-[40%] flex flex-col justify-center md:justify-center md:items-start md:text-left gap-4 sm:gap-6 mt-1 sm:mt-0 md:mt-0">
                  <span className="text-accent font-bold text-[clamp(1rem,4vw,1.25rem)] tracking-wide">
                    WHERE EVERYTHING SELLS!
                  </span>
                  <h1 className="text-[clamp(2.1rem,9vw,3.75rem)] font-extrabold text-neutral-900 mb-2 leading-[1.1]">
                    Find What You Love,
                    <br />
                    <span className="text-accent">From Real People</span>
                  </h1>
                  <p className="text-[clamp(1rem,4.2vw,1.25rem)] text-neutral-700 max-w-2xl mb-2">
                    Nigeria's most trusted marketplace for unique products, unbeatable prices, and real customer support.
                  </p>
                  {/* Search Form (existing) */}
                  <form
                    className="flex w-full max-w-md bg-white/90 rounded-full shadow-lg overflow-hidden border border-accent/30 focus-within:ring-2 focus-within:ring-accent"
                    onSubmit={e => {
                      e.preventDefault();
                      if (searchValue.trim()) {
                        router.push(`/search?query=${encodeURIComponent(searchValue.trim())}`);
                      }
                    }}
                  >
                    <input
                      type="text"
                      value={searchValue}
                      onChange={e => setSearchValue(e.target.value)}
                      placeholder="What are you looking for today?"
                      className="flex-1 px-4 h-11 text-[clamp(0.95rem,3.8vw,1.05rem)] text-neutral-900 bg-transparent outline-none placeholder:text-neutral-500"
                      aria-label="Search products"
                    />
                    <button
                      type="submit"
                      className="rounded-none rounded-r-full bg-accent hover:bg-accent/90 text-white px-4 h-11 text-[clamp(0.95rem,3.7vw,1.05rem)] font-semibold"
                    >
                      Search
                    </button>
                  </form>
                  <HeroButtons isLoggedIn={!!user} />

                  {/* Mobile: show carousel after CTA buttons */}
                  <div className="md:hidden w-full flex items-center justify-center pt-1">
                    <HeroShuffleCarousel />
                  </div>
                </div>
                {/* Right: Image */}
                <div className="hidden md:flex w-full md:w-[60%] items-center justify-center md:justify-start md:items-center">
                  <HeroShuffleCarousel />
                </div> 
              </div>
            </div>
          </section>
          {/* CATEGORY SECTION */}
          <section className="py-8 sm:py-12 bg-gray-50"> 
            <div className="container mx-auto px-4 sm:px-8"> 
              <div className="text-center mb-8 sm:mb-10"> 
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-neutral-900 mb-2">Browse by Category</h2>
                <p className="text-muted-foreground text-sm sm:text-base">Explore top categories of products and services</p>
              </div>
              
              {/* Products Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5 md:gap-6 mb-4 sm:mb-5 md:mb-6 max-w-6xl mx-auto">
                <a href="/category/electronics" className="group bg-white rounded-xl p-5 sm:p-7 flex flex-col items-start text-left border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <Smartphone className="h-11 w-11 sm:h-14 sm:w-14 text-accent mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-neutral-900 text-sm sm:text-base mb-1">Electronics</h3>
                  <p className="text-xs text-muted-foreground">Phones, laptops, gadgets & more</p>
                </a>
                
                <a href="/category/fashion" className="group bg-white rounded-xl p-5 sm:p-7 flex flex-col items-start text-left border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <ShoppingBag className="h-11 w-11 sm:h-14 sm:w-14 text-accent mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-neutral-900 text-sm sm:text-base mb-1">Fashion</h3>
                  <p className="text-xs text-muted-foreground">Clothing, shoes & accessories</p>
                </a>
                
                <a href="/category/health-wellness" className="group bg-white rounded-xl p-5 sm:p-7 flex flex-col items-start text-left border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <Beauty className="h-11 w-11 sm:h-14 sm:w-14 text-accent mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-neutral-900 text-sm sm:text-base mb-1">Health & Beauty</h3>
                  <p className="text-xs text-muted-foreground">Personal care & wellness products</p>
                </a>
                
                <a href="/category/home-services" className="group bg-white rounded-xl p-5 sm:p-7 flex flex-col items-start text-left border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <HomeIcon className="h-11 w-11 sm:h-14 sm:w-14 text-accent mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-neutral-900 text-sm sm:text-base mb-1">Home Services</h3>
                  <p className="text-xs text-muted-foreground">Professional home improvement</p>
                </a>
              </div>
              
              {/* Services Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5 md:gap-6 max-w-6xl mx-auto">
                <a href="/category/home-services" className="group bg-white rounded-xl p-5 sm:p-7 flex flex-col items-start text-left border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <Settings className="h-11 w-11 sm:h-14 sm:w-14 text-accent mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-neutral-900 text-sm sm:text-base mb-1">Repairs</h3>
                  <p className="text-xs text-muted-foreground">Expert repair & maintenance</p>
                </a>
                
                <a href="/category/automotive" className="group bg-white rounded-xl p-5 sm:p-7 flex flex-col items-start text-left border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <CarFront className="h-11 w-11 sm:h-14 sm:w-14 text-accent mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-neutral-900 text-sm sm:text-base mb-1">Automotive</h3>
                  <p className="text-xs text-muted-foreground">Car services & maintenance</p>
                </a>
                
                <a href="/category/business-services" className="group bg-white rounded-xl p-5 sm:p-7 flex flex-col items-start text-left border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <UserCheck className="h-11 w-11 sm:h-14 sm:w-14 text-accent mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-neutral-900 text-sm sm:text-base mb-1">Freelancers</h3>
                  <p className="text-xs text-muted-foreground">Professional freelance services</p>
                </a>
                
                <a href="/category/events" className="group bg-white rounded-xl p-5 sm:p-7 flex flex-col items-start text-left border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <Coffee className="h-11 w-11 sm:h-14 sm:w-14 text-accent mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-neutral-900 text-sm sm:text-base mb-1">Food & Drinks</h3>
                  <p className="text-xs text-muted-foreground">Restaurants & catering services</p>
                </a>
              </div>
              
              <div className="text-center mt-8 sm:mt-10">
                <Link href="/categories">
                  <Button className="group bg-accent border-2 border-transparent hover:bg-transparent hover:border-accent hover:text-accent text-white px-6 py-3 rounded-lg transition-all duration-300 hover:scale-105">
                    View All Categories
                    <ArrowRight className="ml-2 h-4 w-4 inline group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* FEATURES SECTION */}
          <section className="py-10 sm:py-14">
            <div className="container mx-auto px-4 sm:px-8">
              <div className="text-center mb-8 sm:mb-10">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-neutral-900 mb-2">Why Choose Make It Sell?</h2>
                <p className="text-muted-foreground text-sm sm:text-base">Explore top categories of products and services</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5 md:gap-6 max-w-6xl mx-auto">
                <div className="feature-card-loop flex flex-col items-center text-center p-5 sm:p-6 rounded-xl bg-white shadow-md border border-gray-200" style={{ animationDelay: '0ms' }}>
                  <Shield className="h-12 w-12 sm:h-14 sm:w-14 text-accent mb-3" />
                  <h3 className="font-semibold text-neutral-900 mb-2 text-sm sm:text-base">Secure Payments</h3>
                  <p className="text-neutral-600 text-xs sm:text-sm">Your money is safe with us</p>
                </div>
                
                <div className="feature-card-loop flex flex-col items-center text-center p-5 sm:p-6 rounded-xl bg-white shadow-md border border-gray-200" style={{ animationDelay: '200ms' }}>
                  <Users className="h-12 w-12 sm:h-14 sm:w-14 text-accent mb-3" />
                  <h3 className="font-semibold text-neutral-900 mb-2 text-sm sm:text-base">Verified Sellers</h3>
                  <p className="text-neutral-600 text-xs sm:text-sm">All vendors are thoroughly verified</p>
                </div>
                
                <div className="feature-card-loop flex flex-col items-center text-center p-5 sm:p-6 rounded-xl bg-white shadow-md border border-gray-200" style={{ animationDelay: '400ms' }}>
                  <Shield className="h-12 w-12 sm:h-14 sm:w-14 text-accent mb-3" />
                  <h3 className="font-semibold text-neutral-900 mb-2 text-sm sm:text-base">Buyer Protection</h3>
                  <p className="text-neutral-600 text-xs sm:text-sm">Refund guarantee of undelivered orders</p>
                </div>
                
                <div className="feature-card-loop flex flex-col items-center text-center p-5 sm:p-6 rounded-xl bg-white shadow-md border border-gray-200" style={{ animationDelay: '600ms' }}>
                  <Truck className="h-12 w-12 sm:h-14 sm:w-14 text-accent mb-3" />
                  <h3 className="font-semibold text-neutral-900 mb-2 text-sm sm:text-base">Nationwide Delivery</h3>
                  <p className="text-neutral-600 text-xs sm:text-sm">Fast and reliable shipping</p>
                </div>
              </div>
              
              <div className="text-center mt-8 sm:mt-10">
                <Link href="/stores">
                  <Button className="bg-accent border-2 border-transparent hover:bg-transparent hover:border-accent hover:text-accent text-white px-8 py-3 rounded-lg transition-all duration-300 hover:scale-105 shadow-md">
                    View All Products
                    <ArrowRight className="ml-2 h-4 w-4 inline" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>
    
          {/* TRENDING PRODUCTS SECTION */}
          <section className="py-10 sm:py-14">
            <div className="w-full px-2 sm:px-4">
              <div className="text-center mb-6 sm:mb-8 animate-fade-in">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-balance text-accent">Trending Now</h2>
                <p className="text-muted-foreground mt-1 sm:mt-2 text-xs sm:text-sm">Top products and most-booked services loved by customers</p>
              </div>
              <TrendingProducts />
            </div>
          </section>
        </main>
      </div>
      <style jsx global>{`
        button, .cursor-pointer, a[role="button"] {
          cursor: pointer !important;
        }
        @keyframes stagger-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .stagger-grid > * {
          animation: stagger-up 0.45s ease both;
        }
        .stagger-grid > *:nth-child(1) { animation-delay: 0.02s; }
        .stagger-grid > *:nth-child(2) { animation-delay: 0.05s; }
        .stagger-grid > *:nth-child(3) { animation-delay: 0.08s; }
        .stagger-grid > *:nth-child(4) { animation-delay: 0.11s; }
        .stagger-grid > *:nth-child(5) { animation-delay: 0.14s; }
        .stagger-grid > *:nth-child(6) { animation-delay: 0.17s; }
        .card-lift {
          transform: translateY(0);
          will-change: transform, box-shadow;
        }
        .card-lift:hover {
          transform: translateY(-3px);
        }
        @media (prefers-reduced-motion: reduce) {
          .stagger-grid > * {
            animation: none !important;
          }
          .card-lift,
          .card-lift:hover {
            transform: none !important;
          }
        }
        .main-slide-anim {
          transition: transform 0.6s cubic-bezier(.7,1.7,.7,1), opacity 0.6s;
        }
        .slide-out-right {
          transform: translateX(100vw);
          opacity: 0.7;
        }
        .slide-out-left {
          transform: translateX(-100vw);
          opacity: 0.7;
        }
        @keyframes feature-float {
          0% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
          100% { transform: translateY(0); }
        }
        .feature-card-loop {
          animation: feature-float 2.8s cubic-bezier(.4,1.2,.4,1) infinite;
          will-change: transform;
        }
        .feature-card {
          opacity: 0;
          transform: translateY(24px);
          will-change: opacity, transform;
          animation: feature-fade-in 0.7s cubic-bezier(.4,1.2,.4,1) both;
        }
        .feature-animate {
          opacity: 1 !important;
          animation-play-state: running !important;
        }
        .feature-card:not(.feature-animate) {
          animation-play-state: paused !important;
        }
      `}</style>
    </div>
  );
}

