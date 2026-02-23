"use client"

import React, { useState, useEffect, useRef, useLayoutEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, RefreshCw, ShoppingCart, Heart, Package, TrendingUp, Eye, ArrowLeft } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import Header from "@/components/Header"
import { useCart } from "@/contexts/CartContext"
import { useNotification } from "@/contexts/NotificationContext"
import { ProductQuickView } from "@/components/ui/product-quick-view"
import { useIsMobile } from "@/hooks/use-mobile"
import { useRouter } from "next/navigation"

// Static categories - fallback if API fails
const defaultCategories = [
  { id: "all", name: "All Categories" },
  { id: "electronics", name: "Electronics" },
  { id: "fashion", name: "Fashion" },
  { id: "home", name: "Home & Garden" },
  { id: "beauty", name: "Beauty & Personal Care" },
  { id: "sports", name: "Sports & Outdoors" },
  { id: "automotive", name: "Automotive" },
  { id: "books", name: "Books & Media" },
  { id: "food", name: "Food & Beverages" },
  { id: "other", name: "Other" },
]

interface Product {
  id: string
  name?: string
  title?: string
  description: string
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

interface ProductsByCategory {
  [category: string]: Product[]
}

export default function AllProductsPage() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [priceRange, setPriceRange] = useState("all")
  const [sortBy, setSortBy] = useState("featured")
  const [refreshing, setRefreshing] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)
  const [showQuickView, setShowQuickView] = useState(false)
  const [imageBrightness, setImageBrightness] = useState<{ [key: string]: 'light' | 'dark' }>({})
  const [isTransitioning, setIsTransitioning] = useState(false)
  const { addItem } = useCart()
  const notification = useNotification()
  const isMobile = useIsMobile()
  const router = useRouter()

  const handleBackToStores = () => {
    setIsTransitioning(true)
    setTimeout(() => {
      window.location.href = '/stores'
    }, 600)
  }

  useEffect(() => {
    fetchAllProducts()
  }, [])

  const fetchAllProducts = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/database/products?limit=200&t=${Date.now()}`)
      const data = await response.json()
      
      if (data.success) {
        setProducts(data.data || [])
      } else {
        console.error("Failed to fetch products:", data.error)
        setProducts([])
      }
    } catch (error) {
      console.error("Error fetching products:", error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAllProducts()
    setRefreshing(false)
  }

  // --- Scroll position preservation ---
  const lastScrollY = useRef<number | null>(null)

  const handleAddToCart = (product: Product) => {
    if (typeof window !== 'undefined') {
      lastScrollY.current = window.scrollY
    }
    addItem({
      id: product.id,
      productId: product.id,
      title: product.title || product.name || "Product",
      price: product.price,
      image: product.images?.[0] || "/placeholder.png",
      vendorId: product.vendorId,
      vendorName: product.vendorName || "Unknown Vendor",
      maxStock: product.stock || 100,
    })
    notification.success(
      'Product added to cart',
      product.title || product.name || 'Added to cart',
      3000
    )
  }

  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && lastScrollY.current !== null) {
      window.scrollTo({ top: lastScrollY.current, behavior: 'auto' })
      lastScrollY.current = null
    }
  })

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch = searchQuery === "" || 
      (product.title || product.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.category || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.vendorName || "").toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = selectedCategory === "all" || 
      (product.category || "").toLowerCase() === selectedCategory.toLowerCase()
    
    let matchesPrice = true
    if (priceRange !== "all") {
      const price = product.price
      if (priceRange === "0-5000") matchesPrice = price <= 5000
      else if (priceRange === "5000-20000") matchesPrice = price > 5000 && price <= 20000
      else if (priceRange === "20000-100000") matchesPrice = price > 20000 && price <= 100000
      else if (priceRange === "100000+") matchesPrice = price > 100000
    }
    
    return matchesSearch && matchesCategory && matchesPrice
  })

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "price-low":
        return a.price - b.price
      case "price-high":
        return b.price - a.price
      case "newest":
        return new Date(b.sales || 0).getTime() - new Date(a.sales || 0).getTime()
      case "popular":
        return (b.sales || 0) - (a.sales || 0)
      case "name":
        return (a.title || a.name || "").localeCompare(b.title || b.name || "")
      default:
        return b.featured ? 1 : -1
    }
  })

  // Group products by category
  const productsByCategory: ProductsByCategory = sortedProducts.reduce((acc, product) => {
    const category = product.category || "other"
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(product)
    return acc
  }, {} as ProductsByCategory)

  // Image Cycler Component for Product Cards
  const ImageCycler = ({ product }: { product: Product }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [isHovered, setIsHovered] = useState(false)
    const intervalRef = React.useRef<NodeJS.Timeout | null>(null)
    const isElectronics = product.category?.toLowerCase().includes('electronics')

    // Handle hover start
    const handleMouseEnter = () => {
      setIsHovered(true)
      if (product.images && product.images.length > 1) {
        intervalRef.current = setInterval(() => {
          setCurrentImageIndex((prevIndex) => {
            return prevIndex + 1 >= product.images.length ? 0 : prevIndex + 1
          })
        }, 1000)
      }
    }

    // Handle hover end
    const handleMouseLeave = () => {
      setIsHovered(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setCurrentImageIndex(0) // Reset to first image
    }

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }, [])

    if (!product.images || product.images.length === 0) {
      return (
        <div 
          className="absolute inset-0 w-full h-full"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <img
            src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"
            alt={(product.title || product.name || 'Product') as string}
            className={`absolute inset-0 w-full h-full ${
              isElectronics ? 'object-contain bg-white' : 'object-cover'
            } group-hover:scale-110 transition-transform duration-500 ${(product.stock ?? 0) === 0 ? 'grayscale' : ''}`}
          />
        </div>
      )
    }

    return (
      <div 
        className="absolute inset-0 w-full h-full"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Show only one image at a time with multiple layers for fade effect */}
        {product.images.map((image, index) => (
          <img
            key={index}
            src={image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"}
            alt={(product.title || product.name || 'Product') as string}
            className={`absolute inset-0 w-full h-full ${
              isElectronics ? 'object-contain bg-white' : 'object-cover'
            } group-hover:scale-110 transition-all duration-500 ${(product.stock ?? 0) === 0 ? 'grayscale' : ''} ${
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

  const ProductCard = React.memo(({ product }: { product: Product }) => {
    const isElectronics = product.category?.toLowerCase().includes('electronics')
    const productBrightness = imageBrightness[product.id] || 'dark'

    const detectImageBrightness = React.useCallback((imageUrl: string, productId: string) => {
      if (typeof window === 'undefined') return
      
      // Skip if brightness already detected for this product
      if (imageBrightness[productId]) return
      
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          const sampleSize = Math.floor(data.length / 1000) * 4
          const startPixelIndex = Math.floor(data.length * 0.1)
          
          let r = 0, g = 0, b = 0, totalPixels = 0
          
          for (let i = startPixelIndex; i < data.length; i += sampleSize) {
            r += data[i]
            g += data[i + 1] 
            b += data[i + 2]
            totalPixels++
          }
          
          const avgBrightness = (r + g + b) / (totalPixels * 3)
          setImageBrightness(prev => ({
            ...prev,
            [productId]: avgBrightness > 128 ? 'light' : 'dark'
          }))
        } catch (error) {
          console.error('Error detecting brightness:', error)
        }
      }
      img.src = imageUrl
    }, [])

    React.useEffect(() => {
      if (product.images?.[0] && !imageBrightness[product.id]) {
        detectImageBrightness(product.images[0], product.id)
      }
    }, [product.id, detectImageBrightness])

    const formatCurrency = (price: number) => {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN'
      }).format(price)
    }

    return (
      <Card className="border-0 shadow-md overflow-hidden relative h-[280px] sm:h-[350px] md:h-[380px] lg:h-[450px] hover:shadow-xl transition-all duration-500 hover:-translate-y-2 rounded-2xl sm:rounded-3xl active:scale-95 md:active:scale-100 group">
        {/* Image Container with Group Hover */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Full Card Image Background with Cycling Animation */}
          <ImageCycler product={product} />
          
          {/* Out of Stock Red Tape Overlay */}
          {(product.stock ?? 0) === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <div className="bg-red-600 text-white px-4 sm:px-8 py-1 sm:py-2 transform -rotate-45 font-bold text-xs sm:text-sm shadow-lg">
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
            {(product.stock ?? 0) === 0 && (
              <Badge variant="secondary" className="bg-gray-600 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                Out of Stock
              </Badge>
            )}
          </div>
          
          {/* Action Buttons - Like button visible on hover */}
          <div className="absolute top-2 sm:top-3 right-2 sm:right-3 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex gap-1 sm:gap-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-white/90 backdrop-blur-sm hover:bg-white hover:scale-110 active:scale-95 transition-all h-8 w-8 p-0 sm:h-9 sm:w-9"
              onClick={(e) => {
                e.stopPropagation()
                /* Add to wishlist */
              }}
            >
              <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          </div>
        </div>
        
        {/* Frosted Glass Bubble Content */}
        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-2.5 md:p-3 backdrop-blur-xl bg-accent/10 border-t border-white/30 rounded-t-2xl sm:rounded-t-3xl z-30 space-y-1 gap-1 sm:gap-2">
          <Badge
            variant="outline"
            role="button"
            className={`inline-flex w-full text-[10px] sm:text-xs md:text-sm font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 shadow cursor-pointer hover:opacity-90 transition min-h-5 sm:min-h-6 items-center justify-center text-center leading-tight ${
              productBrightness === 'light' ? 'bg-accent text-white' : 'bg-accent text-white'
            }`}
            onClick={(e) => {
              e.stopPropagation()
              setQuickViewProduct(product)
              setShowQuickView(true)
            }}
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
            <Badge variant="outline" className={`text-[9px] sm:text-[10px] md:text-xs backdrop-blur-sm border-white/50 px-1 sm:px-1.5 py-0 ${
              productBrightness === 'light' ? 'text-white bg-accent' : 'text-white bg-accent'
            }`}>
              {product.category}
            </Badge>
            
            <Badge
              variant="outline"
              className={`text-[9px] sm:text-[10px] md:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 backdrop-blur-sm ${
                productBrightness === 'light' ? 'bg-white/80 text-accent' : 'bg-white/70 text-accent'
              }`}
            >
              {formatCurrency(product.price)}
            </Badge>
          </div>
          
          <Button 
            type="button"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAddToCart(product);
            }}
            disabled={(product.stock ?? 0) === 0}
            className={`w-full h-6 sm:h-7 md:h-8 text-[10px] sm:text-xs md:text-xs backdrop-blur-sm hover:scale-105 active:scale-95 transition-all hover:shadow-lg flex items-center justify-center gap-0 ${
              productBrightness === 'light' 
                ? 'bg-white/20 hover:bg-white/80 text-accent' 
                : 'bg-white/50 hover:bg-white text-black'
            }`}
          >
            <img src="/images/logo3.png" alt="Add" className="w-6 sm:w-7 md:w-8 h-6 sm:h-7 md:h-8 -mt-1 sm:-mt-2" />
            <span className="leading-none hidden sm:inline">Add</span>
          </Button>
        </div>
      </Card>
    )
  })

  return (
    <div className="min-h-screen flex flex-col">
      <style jsx global>{`
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }

        .page-slide-transition {
          animation: slideOutRight 0.6s ease-in-out forwards;
        }
      `}</style>

      <Header />

      <div className={isTransitioning ? 'page-slide-transition' : ''}>
        <main className="flex-1 container mx-auto px-4 py-8">
          {/* Combined Glass Pane: Back Button, Header, and Filters */}
          <div className="mb-8 p-6 md:p-8 bg-linear-to-br from-accent/5 via-accent/15 to-accent/50 backdrop-blur-2xl rounded-3xl border border-accent/30 shadow-2xl shadow-accent/20 hover:shadow-3xl hover:shadow-accent/30 transition-all duration-500">
            
            {/* Back to Stores Button */}
            <div className="mb-6">
              <Button
                onClick={handleBackToStores}
                variant="outline"
                className="border-accent/50 bg-accent/10 hover:bg-accent text-white hover:text-white transition-all backdrop-blur-sm shadow-lg hover:shadow-xl"
              >
                <ArrowLeft className="w-4 h-4 mr-2 text-white" />
                Back to Stores
              </Button>
            </div>

            {/* Header Section */}
            <div className="mb-4 sm:mb-8 animate-fade-in">
              <nav className="text-xs sm:text-sm text-accent mb-2 sm:mb-4">
                <Link href="/" className="hover:text-accent text-accent dark:text-white">
                  Home
                </Link>
                <span className="mx-2 text-accent dark:text-white">/</span>
                <span className="text-accent dark:text-white">Products</span>
              </nav>
              
              <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-between gap-4 mb-6">
                <div className="text-center md:text-left">
                  <h1
                    className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-2 text-accent dark:text-white tracking-tight"
                    style={{
                      fontFamily: 'Inter, Poppins, Arial, Helvetica, sans-serif',
                      textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))'
                    }}
                  >
                    ALL PRODUCTS
                  </h1>
                  <p className="text-accent dark:text-white text-xs sm:text-base md:text-lg">
                    Discover amazing products from all our vendors
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm md:text-base ">
                  <div className="bg-accent/20 backdrop-blur-sm px-4 py-2 rounded-full border border-accent/40 shadow-lg">
                    <span className="font-bold text-accent dark:text-white drop-shadow-sm">{filteredProducts.length}</span>
                    <span className="text-accent dark:text-white ml-1">Products</span>
                  </div>
                  <Button
                    onClick={handleRefresh}
                    variant="outline"
                    size="sm"
                    disabled={refreshing}
                    className="border-accent/50 bg-accent/10 hover:bg-accent hover:text-white transition-all backdrop-blur-sm shadow-lg hover:shadow-xl"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-accent/60" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-accent/5 border-accent/30 focus:border-accent/50 backdrop-blur-sm"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="bg-accent/5 border-accent/30 focus:border-accent/50 backdrop-blur-sm">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {defaultCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger className="bg-accent/5 border-accent/30 focus:border-accent/50 backdrop-blur-sm">
                  <SelectValue placeholder="Price Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Prices</SelectItem>
                  <SelectItem value="0-5000">₦0 - ₦5,000</SelectItem>
                  <SelectItem value="5000-20000">₦5,000 - ₦20,000</SelectItem>
                  <SelectItem value="20000-100000">₦20,000 - ₦100,000</SelectItem>
                  <SelectItem value="100000+">₦100,000+</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-accent/5 border-accent/30 focus:border-accent/50 backdrop-blur-sm">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
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

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="border-0 shadow-lg overflow-hidden">
                <Skeleton className="w-full h-[200px] sm:h-[250px]" />
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24" style={{ fontFamily: '"Bebas Neue", "Impact", sans-serif' }}>
            <div className="inline-flex p-8 bg-linear-to-br from-accent/20 to-orange-500/20 rounded-full mb-8 border-4 border-accent/20 shadow-2xl shadow-accent/20 animate-pulse">
              <Package className="h-16 w-16 text-accent" />
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-accent mb-4">NO PRODUCTS FOUND</h2>
            <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
              We couldn't find any products matching your search criteria. Try adjusting your filters or search terms.
            </p>
            <Button onClick={handleRefresh} size="lg" className="bg-linear-to-r from-accent to-orange-600 hover:from-orange-600 hover:to-accent text-white font-black text-xl px-8 py-6 rounded-full shadow-2xl shadow-accent/30 hover:scale-105 transition-all uppercase tracking-wider">
              <RefreshCw className="h-5 w-5 mr-2" />
              REFRESH
            </Button>
          </div>
        )}
      </main>
      </div>

      <ProductQuickView 
        product={quickViewProduct as any}
        open={showQuickView}
        onClose={() => {
          setShowQuickView(false)
          setQuickViewProduct(null)
        }}
        onAddToCart={handleAddToCart}
      />

    </div>
  )
}