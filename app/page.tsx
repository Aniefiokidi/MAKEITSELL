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
import { optimizedImageUrl } from "@/lib/cloudinary-url"
import { Shield, Users, Truck, Sparkles, ArrowRight, Smartphone, ShoppingBag, Sparkles as Beauty, HomeIcon, Settings, CarFront, UserCheck, Coffee, Verified, Clock, Banknote, Camera, Briefcase, Wrench, Palette, Dumbbell, GraduationCap, Scissors, Laptop, Package, Heart, BadgeCheck } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"
import { buildPublicServicePath, buildPublicStorePath } from "@/lib/public-links"
import { personalizeProducts, personalizeServices, personalizeStores, trackProductQuickView, trackServiceView } from "@/lib/personalization"
import { Leaderboard } from "@/components/public/Leaderboard"
import { ProductCard } from "@/components/products/ProductCard"
function TrendingProducts() {
  const [products, setProducts] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
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
    return optimizedImageUrl(source, { width: 500 }) || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&h=900&fit=crop"
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

  // Reveal when the section scrolls into view so it doesn't compete with the
  // hero carousel fetch on initial page load.
  useEffect(() => {
    const el = sectionRef.current
    if (!el) { setVisible(true); return }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { rootMargin: "200px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
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
  }, [visible])

  // Run personalization once — re-ranks the full pool by user signals, then slice for each section
  const personalizedProducts = personalizeProducts(products)
  const personalizedServices = personalizeServices(services)
  const recommendedProducts = personalizedProducts.slice(0, 4)
  const recommendedServices = personalizedServices.slice(0, 2)

  // Load recently viewed from localStorage, then enrich any stale entries
  // (saved before image/price were tracked) with a server batch fetch.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem("mis:user-activity:v1")
      if (!raw) return
      const parsed = JSON.parse(raw)
      const productViews = Array.isArray(parsed?.productQuickViews) ? parsed.productQuickViews : []
      const resolved: any[] = []
      const seen = new Set<string>()
      for (const entry of [...productViews].sort((a: any, b: any) => Number(b?.ts || 0) - Number(a?.ts || 0))) {
        const id = String(entry?.id || "")
        if (!id || seen.has(id) || !entry.title) continue
        seen.add(id)
        resolved.push({ id, _id: id, title: entry.title, name: entry.title, price: entry.price || 0, images: entry.image ? [entry.image] : [], category: entry.category })
        if (resolved.length >= 8) break
      }
      if (!resolved.length) return

      // Show immediately with whatever we have, then enrich stale entries
      setRecentlyViewedProducts(resolved)

      const staleIds = resolved.filter(p => !p.images[0] || !p.price).map(p => p.id)
      if (!staleIds.length) return

      fetch(`/api/home/product-cards?ids=${staleIds.join(",")}`)
        .then(r => r.json())
        .then(data => {
          if (!Array.isArray(data?.products)) return
          const byId = new Map<string, { id: string; price: number; image: string }>(data.products.map((p: any) => [p.id, p]))
          setRecentlyViewedProducts(prev => prev.map(p => {
            const fresh = byId.get(p.id)
            if (!fresh) return p
            return {
              ...p,
              price: fresh.price || p.price,
              images: fresh.image ? [fresh.image] : p.images,
            }
          }))
        })
        .catch(() => {})
    } catch {
      setRecentlyViewedProducts([])
    }
  }, [])

  if (loading) {
    return (
      <div ref={sectionRef} className="space-y-6 sm:space-y-8">
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
                    price: Number(product.price || 0),
                    image: product.images?.[0] || '',
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

        {recentlyViewedProducts.length > 0 && (
          <div className="rounded-2xl border border-neutral-100 bg-white px-4 sm:px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-semibold text-neutral-800">Recently Viewed</h3>
              </div>
              <Link href="/products" className="text-xs text-accent hover:underline font-medium">Browse all</Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
              {recentlyViewedProducts.map((product: any) => (
                <Link
                  key={`rv-${String(product?.id || product?._id)}`}
                  href={`/products/${product.id || product._id}`}
                  className="shrink-0 w-28 sm:w-32 group"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group-hover:border-accent/50 transition-colors mb-1.5">
                    {(product.images?.[0]) ? (
                      <img
                        src={optimizedImageUrl(product.images[0], { width: 200 })}
                        alt={product.title || product.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-7 w-7 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-gray-800 line-clamp-2 leading-snug">{product.title || product.name}</p>
                  <p className="text-[11px] text-accent font-semibold mt-0.5">{formatCurrency(Number(product.price || 0))}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg md:text-xl font-bold text-neutral-900">Top Items This Week</h3>
            <Link href="/products" className="text-xs sm:text-sm text-accent hover:underline">View all products</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4 md:gap-6 stagger-grid">
            {personalizedProducts.map((product: any) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpen={(p) => {
                  trackProductQuickView({
                    id: String(p.id || (p as any)._id || ""),
                    category: p.category,
                    title: p.title || p.name,
                    storeName: p.storeName || p.vendorName,
                    price: Number(p.price || 0),
                    image: p.images?.[0] || '',
                  })
                  setSelectedProduct(product)
                  setQuickViewOpen(true)
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg md:text-xl font-bold text-neutral-900">Top Services Booked</h3>
            <Link href="/services" className="text-xs sm:text-sm text-accent hover:underline">View all services</Link>
          </div>
          {personalizedServices.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 stagger-grid">
              {personalizedServices.map((service: any) => {
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
                        src={optimizedImageUrl(service.images[0], { width: 500 })}
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
            productId: String(p.id || ''),
            id: String(p.id || ''),
            title: p.title || p.name || '',
            price: Number(p.price || 0),
            image: p.images?.[0] || '',
            maxStock: Number(p.stock || 100),
            vendorId: String(p.vendorId || ''),
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

function FeaturedStores() {
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/home/featured-stores')
      .then(r => r.json())
      .then(data => {
        const pool = Array.isArray(data.stores) ? data.stores : []
        // Re-rank by user signals (category affinity, visited stores, search terms)
        // then cap to 6 for display
        setStores(personalizeStores(pool).slice(0, 6))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="animate-pulse rounded-2xl border border-neutral-200 bg-white">
            <div className="aspect-square bg-neutral-200 rounded-t-2xl" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-neutral-200 rounded w-3/4" />
              <div className="h-2.5 bg-neutral-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (!stores.length) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 stagger-grid">
      {stores.map((store: any) => (
        <Link
          key={store.id}
          href={buildPublicStorePath(store)}
          className="group block rounded-2xl overflow-hidden border border-neutral-200 hover:border-accent/50 hover:shadow-lg transition-all duration-300 card-lift bg-white"
        >
          <div className="aspect-square overflow-hidden bg-gradient-to-br from-accent/10 to-accent/5">
            {store.image ? (
              <img
                src={optimizedImageUrl(store.image, { width: 400 })}
                alt={store.storeName}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-4xl font-bold text-accent/40">
                  {store.storeName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="p-3">
            <p className="text-sm font-semibold text-neutral-900 line-clamp-1">{store.storeName}</p>
            {store.category && <p className="text-xs text-accent mt-0.5 line-clamp-1">{store.category}</p>}
            {store.location && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{store.location}</p>}
          </div>
        </Link>
      ))}
    </div>
  )
}

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
        {isLoggedIn ? (
          <Link
            href={servicesHref}
            prefetch
            className="px-6 sm:px-8 py-3 text-[clamp(1rem,4.1vw,1.125rem)] font-semibold rounded-full shadow-2xl border-2 border-accent text-accent bg-white hover:bg-accent/10 transition-all duration-300 flex items-center justify-center group overflow-hidden relative min-w-[clamp(180px,74vw,260px)] sm:min-w-[260px]"
            onMouseEnter={() => router.prefetch(servicesHref)}
            onTouchStart={() => router.prefetch(servicesHref)}
            onClick={(e) => triggerSlideNavigation(e, servicesHref, 'right')}
          >
            <span className="w-full text-center">Check out Services</span>
            <span className="inline-flex items-center absolute right-4 sm:right-3 top-1/2 -translate-y-1/2 transition-transform group-hover:translate-x-1 motion-reduce:transform-none animate-bounce-x">
              <svg width="24" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-accent">
                <path d="M3 12h18M15 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        ) : (
          <Link
            href={servicesHref}
            className="px-6 sm:px-8 py-3 text-[clamp(1rem,4.1vw,1.125rem)] font-semibold rounded-full shadow-2xl border-2 border-accent text-accent bg-white hover:bg-accent/10 transition-all duration-300 flex items-center justify-center group overflow-hidden relative min-w-[clamp(180px,74vw,260px)] sm:min-w-[260px]"
            onMouseEnter={() => router.prefetch(servicesHref)}
            onClick={(e) => triggerSlideNavigation(e, servicesHref, 'right')}
          >
            <span className="w-full text-center">Sell on Make It Sell</span>
            <span className="inline-flex items-center absolute right-4 sm:right-3 top-1/2 -translate-y-1/2 transition-transform group-hover:translate-x-1 motion-reduce:transform-none animate-bounce-x">
              <svg width="24" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-accent">
                <path d="M3 12h18M15 6l6 6-6 6" />
              </svg>
            </span>
          </Link> 
        )}
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
          <section className="relative flex items-start md:min-h-screen md:items-center justify-center pt-1 sm:pt-2 md:pt-12 lg:pt-0 mt-0 lg:-mt-20 overflow-hidden">
            <div className="container mx-auto px-4 sm:px-8 max-w-[1600px]">
              <div className="flex flex-col items-center justify-center text-center gap-4 md:flex-row md:text-left md:items-center md:gap-0">
                {/* Left: Texts */}
                <div className="w-full md:w-[40%] flex flex-col justify-center md:justify-center md:items-start md:text-left gap-4 sm:gap-6">
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
                </div>
                {/* Carousel — below text on mobile, right column on desktop */}
                <div className="flex w-full md:w-[60%] items-center justify-center md:justify-start md:items-center">
                  <HeroShuffleCarousel />
                </div> 
              </div>
            </div>
          </section>
          {/* TRENDING SECTION */}
          <section className="py-10 sm:py-14">
            <div className="w-full px-2 sm:px-4">
              <div className="text-center mb-6 sm:mb-8 animate-fade-in">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-balance text-accent">Trending Now</h2>
                <p className="text-muted-foreground mt-1 sm:mt-2 text-xs sm:text-sm">Top products and most-booked services loved by customers</p>
              </div>
              <TrendingProducts />
            </div>
          </section>

          {/* CATEGORY SECTION */}
          <section className="py-8 sm:py-12 bg-gray-50">
            <div className="container mx-auto px-4 sm:px-8">
              <div className="text-center mb-8 sm:mb-10">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-neutral-900 mb-2">Browse by Category</h2>
                <p className="text-muted-foreground text-sm sm:text-base">Explore top categories of products and services</p>
              </div>

              <div className="mb-3 max-w-6xl mx-auto">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Products</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 max-w-6xl mx-auto">
                {([
                  { href: "/category/electronics", img: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&h=400&fit=crop&auto=format", icon: Smartphone, title: "Electronics", desc: "Phones, laptops & gadgets" },
                  { href: "/category/fashion", img: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=400&fit=crop&auto=format", icon: ShoppingBag, title: "Fashion", desc: "Clothing, shoes & accessories" },
                  { href: "/category/health-wellness", img: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&h=400&fit=crop&auto=format", icon: Beauty, title: "Health & Beauty", desc: "Personal care & wellness" },
                  { href: "/category/home-living", img: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop&auto=format", icon: HomeIcon, title: "Home & Living", desc: "Furniture & décor" },
                ] as const).map(cat => {
                  const Icon = cat.icon
                  return (
                    <a key={cat.href} href={cat.href} className="group relative rounded-xl overflow-hidden block" style={{ aspectRatio: '4/3' }}>
                      <img src={cat.img} alt={cat.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                      <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                        <Icon className="h-6 w-6 text-white drop-shadow mb-1.5" />
                        <h3 className="font-bold text-white text-sm sm:text-base leading-tight">{cat.title}</h3>
                        <p className="text-xs text-white/80 mt-0.5 line-clamp-1">{cat.desc}</p>
                      </div>
                    </a>
                  )
                })}
              </div>

              <div className="mb-3 max-w-6xl mx-auto">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-6xl mx-auto">
                {([
                  { href: "/services?category=repairs", img: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=600&h=400&fit=crop&auto=format", icon: Settings, title: "Repairs", desc: "Expert repair & maintenance" },
                  { href: "/services?category=automotive", img: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&h=400&fit=crop&auto=format", icon: CarFront, title: "Automotive", desc: "Car services & maintenance" },
                  { href: "/services?category=consulting", img: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600&h=400&fit=crop&auto=format", icon: UserCheck, title: "Freelancers", desc: "Professional freelance services" },
                  { href: "/food", img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop&auto=format", icon: Coffee, title: "Food & Drinks", desc: "Restaurants & catering" },
                ] as const).map(cat => {
                  const Icon = cat.icon
                  return (
                    <a key={cat.href} href={cat.href} className="group relative rounded-xl overflow-hidden block" style={{ aspectRatio: '4/3' }}>
                      <img src={cat.img} alt={cat.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                      <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                        <Icon className="h-6 w-6 text-white drop-shadow mb-1.5" />
                        <h3 className="font-bold text-white text-sm sm:text-base leading-tight">{cat.title}</h3>
                        <p className="text-xs text-white/80 mt-0.5 line-clamp-1">{cat.desc}</p>
                      </div>
                    </a>
                  )
                })}
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
                <p className="text-muted-foreground text-sm sm:text-base">Built for trust, speed, and real results — for buyers and sellers alike</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5 md:gap-6 max-w-6xl mx-auto">
                <div className="flex flex-col items-center text-center p-5 sm:p-6 rounded-xl bg-white shadow-sm border border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                    <Shield className="h-7 w-7 text-accent" />
                  </div>
                  <h3 className="font-semibold text-neutral-900 mb-1.5 text-sm sm:text-base">Secure Payments</h3>
                  <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed">All transactions are encrypted and protected</p>
                </div>
                <div className="flex flex-col items-center text-center p-5 sm:p-6 rounded-xl bg-white shadow-sm border border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                    <Users className="h-7 w-7 text-accent" />
                  </div>
                  <h3 className="font-semibold text-neutral-900 mb-1.5 text-sm sm:text-base">Verified Sellers</h3>
                  <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed">Every vendor is reviewed before going live</p>
                </div>
                <div className="flex flex-col items-center text-center p-5 sm:p-6 rounded-xl bg-white shadow-sm border border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                    <BadgeCheck className="h-7 w-7 text-accent" />
                  </div>
                  <h3 className="font-semibold text-neutral-900 mb-1.5 text-sm sm:text-base">Buyer Protection</h3>
                  <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed">Full refund guarantee on undelivered orders</p>
                </div>
                <div className="flex flex-col items-center text-center p-5 sm:p-6 rounded-xl bg-white shadow-sm border border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                    <Truck className="h-7 w-7 text-accent" />
                  </div>
                  <h3 className="font-semibold text-neutral-900 mb-1.5 text-sm sm:text-base">Nationwide Delivery</h3>
                  <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed">Fast and reliable shipping across Nigeria</p>
                </div>
              </div>
              <div className="text-center mt-8 sm:mt-10">
                <Link href="/stores">
                  <Button className="bg-accent border-2 border-transparent hover:bg-transparent hover:border-accent hover:text-accent text-white px-8 py-3 rounded-lg transition-all duration-300 hover:scale-105 shadow-md">
                    Browse Stores
                    <ArrowRight className="ml-2 h-4 w-4 inline" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* LEADERBOARD SECTION */}
          <Leaderboard />

          {/* FEATURED STORES SECTION */}
          <section className="py-10 sm:py-14 bg-gray-50">
            <div className="container mx-auto px-4 sm:px-8">
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900">Featured Stores</h2>
                  <p className="text-muted-foreground text-sm mt-1">Top-rated vendors on Make It Sell</p>
                </div>
                <Link href="/stores" className="text-sm text-accent hover:underline font-medium flex items-center gap-1">
                  See all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <FeaturedStores />
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
      `}</style>
    </div>
  );
}

