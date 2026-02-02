"use client"

import React, { useEffect, useState } from "react"
import { ProductQuickView } from "@/components/ui/product-quick-view"
import { useCart } from "@/contexts/CartContext"
import { useSearchParams } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Shield, Users, Truck, Sparkles } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"

function TrendingProducts() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const { addItem } = useCart ? useCart() : { addItem: () => {} }

  useEffect(() => {
    async function fetchTrendingWithStoreNames() {
      try {
        const res = await fetch("/api/database/products?limit=100")
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          // Sort by sales descending, take top 3
          const sorted = [...data.data].sort((a, b) => (b.sales || 0) - (a.sales || 0)).slice(0, 3)
          // Fetch store for each product
          const withStoreNames = await Promise.all(sorted.map(async (product) => {
            let storeName = ''
            let vendorName = ''
            console.log('🔍 TrendingNow: Processing product', product.name, 'vendorId:', product.vendorId)
            try {
              const storeRes = await fetch(`/api/database/stores/${product.vendorId}`)
              const storeData = await storeRes.json()
              console.log('🏪 Store API response:', storeRes.status, storeData)
              if (storeData.success && storeData.data) {
                storeName = storeData.data.storeName || storeData.data.name || ''
                vendorName = storeData.data.storeName || storeData.data.name || ''
                console.log('✅ Store found:', storeName)
              } else {
                console.log('❌ Store not found, trying user fallback...')
                // fallback: try fetching user by vendorId
                const userRes = await fetch(`/api/database/users/${product.vendorId}`)
                const userData = await userRes.json()
                console.log('👤 User API response:', userRes.status, userData)
                if (userData.success && userData.data) {
                  storeName = userData.data.displayName || userData.data.name || (userData.data.email ? userData.data.email.split('@')[0] : '')
                  vendorName = storeName
                  console.log('✅ User found:', storeName)
                } else {
                  console.log('❌ User not found either')
                }
              }
            } catch (err) {
              console.log('💥 Fetch error:', err)
            }
            // fallback: if product.vendorName exists, use it
            if (!storeName && product.vendorName) {
              storeName = product.vendorName
              console.log('📋 Using product vendorName:', storeName)
            }
            if (!vendorName && product.vendorName) vendorName = product.vendorName
            
            // Final fallback: show vendorId if nothing else works
            if (!storeName) {
              storeName = `Store ${product.vendorId.slice(-6)}`
              console.log('🆔 Using vendorId fallback:', storeName)
            }
            if (!vendorName) vendorName = storeName
            
            console.log('🏷️ Final result for', product.name, ':', { storeName, vendorName })
            return { ...product, storeName, vendorName }
          }))
          setProducts(withStoreNames)
        } else {
          setProducts([])
        }
      } catch {
        setProducts([])
      } finally {
        setLoading(false)
      }
    }
    fetchTrendingWithStoreNames()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4 max-w-5xl mx-auto">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-white/60 dark:bg-white/10 rounded-xl p-4 sm:p-6 h-48" />
        ))}
      </div>
    )
  }
  if (!products.length) {
    return <div className="text-center text-muted-foreground">No trending products found.</div>
  }
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4 max-w-5xl mx-auto">
        {products.map((product: any) => (
          <div
            key={product.id}
            className="group hover:shadow-xl hover:shadow-accent/30 shadow-lg shadow-accent/20 transition-all duration-200 hover:scale-105 animate-scale-in hover-lift bg-white/60 dark:bg-white/10 rounded-xl p-4 sm:p-6 flex flex-col items-center text-center cursor-pointer"
            onClick={() => {
              setSelectedProduct(product)
              setQuickViewOpen(true)
            }}
          >
            <img src={product.images?.[0] || "/placeholder.png"} alt={product.title || product.name || "Product"} className="h-20 w-20 sm:h-24 sm:w-24 object-cover rounded-lg mb-3 border-2 border-accent" />
            <h3 className="font-semibold mb-1 text-sm text-neutral-900 dark:text-white line-clamp-1">{product.title || product.name}</h3>
            <p className="text-neutral-700 dark:text-gray-300 text-xs mb-2 line-clamp-1">{product.storeName || product.vendorName || 'Unknown Vendor'}</p>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-accent font-bold text-sm">₦{product.price?.toLocaleString?.() || product.price}</span>
            </div>
            <span className="text-accent font-bold hover:underline text-xs">Shop Now</span>
          </div>
        ))}
      </div>
      <ProductQuickView
        product={selectedProduct}
        open={quickViewOpen}
        onClose={() => {
          setQuickViewOpen(false)
          setSelectedProduct(null)
        }}
        onAddToCart={p => addItem({
          productId: p.id,
          id: p.id,
          title: p.title || p.name || '',
          price: p.price,
          image: p.images?.[0] || '',
          maxStock: p.stock || 100,
          vendorId: p.vendorId,
          vendorName: p.storeName || p.vendorName || (p.vendor?.name ?? 'Unknown Vendor')
        })}
        storeName={selectedProduct?.storeName || selectedProduct?.vendorName || selectedProduct?.vendor?.name || 'Unknown Vendor'}
      />
    </>
  )
}

export default function HomePage() {
  const searchParams = useSearchParams()
  const [showDeletedMessage, setShowDeletedMessage] = useState(false)
  const [showIntro, setShowIntro] = useState(true)
  const [fadeOutIntro, setFadeOutIntro] = useState(false)

  useEffect(() => {
    if (searchParams.get('account_deleted') === 'true') {
      setShowDeletedMessage(true)
      // Hide message after 5 seconds
      setTimeout(() => setShowDeletedMessage(false), 5000)
    }
  }, [searchParams])

  useEffect(() => {
    if (!showIntro) return
    const timer = setTimeout(() => {
      setFadeOutIntro(true)
      setTimeout(() => setShowIntro(false), 700)
    }, 5000)
    return () => clearTimeout(timer)
  }, [showIntro])

  const startFadeOutIntro = () => {
    if (fadeOutIntro) return
    setFadeOutIntro(true)
    setTimeout(() => setShowIntro(false), 700)
  }

  const handleIntroEnd = () => startFadeOutIntro()
  const handleSkip = () => startFadeOutIntro()

  return (
    <div className="min-h-screen flex flex-col relative">
      {showIntro && (
        <div
          className={`fixed inset-0 bg-black flex items-center justify-center overflow-hidden transition-opacity duration-700 z-50 ${fadeOutIntro ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <video
            className="absolute inset-0 w-full h-full object-contain"
            src="/images/MIS AD 1.mp4"
            autoPlay
            muted
            playsInline
            onEnded={handleIntroEnd}
          />
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-8 inset-x-0 flex justify-center z-10">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-sm font-semibold text-white bg-black/60 border border-white/30 rounded-full backdrop-blur-md hover:bg-white/10 transition cursor-pointer"
            >
              Skip intro
            </button>
          </div>
        </div>
      )}

      <div className={`min-h-screen flex flex-col transition-opacity duration-700 ${showIntro ? 'opacity-0' : 'opacity-100'} bg-gradient-to-br from-accent/30 via-white to-accent/20 dark:from-black dark:via-gray-900 dark:to-black relative overflow-hidden`}>
       
        <Header />
        <main className="flex-1 relative z-20">
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
          <section className="relative min-h-screen flex items-center justify-center pt-0">
            <div className="container mx-auto px-4 sm:px-8 flex flex-col items-center justify-center text-center gap-4 sm:gap-6">
                <img src="/images/Home.png" alt="MakeItSell Logo" className="mx-auto mb-2 h-28 w-28 sm:h-36 sm:w-36 rounded-xl shadow-lg bg-white/80 p-2" />
              <span className="text-accent font-bold text-lg sm:text-xl tracking-wide">WHERE EVERYTHING SELLS!</span>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-neutral-900 dark:text-white mb-2">Find What You Love,<br /><span className="text-accent">From Real People</span></h1>
              <p className="text-base sm:text-lg md:text-xl text-neutral-700 dark:text-gray-200 max-w-2xl mx-auto mb-2">Nigeria’s most trusted marketplace for unique products, unbeatable prices, and real customer support.</p>
              <form className="flex w-full max-w-md mx-auto bg-white/90 dark:bg-white/20 rounded-full shadow-lg overflow-hidden border border-accent/30 focus-within:ring-2 focus-within:ring-accent">
                <input type="text" placeholder="What are you looking for today?" className="flex-1 px-4 py-2 text-neutral-900 dark:text-white bg-transparent outline-none placeholder:text-neutral-500 dark:placeholder:text-gray-300" aria-label="Search products" />
                <button type="submit" className="rounded-none rounded-r-full bg-accent hover:bg-accent/90 text-white px-4">Search</button>
              </form>
              <a href="/stores" className="inline-block mt-2 px-8 py-3 text-lg font-semibold rounded-full shadow-2xl bg-accent hover:bg-accent/90 text-white transition-all duration-300">Start Shopping</a>
            </div>
          </section>

          {/* FEATURES SECTION */}
          <section className="py-10 sm:py-14">
            <div className="container mx-auto px-2 sm:px-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
                <div className="flex flex-col items-center text-center p-6 rounded-xl bg-white/60 dark:bg-white/10 shadow border border-white/10">
                  <Shield className="h-8 w-8 text-accent mb-2" />
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">Secure Payment</h3>
                  <p className="text-neutral-700 dark:text-gray-300 text-xs">Protected transactions</p>
                </div>
                <div className="flex flex-col items-center text-center p-6 rounded-xl bg-white/60 dark:bg-white/10 shadow border border-white/10">
                  <Users className="h-8 w-8 text-accent mb-2" />
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">Trusted Vendors</h3>
                  <p className="text-neutral-700 dark:text-gray-300 text-xs">Verified sellers nationwide</p>
                </div>
                <div className="flex flex-col items-center text-center p-6 rounded-xl bg-white/60 dark:bg-white/10 shadow border border-white/10">
                  <Truck className="h-8 w-8 text-accent mb-2" />
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">Fast Delivery</h3>
                  <p className="text-neutral-700 dark:text-gray-300 text-xs">Nationwide shipping</p>
                </div>
                <div className="flex flex-col items-center text-center p-6 rounded-xl bg-white/60 dark:bg-white/10 shadow border border-white/10">
                  <Sparkles className="h-8 w-8 text-accent mb-2" />
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">24/7 Support</h3>
                  <p className="text-neutral-700 dark:text-gray-300 text-xs">Intelligent customer assistance</p>
                </div>
              </div>
            </div>
          </section>

          {/* CATEGORY SECTION */}
          <section className="py-8 sm:py-12">
            <div className="container mx-auto px-2 sm:px-4">
              <div className="text-center mb-6 sm:mb-8 animate-fade-in">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-balance text-accent">Shop by Category</h2>
                <p className="text-muted-foreground mt-1 sm:mt-2 text-xs sm:text-sm">Find exactly what you're looking for</p>
              </div>
              <div className="relative overflow-hidden py-4">
                <div 
                  className="flex gap-4 animate-scroll-x overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing select-none scroll-smooth" 
                  style={{
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                    width: 'calc(200% + 1rem)'
                  }}
                  onTouchStart={(e) => {
                    const container = e.currentTarget;
                    container.style.animationPlayState = 'paused';
                    container.dataset.isInteracting = 'true';
                  }}
                  onTouchEnd={(e) => {
                    const container = e.currentTarget;
                    container.dataset.isInteracting = 'false';
                    setTimeout(() => {
                      if (container.dataset.isInteracting === 'false') {
                        container.style.animationPlayState = 'running';
                      }
                    }, 2000);
                  }}
                  onScroll={(e) => {
                    const container = e.currentTarget;
                    container.style.animationPlayState = 'paused';
                    clearTimeout(parseInt(container.dataset.scrollTimeout || '0'));
                    container.dataset.scrollTimeout = setTimeout(() => {
                      if (container.dataset.isInteracting !== 'true') {
                        container.style.animationPlayState = 'running';
                      }
                    }, 3000).toString();
                  }}
                  onMouseDown={(e) => {
                    const container = e.currentTarget;
                    container.style.animationPlayState = 'paused';
                    container.dataset.isDown = 'true';
                    container.dataset.startX = (e.pageX - container.offsetLeft).toString();
                    container.dataset.scrollLeft = container.scrollLeft.toString();
                    container.dataset.isInteracting = 'true';
                  }}
                  onMouseMove={(e) => {
                    const container = e.currentTarget;
                    if (container.dataset.isDown !== 'true') return;
                    e.preventDefault();
                    const x = e.pageX - container.offsetLeft;
                    const startX = parseFloat(container.dataset.startX || '0');
                    const walk = (x - startX) * 2;
                    container.scrollLeft = parseFloat(container.dataset.scrollLeft || '0') - walk;
                  }}
                  onMouseUp={(e) => {
                    const container = e.currentTarget;
                    container.dataset.isDown = 'false';
                    container.dataset.isInteracting = 'false';
                    setTimeout(() => {
                      if (container.dataset.isInteracting === 'false') {
                        container.style.animationPlayState = 'running';
                      }
                    }, 2000);
                  }}
                  onMouseLeave={(e) => {
                    const container = e.currentTarget;
                    container.dataset.isDown = 'false';
                    container.dataset.isInteracting = 'false';
                    setTimeout(() => {
                      if (container.dataset.isInteracting === 'false') {
                        container.style.animationPlayState = 'running';
                      }
                    }, 2000);
                  }}
                >
                                    <a href="/category/electronics" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Shield className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Electronics</span>
                  </a>
                  <a href="/category/fashion" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Users className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Fashion</span>
                  </a>
                  <a href="/category/home-garden" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Truck className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Home & Garden</span>
                  </a>
                  <a href="/category/sports-outdoors" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Sparkles className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Sports & Outdoors</span>
                  </a>
                  <a href="/category/books" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Shield className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Books</span>
                  </a>
                  <a href="/category/toys-games" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Users className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Toys & Games</span>
                  </a>
                  <a href="/category/health-beauty" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Truck className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Health & Beauty</span>
                  </a>
                  <a href="/category/automotive" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Sparkles className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Automotive</span>
                  </a>
                  <a href="/category/tools" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Shield className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Tools</span>
                  </a>
                  <a href="/category/food-beverages" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Users className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Food & Beverages</span>
                  </a>
                  {/* Duplicate set for infinite scroll */}
                  <a href="/category/electronics" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Shield className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Electronics</span>
                  </a>
                  <a href="/category/fashion" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Users className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Fashion</span>
                  </a>
                  <a href="/category/home-garden" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Truck className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Home & Garden</span>
                  </a>
                  <a href="/category/sports-outdoors" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Sparkles className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Sports & Outdoors</span>
                  </a>
                  <a href="/category/books" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Shield className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Books</span>
                  </a>
                  <a href="/category/toys-games" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Users className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Toys & Games</span>
                  </a>
                  <a href="/category/health-beauty" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Truck className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Health & Beauty</span>
                  </a>
                  <a href="/category/automotive" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Sparkles className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Automotive</span>
                  </a>
                  <a href="/category/tools" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Shield className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Tools</span>
                  </a>
                  <a href="/category/food-beverages" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}>
                    <Users className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Food & Beverages</span>
                  </a>
                  <a href="/category/toys" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0">
                    <Sparkles className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Toys</span>
                  </a>
                  <a href="/category/music" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0">
                    <Truck className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-neutral-900 dark:text-white text-sm">Music</span>
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* TRENDING PRODUCTS SECTION */}
          <section className="py-10 sm:py-14">
            <div className="container mx-auto px-2 sm:px-4">
              <div className="text-center mb-6 sm:mb-8 animate-fade-in">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-balance text-accent">Trending Now</h2>
                <p className="text-muted-foreground mt-1 sm:mt-2 text-xs sm:text-sm">Our highest sold products, loved by customers</p>
              </div>
              <TrendingProducts />
            </div>
          </section>
      

        </main>
       
      </div>
    </div>
  )
}
