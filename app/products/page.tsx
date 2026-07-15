"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, RefreshCw, Package, ArrowLeft, MapPin } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import Header from "@/components/Header"
import { useCart } from "@/contexts/CartContext"
import { useNotification } from "@/contexts/NotificationContext"
import { ProductQuickView } from "@/components/ui/product-quick-view"
import { ProductCard } from "@/components/products/ProductCard"
import { useRouter } from "next/navigation"
import { initPersonalizationSync, personalizeProducts, trackProductQuickView, trackSearch } from "@/lib/personalization"

const defaultCategories = [
  { id: "all", name: "All Categories" },
  { id: "Electronics", name: "Electronics" },
  { id: "Fashion", name: "Fashion" },
  { id: "Home & Garden", name: "Home & Garden" },
  { id: "Sports & Outdoors", name: "Sports & Outdoors" },
  { id: "Books", name: "Books" },
  { id: "Toys & Games", name: "Toys & Games" },
  { id: "Health & Beauty", name: "Health & Beauty" },
  { id: "Automotive", name: "Automotive" },
  { id: "Tools", name: "Tools" },
  { id: "Food & Beverages", name: "Food & Beverages" },
]

const CITIES = [
  { id: "all", name: "All Locations" },
  { id: "Lagos", name: "Lagos" },
  { id: "Abuja", name: "Abuja" },
  { id: "Port Harcourt", name: "Port Harcourt" },
  { id: "Ibadan", name: "Ibadan" },
]

interface Product {
  id: string
  name?: string
  title?: string
  description?: string
  price: number
  images: string[]
  category: string
  stock?: number
  vendorId: string
  vendorName: string
  featured: boolean
  status: string
  sales: number
  storeName?: string
  storeId?: string
}

const getCompactPagination = (currentPage: number, totalPages: number): Array<number | string> => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, idx) => idx + 1)
  if (currentPage <= 3) return [1, 2, 3, 4, "ellipsis-right", totalPages]
  if (currentPage >= totalPages - 2) return [1, "ellipsis-left", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [1, "ellipsis-left", currentPage - 1, currentPage, currentPage + 1, "ellipsis-right", totalPages]
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AllProductsPage() {
  const PRODUCTS_SCROLL_KEY = "mis:scroll:products:list:v1"
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedCity, setSelectedCity] = useState("all")
  const [priceRange, setPriceRange] = useState("all")
  const [sortBy, setSortBy] = useState("for-you")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)
  const [showQuickView, setShowQuickView] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const { addItem } = useCart()
  const notification = useNotification()
  const router = useRouter()
  const itemsPerPage = 24
  const lastScrollY = useRef<number | null>(null)

  const saveScrollPosition = () => {
    if (typeof window === "undefined") return
    sessionStorage.setItem(PRODUCTS_SCROLL_KEY, String(window.scrollY))
  }

  const handleBackToStores = () => {
    saveScrollPosition()
    setIsTransitioning(true)
    setTimeout(() => { router.push('/stores') }, 600)
  }

  useEffect(() => {
    const timeout = setTimeout(() => { setDebouncedSearchQuery(searchQuery.trim()) }, 250)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchQuery, selectedCategory, selectedCity, priceRange, sortBy])

  useEffect(() => { void initPersonalizationSync() }, [])

  useEffect(() => {
    if (!debouncedSearchQuery) return
    trackSearch(debouncedSearchQuery, "products")
  }, [debouncedSearchQuery])

  useEffect(() => {
    fetchAllProducts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, selectedCategory, selectedCity, priceRange, sortBy, currentPage])

  const fetchAllProducts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set("limit", String(itemsPerPage))
      params.set("page", String(currentPage))
      params.set("sortBy", sortBy === "for-you" ? "featured" : sortBy)
      if (debouncedSearchQuery) params.set("search", debouncedSearchQuery)
      if (selectedCategory !== "all") params.set("category", selectedCategory)
      if (selectedCity !== "all") params.set("city", selectedCity)
      if (priceRange !== "all") {
        if (priceRange === "0-5000") { params.set("minPrice", "0"); params.set("maxPrice", "5000") }
        else if (priceRange === "5000-20000") { params.set("minPrice", "5000"); params.set("maxPrice", "20000") }
        else if (priceRange === "20000-100000") { params.set("minPrice", "20000"); params.set("maxPrice", "100000") }
        else if (priceRange === "100000+") params.set("minPrice", "100000")
      }
      const response = await fetch(`/api/database/products?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        const productsRaw = data.data || []
        const normalizedProducts = productsRaw.map((prod: Product) => ({
          ...prod,
          storeName: prod.storeName || prod.vendorName || 'Premium Vendor',
          vendorName: prod.vendorName || prod.storeName || 'Premium Vendor',
        }))
        const shouldPersonalize = sortBy === "for-you" && selectedCategory === "all"
        const rankedProducts = shouldPersonalize ? personalizeProducts(normalizedProducts) : normalizedProducts
        setProducts(rankedProducts)
        setTotalProducts(Math.max(0, Number(data?.pagination?.total || 0)))
        setTotalPages(Math.max(1, Number(data?.pagination?.totalPages || 1)))
      } else {
        setProducts([])
        setTotalProducts(0)
        setTotalPages(1)
      }
    } catch {
      setProducts([])
      setTotalProducts(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAllProducts()
    setRefreshing(false)
  }

  const handleAddToCart = useCallback((product: any) => {
    if (typeof window !== 'undefined') lastScrollY.current = window.scrollY
    addItem({
      id: String(product?.id || ""),
      productId: String(product?.id || ""),
      title: product?.title || product?.name || "Product",
      price: Number(product?.price || 0),
      image: product?.images?.[0] || "/placeholder.png",
      vendorId: String(product?.vendorId || ""),
      vendorName: product?.vendorName || "Unknown Vendor",
      maxStock: Number(product?.stock || 100),
    })
    notification.success('Product added to cart', product.title || product.name || 'Added to cart', 3000)
  }, [addItem, notification])

  const handleQuickView = useCallback((product: Product) => {
    setQuickViewProduct(product)
    setShowQuickView(true)
    trackProductQuickView(product)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && lastScrollY.current !== null) {
      window.scrollTo({ top: lastScrollY.current, behavior: 'auto' })
      lastScrollY.current = null
    }
  }, [products])

  useEffect(() => {
    if (loading || typeof window === "undefined") return
    const savedScroll = sessionStorage.getItem(PRODUCTS_SCROLL_KEY)
    if (!savedScroll) return
    const targetScroll = Number(savedScroll)
    if (Number.isNaN(targetScroll)) { sessionStorage.removeItem(PRODUCTS_SCROLL_KEY); return }
    let attempts = 0
    const restore = () => {
      window.scrollTo({ top: targetScroll, behavior: "auto" })
      attempts += 1
      if (attempts < 8 && Math.abs(window.scrollY - targetScroll) > 2) {
        window.requestAnimationFrame(restore)
        return
      }
      sessionStorage.removeItem(PRODUCTS_SCROLL_KEY)
    }
    window.requestAnimationFrame(restore)
  }, [loading])

  const paginationItems = getCompactPagination(currentPage, totalPages)

  return (
    <div className="min-h-screen flex flex-col">
      <style jsx global>{`
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        .page-slide-transition { animation: slideOutRight 0.6s ease-in-out forwards; }
        @keyframes stagger-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .stagger-grid > * { animation: stagger-up 0.45s ease both; }
        .stagger-grid > *:nth-child(1) { animation-delay: 0.02s; }
        .stagger-grid > *:nth-child(2) { animation-delay: 0.05s; }
        .stagger-grid > *:nth-child(3) { animation-delay: 0.08s; }
        .stagger-grid > *:nth-child(4) { animation-delay: 0.11s; }
        .stagger-grid > *:nth-child(5) { animation-delay: 0.14s; }
        .card-lift { transform: translateY(0); will-change: transform, box-shadow; }
        .card-lift:hover { transform: translateY(-3px); }
        @media (prefers-reduced-motion: reduce) {
          .stagger-grid > * { animation: none !important; }
          .card-lift, .card-lift:hover { transform: none !important; }
        }
      `}</style>

      <Header />

      <div className={isTransitioning ? 'page-slide-transition' : ''}>
        <main className="flex-1 container mx-auto px-4 py-6">
          {/* Header strip — kept deliberately compact. Category/listing pages live and die
              on how fast a visitor reaches the product grid; a tall decorative hero here
              just pushes real inventory further below the fold. */}
          <div className="mb-4">
            <button
              type="button"
              onClick={handleBackToStores}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent transition-colors mb-2 -ml-0.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Stores
            </button>

            <nav className="text-xs text-muted-foreground mb-2.5">
              <Link href="/" onClick={saveScrollPosition} className="hover:text-accent transition-colors">Home</Link>
              <span className="mx-1.5">/</span>
              <span className="text-foreground font-medium">Products</span>
            </nav>

            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">All Products</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  <span className="font-semibold text-accent">{totalProducts}</span> products from all our vendors
                </p>
              </div>
              <Button
                onClick={handleRefresh}
                variant="ghost"
                size="sm"
                disabled={refreshing}
                className="text-muted-foreground hover:text-accent hover:bg-accent/5"
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Single toolbar band — one flat surface for every filter control instead of each
              one wearing its own gradient/border treatment. Grouping same-purpose controls
              into one visually uniform unit reduces how much a visitor has to parse before
              acting (Hick's law); the brand color is then reserved for the one thing that
              should pop — the active category and the CTAs — rather than tinting everything
              equally, which drowns out exactly what should stand out (isolation effect). */}
          <div className="mb-6 bg-white border border-neutral-200 rounded-2xl shadow-sm p-3 sm:p-4 space-y-3">
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="inline-flex gap-1.5 min-w-max">
                {defaultCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-full border transition-colors whitespace-nowrap ${
                      selectedCategory === category.id
                        ? "bg-accent text-white border-accent font-medium"
                        : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-neutral-100" />

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="relative sm:col-span-2 md:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-neutral-200 focus-visible:border-accent"
                />
              </div>

              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="bg-white border-neutral-200">
                  <MapPin className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  {CITIES.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger className="bg-white border-neutral-200">
                  <SelectValue placeholder="Price Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Prices</SelectItem>
                  <SelectItem value="0-5000">NGN 0 - NGN 5,000</SelectItem>
                  <SelectItem value="5000-20000">NGN 5,000 - NGN 20,000</SelectItem>
                  <SelectItem value="20000-100000">NGN 20,000 - NGN 100,000</SelectItem>
                  <SelectItem value="100000+">NGN 100,000+</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-white border-neutral-200">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="for-you">For You</SelectItem>
                  <SelectItem value="featured">Featured First</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!loading && totalPages > 1 && (
            <div className="mb-4 flex items-center justify-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>Previous</Button>
              {paginationItems.map((item, idx) =>
                typeof item === "number" ? (
                  <Button key={`product-page-${item}`} variant={item === currentPage ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(item)} className="min-w-9">{item}</Button>
                ) : (
                  <span key={`product-ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground select-none">...</span>
                )
              )}
              <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>Next</Button>
            </div>
          )}

          {/* Products Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6 stagger-grid">
              {[...Array(10)].map((_, i) => (
                <Card key={i} className="border-0 shadow-md overflow-hidden rounded-2xl sm:rounded-3xl h-[280px] sm:h-[350px] md:h-[380px] lg:h-[450px]">
                  <Skeleton className="w-full h-full" />
                </Card>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6 stagger-grid">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  onOpen={(p) => handleQuickView(p as Product)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 sm:py-24">
              <div className="inline-flex p-8 bg-linear-to-br from-accent/20 to-accent/5 rounded-full mb-8 border-4 border-accent/20 shadow-2xl shadow-accent/20">
                <Package className="h-16 w-16 text-accent" />
              </div>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-accent mb-3 sm:mb-4">No products found</h2>
              <p className="text-sm sm:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-md mx-auto leading-relaxed px-4 sm:px-0">
                We couldn&apos;t find any products matching your search criteria. Try adjusting your filters or search terms.
              </p>
              <Button onClick={handleRefresh} size="lg" className="bg-linear-to-r from-accent to-orange-600 hover:from-orange-600 hover:to-accent text-white font-semibold text-sm sm:text-base px-6 sm:px-8 py-5 sm:py-6 rounded-full shadow-2xl shadow-accent/30 hover:scale-105 transition-all">
                <RefreshCw className="h-5 w-5 mr-2" />
                Refresh products
              </Button>
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>Previous</Button>
              {paginationItems.map((item, idx) =>
                typeof item === "number" ? (
                  <Button key={`product-bottom-page-${item}`} variant={item === currentPage ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(item)} className="min-w-9">{item}</Button>
                ) : (
                  <span key={`product-bottom-ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground select-none">...</span>
                )
              )}
              <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>Next</Button>
            </div>
          )}
        </main>
      </div>

      <ProductQuickView
        product={quickViewProduct as any}
        open={showQuickView}
        onClose={() => { setShowQuickView(false); setQuickViewProduct(null) }}
        onAddToCart={handleAddToCart}
        storeName={quickViewProduct?.storeName || quickViewProduct?.vendorName || ''}
      />
    </div>
  )
}
