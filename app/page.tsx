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
import Footer from "@/components/Footer"
import { Shield, Users, Truck, Sparkles, ArrowRight, Smartphone, ShoppingBag, Sparkles as Beauty, HomeIcon, Settings, CarFront, UserCheck, Coffee, Verified, Clock, Banknote, Camera, Briefcase, Wrench, Palette, Dumbbell, GraduationCap, Scissors, Laptop } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"

function TrendingProducts() {
  const [products, setProducts] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
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

  const getCategoryIcon = (category: string) => {
    switch ((category || '').toLowerCase()) {
      case "photography":
        return <Camera className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
      case "consulting":
        return <Briefcase className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
      case "repairs":
        return <Wrench className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
      case "design":
        return <Palette className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
      case "fitness":
        return <Dumbbell className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
      case "education":
        return <GraduationCap className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
      case "beauty":
        return <Scissors className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
      case "cleaning":
        return <Sparkles className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
      case "tech":
        return <Laptop className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
      default:
        return <Settings className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
    }
  }

  // Image Cycler Component for Product Cards
  const ImageCycler = ({ product }: { product: any }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [isHovered, setIsHovered] = useState(false)

    useEffect(() => {
      if (!isHovered || !product.images || product.images.length <= 1) {
        return
      }

      const interval = setInterval(() => {
        setCurrentImageIndex((prevIndex) => {
          return prevIndex + 1 >= product.images.length ? 0 : prevIndex + 1
        })
      }, 2000) // Change image every 2 seconds

      return () => clearInterval(interval)
    }, [isHovered, product.images])

    // Reset to first image when hover ends
    useEffect(() => {
      if (!isHovered) {
        setCurrentImageIndex(0)
      }
    }, [isHovered])

    if (!product.images || product.images.length === 0) {
      return (
        <img
          src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"
          alt={product.title ? `Product: ${product.title}` : product.name ? `Product: ${product.name}` : "Product image"}
          className={`absolute inset-0 w-full h-full ${product.category?.toLowerCase() === 'electronics' ? 'object-contain bg-white' : 'object-cover'} group-hover:scale-110 transition-transform duration-500 ${product.stock === 0 ? 'grayscale' : ''}`}
        />
      )
    }

    return (
      <div 
        className="absolute inset-0 w-full h-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Show only one image at a time with multiple layers for fade effect */}
        {product.images.map((image: string, index: number) => (
          <img
            key={index}
            src={image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"}
            alt={product.title ? `Product: ${product.title}` : product.name ? `Product: ${product.name}` : "Product image"}
            className={`absolute inset-0 w-full h-full ${product.category?.toLowerCase() === 'electronics' ? 'object-contain bg-white' : 'object-cover'} group-hover:scale-110 transition-all duration-500 ${product.stock === 0 ? 'grayscale' : ''} ${
              index === currentImageIndex 
                ? 'opacity-100' 
                : 'opacity-0'
            }`}
            style={{ 
              transitionProperty: 'opacity, transform', 
              transitionDuration: '500ms, 500ms',
              transitionTimingFunction: 'ease-in-out, ease-out'
            }}
          />
        ))}
      </div>
    )
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

  if (loading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4 md:gap-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={`product-${i}`} className="animate-pulse bg-white/60 rounded-2xl sm:rounded-3xl h-[280px] sm:h-[350px] md:h-[380px] lg:h-[450px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={`service-${i}`} className="animate-pulse bg-white/60 rounded-2xl h-[160px]" />
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
        <div>
          <div className="mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg md:text-xl font-bold text-neutral-900">Top 5 Products</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4 md:gap-6">
            {products.map((product: any) => (
          <Card 
            key={product.id} 
            className="border-0 shadow-md overflow-hidden relative h-[280px] sm:h-[350px] md:h-[380px] lg:h-[450px] hover:shadow-xl transition-all duration-500 hover:-translate-y-2 rounded-2xl sm:rounded-3xl active:scale-95 md:active:scale-100 cursor-pointer"
            onClick={() => {
              setSelectedProduct(product)
              setQuickViewOpen(true)
            }}
          >
            <div className="group absolute inset-0 overflow-hidden">
              {/* Full Card Image Background with Cycling Animation */}
              <ImageCycler product={product} />
              
              {/* Out of Stock Red Tape Overlay */}
              {product.stock === 0 && (
                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                  <div className="bg-red-600 text-white px-4 py-1 transform -rotate-45 font-bold text-xs shadow-lg">
                    OUT OF STOCK
                  </div>
                </div>
              )}
              {/* Product Badges */}
              <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1 z-10">
                {product.featured && (
                  <Badge className="bg-yellow-500 text-black font-semibold text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                    <svg className="inline w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 fill-current animate-pulse mr-0.5 sm:mr-1" viewBox="0 0 24 24">
                      <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                    </svg> 
                    Featured
                  </Badge>
                )}
                {(product.stock ?? 0) < 10 && (product.stock ?? 0) > 0 && (
                  <Badge variant="destructive" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                    Only {product.stock} left
                  </Badge>
                )}
                {product.stock === 0 && (
                  <Badge variant="secondary" className="bg-gray-600 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                    Out of Stock
                  </Badge>
                )}
              </div>
            </div>
            {/* Frosted Glass Bubble Content */}
            <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-2.5 md:p-3 backdrop-blur-xl bg-accent/10 border-t border-white/30 rounded-t-2xl sm:rounded-t-3xl z-30 space-y-1 gap-1 sm:gap-2">
              <Badge
                variant="outline"
                className="inline-flex w-full text-[10px] sm:text-xs md:text-sm font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 shadow bg-accent text-white hover:opacity-90 transition min-h-[20px] sm:min-h-[24px] items-center justify-center text-center leading-tight"
                style={{
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  hyphens: 'auto',
                  lineHeight: '1.2'
                }}
              >
                <span className="line-clamp-2 sm:line-clamp-1">
                  {product.title || product.name}
                </span>
              </Badge>
              <div className="flex items-center justify-between gap-1 sm:gap-2">
                <Badge variant="outline" className="text-[9px] sm:text-[10px] md:text-xs backdrop-blur-sm border-white/50 px-1 sm:px-1.5 py-0 text-white bg-accent">
                  {product.storeName || product.vendorName || 'Store'}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[9px] sm:text-[10px] md:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 backdrop-blur-sm bg-white/70 text-accent"
                >
                  NGN {product.price?.toLocaleString?.() || product.price}
                </Badge>
              </div>
              {/* Sizes Display */}
              {product.hasSizeOptions && product.sizes && product.sizes.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {product.sizes.slice(0, 5).map((size: string, idx: number) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="text-[8px] sm:text-[9px] md:text-[10px] px-1 sm:px-1.5 py-0 border-white/40 bg-white/50 text-accent"
                    >
                      {size}
                    </Badge>
                  ))}
                </div>
              )}
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
                className="w-full h-6 sm:h-7 md:h-8 text-[10px] sm:text-xs md:text-xs backdrop-blur-sm hover:scale-105 active:scale-95 transition-all hover:shadow-lg flex items-center justify-center gap-0 bg-white/50 hover:bg-white text-black"
              >
                <img src="/images/logo3.png" alt="Add to cart icon" className="w-6 sm:w-7 md:w-8 h-6 sm:h-7 md:h-8 -mt-1 sm:-mt-2" />
                <span className="leading-none text-accent">Add to cart</span>
              </Button>
            </div>
          </Card>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg md:text-xl font-bold text-neutral-900">Top 5 Services Booked</h3>
          </div>
          {services.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
              {services.map((service: any) => {
                const serviceName = service.title || service.name || service.serviceTitle || 'Service'
                const serviceId = service.id || service._id

                return (
                <Card
                  key={serviceId || serviceName}
                  className="h-full p-0 gap-0 hover:shadow-2xl hover:shadow-accent/40 hover:scale-[1.02] transition-all duration-300 group overflow-hidden border-none rounded-[2.25rem] relative"
                  style={{ fontFamily: '"Montserrat", "Inter", system-ui, sans-serif' }}
                >
                  <div className="aspect-[9/16] relative overflow-hidden rounded-[2.25rem]">
                    {service.images && service.images.length > 0 ? (
                      <img
                        src={service.images[0]}
                        alt={serviceName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-linear-to-br from-accent/90 via-orange-500/90 to-red-600/90">
                        <svg className="h-12 w-12 sm:h-20 sm:w-20 text-white drop-shadow-lg animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-linear-to-b rounded-[2.25rem] from-black/20 via-transparent via-50% to-black/90" />

                    <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-20">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/20 backdrop-blur-md border-3 sm:border-4 border-white overflow-hidden shadow-2xl ring-3 sm:ring-4 ring-white/30 group-hover:ring-white/50 transition-all group-hover:scale-110">
                        <div className="w-full h-full flex items-center justify-center">
                          {getCategoryIcon(service.category || '')}
                        </div>
                      </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 z-10 backdrop-blur-md bg-black/20 rounded-[2.25rem] border-t border-white/10 p-2 sm:p-4">
                      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-1 sm:mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs sm:text-lg md:text-xl font-bold tracking-tight mb-0.5 sm:mb-1 text-white drop-shadow-lg leading-tight wrap-break-word whitespace-normal">
                            {serviceName}
                          </h3>
                          {(service.providerName || service.vendorName) && (
                            <div className="flex items-center gap-0.5 text-[7px] sm:text-xs font-medium text-white/90 tracking-wide mb-1 sm:mb-2">
                              <Verified className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                              <span className="leading-tight wrap-break-word whitespace-normal">{service.providerName || service.vendorName}</span>
                            </div>
                          )}

                          <Badge variant="outline" className="w-fit text-[7px] sm:text-[10px] font-semibold py-0.5 px-1.5 sm:px-2 h-4 sm:h-5 tracking-wide border-2 border-white/40 bg-white/10 text-white backdrop-blur-sm">
                            {service.category || 'Service'}
                          </Badge>
                        </div>

                        <div
                          onClick={() => {
                            if (!serviceId) return
                            window.dispatchEvent(new CustomEvent('slideOutNavigate', { detail: { target: `/service/${serviceId}` } }))
                          }}
                          className="shrink-0 w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-110 hover:bg-accent hover:text-white transition-all cursor-pointer group/arrow"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent group-hover/arrow:text-white">
                            <path d="M5 12h14"/>
                            <path d="m12 5 7 7-7 7"/>
                          </svg>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] font-medium text-white/80 tracking-wide">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{service.duration || 'Flexible'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Banknote className="h-3 w-3" />
                          <span>{getServiceDisplayPrice(service)}</span>
                        </div>
                      </div>
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
    <div className="min-h-screen flex flex-col relative">
      <div
        className={`min-h-screen flex flex-col transition-opacity duration-1000 ${fadeIn ? 'opacity-100' : 'opacity-0'} animated-gradient-bg main-slide-anim${slideOut ? (slideDirection === 'left' ? ' slide-out-left' : ' slide-out-right') : ''}`}
        style={{ willChange: 'transform, opacity' }}
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
          <section className="relative min-h-screen flex items-center justify-center mt-0 md:-mt-20 overflow-hidden">
            <div className="container mx-auto px-4 sm:px-8 max-w-[1600px]">
              <div className="flex flex-col-reverse items-center justify-center text-center gap-1 sm:gap-4 md:flex-row md:text-left md:items-center md:gap-0">
                {/* Left: Texts */}
                <div className="w-full md:w-[40%] flex flex-col justify-center md:justify-center md:items-start md:text-left gap-4 sm:gap-6 -mt-4 sm:-mt-2 md:mt-0">
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
                {/* Right: Image */}
                <div className="w-full md:w-[60%] flex items-center justify-center md:justify-start md:items-center">
                  <img
                    src="/MISHG.png"
                    alt="MakeItSell Logo"
                    className="w-[clamp(250px,82vw,340px)] h-auto sm:w-[76vw] sm:h-[80vw] md:w-[108%] md:h-auto lg:w-[112%] xl:w-[115%] md:max-w-none rounded-xl object-contain md:p-0 p-1 md:-ml-8 lg:-ml-12 xl:-ml-14"
                  />
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
        .animated-gradient-bg {
          position: relative;
          background: #fff;
        }
@keyframes gradientWave {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

