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
import { useCart } from "@/contexts/CartContext"
import { useNotification } from "@/contexts/NotificationContext"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Shield, Users, Truck, Sparkles, ArrowRight } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"

function TrendingProducts() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const { addItem } = useCart ? useCart() : { addItem: () => {} }
  const notification = useNotification ? useNotification() : null
  

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
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4 max-w-5xl mx-auto">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse bg-white/60 dark:bg-white/10 rounded-2xl sm:rounded-3xl h-[280px] sm:h-[350px] md:h-[380px] lg:h-[450px]" />
        ))}
      </div>
    )
  }
  if (!products.length) {
    return <div className="text-center text-muted-foreground">No trending products found.</div>
  }
  return (
    <>
      {/* Responsive: triangle only on mobile, grid on sm+ */}
      <div className="max-w-5xl mx-auto">
        {/* Mobile: triangle layout */}
        <div className="block sm:hidden">
          <div className="grid grid-cols-2 gap-2">
            {products.slice(0, 2).map((product: any) => (
              <Card 
                key={product.id} 
                className="border-0 shadow-md overflow-hidden relative h-[280px] hover:shadow-xl transition-all duration-500 hover:-translate-y-2 rounded-2xl active:scale-95 cursor-pointer"
                onClick={() => {
                  setSelectedProduct(product)
                  setQuickViewOpen(true)
                }}
              >
                {/* ...existing code for card content... */}
                <div className="group absolute inset-0 overflow-hidden">
                  <img 
                    src={product.images?.[0] || "/placeholder.png"} 
                    alt={product.title ? `Product: ${product.title}` : product.name ? `Product: ${product.name}` : "Product image"} 
                    className={`absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${product.stock === 0 ? 'grayscale' : ''}`}
                  />
                  {/* ...existing code for overlays and badges... */}
                  {/* Out of Stock Red Tape Overlay */}
                  {product.stock === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                      <div className="bg-red-600 text-white px-4 py-1 transform -rotate-45 font-bold text-xs shadow-lg">
                        OUT OF STOCK
                      </div>
                    </div>
                  )}
                  {/* Product Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                    {product.featured && (
                      <Badge className="bg-yellow-500 text-black font-semibold text-[10px] px-1.5 py-0.5">
                        <svg className="inline w-3 h-3 text-yellow-400 fill-current animate-pulse mr-0.5" viewBox="0 0 24 24">
                          <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                        </svg> 
                        Featured
                      </Badge>
                    )}
                    {(product.stock ?? 0) < 10 && (product.stock ?? 0) > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                        Only {product.stock} left
                      </Badge>
                    )}
                    {product.stock === 0 && (
                      <Badge variant="secondary" className="bg-gray-600 text-[10px] px-1.5 py-0.5">
                        Out of Stock
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Frosted Glass Bubble Content */}
                <div className="absolute bottom-0 left-0 right-0 p-2 backdrop-blur-xl bg-accent/10 border-t border-white/30 rounded-t-2xl z-30 space-y-1 gap-1">
                  <Badge
                    variant="outline"
                    className="inline-flex w-full text-[10px] font-semibold px-2 py-1 rounded-full border-white/40 shadow bg-accent text-white hover:opacity-90 transition min-h-[20px] items-center justify-center text-center leading-tight"
                    style={{
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      hyphens: 'auto',
                      lineHeight: '1.2'
                    }}
                  >
                    <span className="line-clamp-2">
                      {product.title || product.name}
                    </span>
                  </Badge>
                  <div className="flex items-center justify-between gap-1">
                    <Badge variant="outline" className="text-[9px] backdrop-blur-sm border-white/50 px-1 py-0 text-white bg-accent">
                      {product.storeName || product.vendorName || 'Store'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-semibold px-2 py-1 rounded-full border-white/40 backdrop-blur-sm bg-white/70 text-accent"
                    >
                      ₦{product.price?.toLocaleString?.() || product.price}
                    </Badge>
                  </div>
                  {/* Sizes Display */}
                  {product.hasSizeOptions && product.sizes && product.sizes.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {product.sizes.slice(0, 5).map((size: string, idx: number) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-[8px] px-1.5 py-0 border-white/40 bg-white/50 text-accent"
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
                    className="w-full h-6 text-[10px] backdrop-blur-sm hover:scale-105 active:scale-95 transition-all hover:shadow-lg flex items-center justify-center gap-0 bg-white/50 hover:bg-white text-black"
                  >
                    <img src="/images/logo3.png" alt="Add to cart icon" className="w-6 h-6 -mt-1" />
                    <span className="leading-none hidden sm:inline">Add</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          {products[2] && (
            <div className="flex justify-center mt-2">
              <div className="w-1/2">
                <Card 
                  key={products[2].id} 
                  className="border-0 shadow-md overflow-hidden relative h-[280px] hover:shadow-xl transition-all duration-500 hover:-translate-y-2 rounded-2xl active:scale-95 cursor-pointer mx-auto"
                  onClick={() => {
                    setSelectedProduct(products[2])
                    setQuickViewOpen(true)
                  }}
                >
                  {/* ...existing code for card content... */}
                  <div className="group absolute inset-0 overflow-hidden">
                    <img 
                      src={products[2].images?.[0] || "/placeholder.png"} 
                      alt={products[2].title ? `Product: ${products[2].title}` : products[2].name ? `Product: ${products[2].name}` : "Product image"} 
                      className={`absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${products[2].stock === 0 ? 'grayscale' : ''}`}
                    />
                    {/* ...existing code for overlays and badges... */}
                    {/* Out of Stock Red Tape Overlay */}
                    {products[2].stock === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                        <div className="bg-red-600 text-white px-4 md:px-8 py-1 md:py-2 transform -rotate-45 font-bold text-xs md:text-sm shadow-lg">
                          OUT OF STOCK
                        </div>
                      </div>
                    )}
                    {/* Product Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                      {products[2].featured && (
                        <Badge className="bg-yellow-500 text-black font-semibold text-[10px] px-1.5 py-0.5">
                          <svg className="inline w-3 h-3 text-yellow-400 fill-current animate-pulse mr-1" viewBox="0 0 24 24">
                            <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                          </svg> 
                          Featured
                        </Badge>
                      )}
                      {(products[2].stock ?? 0) < 10 && (products[2].stock ?? 0) > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                          Only {products[2].stock} left
                        </Badge>
                      )}
                      {products[2].stock === 0 && (
                        <Badge variant="secondary" className="bg-gray-600 text-[10px] px-1.5 py-0.5">
                          Out of Stock
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Frosted Glass Bubble Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 backdrop-blur-xl bg-accent/10 border-t border-white/30 rounded-t-2xl z-30 space-y-1 gap-1">
                    <Badge
                      variant="outline"
                      className="inline-flex w-full text-[10px] font-semibold px-2 py-1 rounded-full border-white/40 shadow bg-accent text-white hover:opacity-90 transition min-h-[24px] items-center justify-center text-center leading-tight"
                      style={{
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        hyphens: 'auto',
                        lineHeight: '1.2'
                      }}
                    >
                      <span className="line-clamp-1">
                        {products[2].title || products[2].name}
                      </span>
                    </Badge>
                    <div className="flex items-center justify-between gap-1">
                      <Badge variant="outline" className="text-[9px] backdrop-blur-sm border-white/50 px-1 py-0 text-white bg-accent">
                        {products[2].storeName || products[2].vendorName || 'Store'}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[9px] font-semibold px-2.5 py-1 rounded-full border-white/40 backdrop-blur-sm bg-white/70 text-accent"
                      >
                        ₦{products[2].price?.toLocaleString?.() || products[2].price}
                      </Badge>
                    </div>
                    {/* Sizes Display */}
                    {products[2].hasSizeOptions && products[2].sizes && products[2].sizes.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {products[2].sizes.slice(0, 5).map((size: string, idx: number) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-[8px] px-1.5 py-0 border-white/40 bg-white/50 text-accent"
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
                          productId: products[2].id,
                          id: products[2].id,
                          title: products[2].title || products[2].name || '',
                          price: products[2].price,
                          image: products[2].images?.[0] || '',
                          maxStock: products[2].stock || 100,
                          vendorId: products[2].vendorId,
                          vendorName: products[2].storeName || products[2].vendorName || 'Unknown Vendor'
                        })
                        if (notification) {
                          notification.success(
                            'Product added to cart',
                            products[2].title || products[2].name || 'Added to cart',
                            3000
                          )
                        }
                      }}
                      disabled={products[2].stock === 0}
                      className="w-full h-7 md:h-8 text-xs backdrop-blur-sm hover:scale-105 active:scale-95 transition-all hover:shadow-lg flex items-center justify-center gap-0 bg-white/50 hover:bg-white text-black"
                    >
                      <img src="/images/logo3.png" alt="Add to cart icon" className="w-7 md:w-8 h-7 md:h-8 -mt-2" />
                      <span className="leading-none hidden sm:inline">Add</span>
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
        {/* Desktop/tablet: normal grid */}
        <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {products.map((product: any) => (
            <Card 
              key={product.id} 
              className="border-0 shadow-md overflow-hidden relative h-[350px] md:h-[380px] lg:h-[450px] hover:shadow-xl transition-all duration-500 hover:-translate-y-2 rounded-2xl sm:rounded-3xl active:scale-95 md:active:scale-100 cursor-pointer"
              onClick={() => {
                setSelectedProduct(product)
                setQuickViewOpen(true)
              }}
            >
              {/* ...existing code for card content... */}
              <div className="group absolute inset-0 overflow-hidden">
                <img 
                  src={product.images?.[0] || "/placeholder.png"} 
                  alt={product.title ? `Product: ${product.title}` : product.name ? `Product: ${product.name}` : "Product image"} 
                  className={`absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${product.stock === 0 ? 'grayscale' : ''}`}
                />
                {/* ...existing code for overlays and badges... */}
                {/* Out of Stock Red Tape Overlay */}
                {product.stock === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                    <div className="bg-red-600 text-white px-4 md:px-8 py-1 md:py-2 transform -rotate-45 font-bold text-xs md:text-sm shadow-lg">
                      OUT OF STOCK
                    </div>
                  </div>
                )}
                {/* Product Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                  {product.featured && (
                    <Badge className="bg-yellow-500 text-black font-semibold text-xs px-2 py-0.5">
                      <svg className="inline w-4 h-4 text-yellow-400 fill-current animate-pulse mr-1" viewBox="0 0 24 24">
                        <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                      </svg> 
                      Featured
                    </Badge>
                  )}
                  {(product.stock ?? 0) < 10 && (product.stock ?? 0) > 0 && (
                    <Badge variant="destructive" className="text-xs px-2 py-0.5">
                      Only {product.stock} left
                    </Badge>
                  )}
                  {product.stock === 0 && (
                    <Badge variant="secondary" className="bg-gray-600 text-xs px-2 py-0.5">
                      Out of Stock
                    </Badge>
                  )}
                </div>
              </div>
              {/* Frosted Glass Bubble Content */}
              <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3 backdrop-blur-xl bg-accent/10 border-t border-white/30 rounded-t-2xl sm:rounded-t-3xl z-30 space-y-1 gap-1 md:gap-2">
                <Badge
                  variant="outline"
                  className="inline-flex w-full text-xs md:text-sm font-semibold px-2 md:px-2.5 py-1 rounded-full border-white/40 shadow bg-accent text-white hover:opacity-90 transition min-h-[24px] items-center justify-center text-center leading-tight"
                  style={{
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    hyphens: 'auto',
                    lineHeight: '1.2'
                  }}
                >
                  <span className="line-clamp-1">
                    {product.title || product.name}
                  </span>
                </Badge>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-xs backdrop-blur-sm border-white/50 px-1.5 py-0 text-white bg-accent">
                    {product.storeName || product.vendorName || 'Store'}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs font-semibold px-2.5 py-1 rounded-full border-white/40 backdrop-blur-sm bg-white/70 text-accent"
                  >
                    ₦{product.price?.toLocaleString?.() || product.price}
                  </Badge>
                </div>
                {/* Sizes Display */}
                {product.hasSizeOptions && product.sizes && product.sizes.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {product.sizes.slice(0, 5).map((size: string, idx: number) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 border-white/40 bg-white/50 text-accent"
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
                  }}
                  disabled={product.stock === 0}
                  className="w-full h-7 md:h-8 text-xs backdrop-blur-sm hover:scale-105 active:scale-95 transition-all hover:shadow-lg flex items-center justify-center gap-0 bg-white/50 hover:bg-white text-black"
                >
                  <img src="/images/logo3.png" alt="Add to cart icon" className="w-7 md:w-8 h-7 md:h-8 -mt-2" />
                  <span className="leading-none hidden sm:inline">Add</span>
                </Button>
              </div>
            </Card>
          ))}
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
function HeroButtons() {
  // Instead of local state, dispatch a custom event to parent
  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-2">
        <button
          className="inline-block px-8 py-3 text-lg font-semibold rounded-full shadow-2xl bg-accent text-white border-2 border-accent transition-all duration-300 hover:bg-accent/10 hover:text-accent hover:border-accent flex items-center gap-2 group overflow-hidden relative"
          onClick={e => {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('slideOutNavigate', { detail: { target: '/stores' } }));
          }}
          style={{ minWidth: 200 }}
        >
          Start Shopping
          <span
            className={
              "inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none animate-bounce-x relative"
            }
            style={{ top: '4px' }}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-white group-hover:text-accent">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </button>
        <button
          className="inline-block px-8 py-3 text-lg font-semibold rounded-full shadow-2xl border-2 border-accent text-accent bg-white hover:bg-accent/10 transition-all duration-300 flex items-center gap-2 group overflow-hidden relative"
          onClick={e => {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('slideOutNavigate', { detail: { target: '/services' } }));
          }}
          style={{ minWidth: 200 }}
        >
          Browse Services
          <span
            className={
              "inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none animate-bounce-x relative"
            }
            style={{ top: '4px' }}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-accent group-hover:text-white">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </button>
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

  // Listen for slide trigger from HeroButtons
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail && e.detail.target) {
        setSlideTarget(e.detail.target);
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
        window.location.href = slideTarget;
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [slideOut, slideTarget]);

  return (
    <div className="min-h-screen flex flex-col relative">
      <div
        className={`min-h-screen flex flex-col transition-opacity duration-1000 ${fadeIn ? 'opacity-100' : 'opacity-0'} animated-gradient-bg main-slide-anim${slideOut ? ' slide-out-right' : ''}`}
        style={{ willChange: 'transform, opacity' }}
      >
        <Header homeBg={true} />
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
            <div className="container mx-auto px-4 sm:px-8">
              <div className="flex flex-col-reverse items-center justify-center text-center gap-4 sm:gap-6 md:flex-row md:text-left md:items-stretch md:gap-0">
                {/* Left: Texts */}
                <div className="flex-1 flex flex-col justify-center md:justify-center md:items-start md:text-left gap-4 sm:gap-6 md:pr-8 lg:pr-16">
                  <span className="text-accent font-bold text-lg sm:text-xl tracking-wide">
                    WHERE EVERYTHING SELLS!
                  </span>
                  <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-neutral-900 dark:text-white mb-2">
                    Find What You Love,
                    <br />
                    <span className="text-accent">From Real People</span>
                  </h1>
                  <p className="text-base sm:text-lg md:text-xl text-neutral-700 dark:text-gray-200 max-w-2xl mb-2">
                    Nigeria’s most trusted marketplace for unique products, unbeatable prices, and real customer support.
                  </p>
                  <form
                    className="flex w-full max-w-md bg-white/90 dark:bg-white/20 rounded-full shadow-lg overflow-hidden border border-accent/30 focus-within:ring-2 focus-within:ring-accent"
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
                      className="flex-1 px-4 py-2 text-neutral-900 dark:text-white bg-transparent outline-none placeholder:text-neutral-500 dark:placeholder:text-gray-300"
                      aria-label="Search products"
                    />
                    <button
                      type="submit"
                      className="rounded-none rounded-r-full bg-accent hover:bg-accent/90 text-white px-4"
                    >
                      Search
                    </button>
                  </form>
                  <HeroButtons />
                </div>
                {/* Right: Image */}
                <div className="flex-1 flex items-center justify-center md:justify-end md:items-center">
                  <img
                    src="/hp.png"
                    alt="MakeItSell Logo"
                    className="h-80 w-80 sm:h-96 sm:w-96 md:h-[420px] md:w-[420px] lg:h-[520px] lg:w-[520px] xl:h-[600px] xl:w-[600px] rounded-xl p-2 object-cover"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </div>
              </div>
            </div>
          </section>
          {/* FEATURES SECTION */}
          <section className="py-10 sm:py-14">
            <div className="container mx-auto px-2 sm:px-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
                <div className="feature-card-loop flex flex-col items-center text-center p-6 rounded-xl bg-white/60 dark:bg-white/10 shadow border border-white/10" style={{ animationDelay: '0ms' }}>
                  <Shield className="h-8 w-8 text-accent mb-2" />
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">Secure Payment</h3>
                  <p className="text-neutral-700 dark:text-gray-300 text-xs">Protected transactions</p>
                </div>
                <div className="feature-card-loop flex flex-col items-center text-center p-6 rounded-xl bg-white/60 dark:bg-white/10 shadow border border-white/10" style={{ animationDelay: '200ms' }}>
                  <Users className="h-8 w-8 text-accent mb-2" />
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">Trusted Vendors</h3>
                  <p className="text-neutral-700 dark:text-gray-300 text-xs">Verified sellers nationwide</p>
                </div>
                <div className="feature-card-loop flex flex-col items-center text-center p-6 rounded-xl bg-white/60 dark:bg-white/10 shadow border border-white/10" style={{ animationDelay: '400ms' }}>
                  <Truck className="h-8 w-8 text-accent mb-2" />
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">Fast Delivery</h3>
                  <p className="text-neutral-700 dark:text-gray-300 text-xs">Nationwide shipping</p>
                </div>
                <div className="feature-card-loop flex flex-col items-center text-center p-6 rounded-xl bg-white/60 dark:bg-white/10 shadow border border-white/10" style={{ animationDelay: '600ms' }}>
                  <Sparkles className="h-8 w-8 text-accent mb-2" />
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">24/7 Support</h3>
                  <p className="text-neutral-700 dark:text-gray-300 text-xs">Intelligent customer assistance</p>
                </div>
              </div>
            </div>
          </section>
           {/* CATEGORY SECTION */} <section className="py-8 sm:py-12"> 
            <div className="container mx-auto px-2 sm:px-4"> 
              <div className="text-center mb-6 sm:mb-8 animate-fade-in"> 
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-balance text-accent">Shop by Category</h2>
                 <p className="text-muted-foreground mt-1 sm:mt-2 text-xs sm:text-sm">Find exactly what you're looking for</p>
                  </div>
                   <div className="relative overflow-hidden py-4">
                     <div className="flex gap-4 animate-scroll-x overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing select-none scroll-smooth" 
                     style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', width: 'calc(200% + 1rem)' }} onTouchStart={(e) => { const container = e.currentTarget; container.style.animationPlayState = 'paused'; container.dataset.isInteracting = 'true'; }} 
                     onTouchEnd={(e) => { const container = e.currentTarget; container.dataset.isInteracting = 'false'; setTimeout(() => { if (container.dataset.isInteracting === 'false') { container.style.animationPlayState = 'running'; } }, 2000); }} 
                     onScroll={(e) => { const container = e.currentTarget; container.style.animationPlayState = 'paused'; clearTimeout(parseInt(container.dataset.scrollTimeout || '0')); 
                      container.dataset.scrollTimeout = setTimeout(() => { if (container.dataset.isInteracting !== 'true') { container.style.animationPlayState = 'running'; } }, 3000).toString(); }} 
                      onMouseDown={(e) => { const container = e.currentTarget; container.style.animationPlayState = 'paused'; container.dataset.isDown = 'true'; container.dataset.startX = (e.pageX - container.offsetLeft).toString();
                         container.dataset.scrollLeft = container.scrollLeft.toString(); container.dataset.isInteracting = 'true'; }} onMouseMove={(e) => { const container = e.currentTarget; if (container.dataset.isDown !== 'true') return; e.preventDefault(); const x = e.pageX - container.offsetLeft; 
                          const startX = parseFloat(container.dataset.startX || '0'); const walk = (x - startX) * 2; container.scrollLeft = parseFloat(container.dataset.scrollLeft || '0') - walk; }} onMouseUp={(e) => { const container = e.currentTarget; container.dataset.isDown = 'false'; container.dataset.isInteracting = 'false'; setTimeout(() => { 
                            if (container.dataset.isInteracting === 'false') { container.style.animationPlayState = 'running'; } }, 2000); }} onMouseLeave={(e) => { const container = e.currentTarget; container.dataset.isDown = 'false'; container.dataset.isInteracting = 'false'; setTimeout(() => { 
                              if (container.dataset.isInteracting === 'false') { container.style.animationPlayState = 'running'; } }, 2000); }} > <a href="/category/electronics" 
                              className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0"
                               style={{scrollSnapAlign: 'start'}}> <Shield className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> 
                               <span className="font-medium text-neutral-900 dark:text-white text-sm">Electronics</span> </a> <a href="/category/fashion" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" 
                               style={{scrollSnapAlign: 'start'}}> 
                               <Users className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Fashion</span> </a> <a href="/category/home-garden" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" 
                               style={{scrollSnapAlign: 'start'}}> <Truck className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Home & Garden</span> </a> <a href="/category/sports-outdoors" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" 
                               style={{scrollSnapAlign: 'start'}}> <Sparkles className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Sports & Outdoors</span> </a> <a href="/category/books" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}> <Shield className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Books</span> </a> <a href="/category/toys-games" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" 
                               style={{scrollSnapAlign: 'start'}}> <Users className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Toys & Games</span> </a> <a href="/category/health-beauty" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}> <Truck className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Health & Beauty</span> </a> <a href="/category/automotive" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" 
                               style={{scrollSnapAlign: 'start'}}> <Sparkles className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Automotive</span> </a> <a href="/category/tools" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}> <Shield className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Tools</span> </a> <a href="/category/food-beverages" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}> <Users className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Food & Beverages</span> </a> {/* Duplicate set for infinite scroll */} <a href="/category/electronics" 
                                className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" 
                                style={{scrollSnapAlign: 'start'}}> <Shield className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Electronics</span> </a> <a href="/category/fashion" 
                                className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" 
                                style={{scrollSnapAlign: 'start'}}> <Users className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Fashion</span> </a> <a href="/category/home-garden" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}> <Truck className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Home & Garden</span> </a> <a href="/category/sports-outdoors" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}> <Sparkles className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Sports & Outdoors</span> </a>
                                 <a href="/category/books" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}> <Shield className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Books</span> </a> <a href="/category/toys-games" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}> <Users className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Toys & Games</span> </a> <a href="/category/health-beauty" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}> <Truck className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> 
                                 <span className="font-medium text-neutral-900 dark:text-white text-sm">Health & Beauty</span> </a> <a href="/category/automotive" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}> <Sparkles className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Automotive</span> </a> <a href="/category/tools" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}> <Shield className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Tools</span> </a> <a href="/category/food-beverages" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0" style={{scrollSnapAlign: 'start'}}> <Users 
                                 className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Food & Beverages</span> </a> <a href="/category/toys" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0"> <Sparkles className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Toys</span> </a> <a href="/category/music" className="group hover:shadow-2xl hover:shadow-accent/30 shadow-xl shadow-accent/20 hover:-translate-y-2 transition-all duration-300 hover:scale-105 animate-scale-in hover-lift bg-white/80 dark:bg-white/10 rounded-xl p-6 flex flex-col items-center text-center border border-white/20 backdrop-blur-sm min-w-36 h-28 flex-shrink-0"> <Truck className="h-6 w-6 text-accent mb-2 group-hover:scale-110 transition-transform duration-300" /> <span className="font-medium text-neutral-900 dark:text-white text-sm">Music</span> </a> </div> </div> <div className="text-center mt-6 sm:mt-8"> <Link href="/categories"> <Button className="group bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-white px-6 py-3 rounded-lg transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"> View All Categories <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" /> 
                                 </Button>
                                  </Link>
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
      <style jsx global>{`
        .main-slide-anim {
          transition: transform 0.6s cubic-bezier(.7,1.7,.7,1), opacity 0.6s;
        }
        .slide-out-right {
          transform: translateX(100vw);
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
          background: linear-gradient(120deg, var(--accent) 0%, #fff 50%, var(--accent) 100%);
          background-size: 200% 200%;
          animation: gradientWave 12s ease-in-out infinite;
        }
        .dark .animated-gradient-bg {
          background: linear-gradient(120deg, #000 0%, #1a2236 60%, #000 100%);
          background-size: 200% 200%;
          animation: gradientWave 12s ease-in-out infinite;
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
