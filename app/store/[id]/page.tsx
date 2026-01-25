"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Header from "@/components/Header"
import "./store-mobile-fix.css"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Clock, Truck, MapPin, Search, Heart, ShoppingCart, ArrowLeft, Shield, Users, Package, MessageCircle, Verified, Store as StoreIcon, TrendingUp, Calendar, Eye, Filter } from "lucide-react"
import Link from "next/link"
import { useCart } from "@/contexts/CartContext"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { ProductQuickView } from "@/components/ui/product-quick-view"

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
  hasColorOptions?: boolean
  hasSizeOptions?: boolean
  colors?: string[]
  sizes?: string[]
  colorImages?: { [key: string]: string[] }
  createdAt: string
  updatedAt: string
}

interface Store {
  id: string
  storeName: string
  storeDescription: string
  storeImage: string
  category: string
  vendorId: string
  isOpen: boolean
  deliveryTime?: string
  address?: string
  phone?: string
  email?: string
  // Optional computed fields that may not exist in database
  totalProducts?: number
  totalSales?: number
  memberSince?: string
  responseTime?: string
  vendorName?: string
  vendorEmail?: string
  images?: string[]
  shippingInfo?: {
    freeShippingThreshold: number
    estimatedDelivery: string
    shippingCost: number
  }
}

export default function StorePage() {
  const params = useParams()
  const router = useRouter()
  const storeId = params.id as string
  const [mounted, setMounted] = useState(false)
  const [store, setStore] = useState<Store | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("featured")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [priceRange, setPriceRange] = useState("all")
  const [activeTab, setActiveTab] = useState("products")
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [imageBrightness, setImageBrightness] = useState<{ [key: string]: 'light' | 'dark' }>({})
  const { addItem } = useCart()
  const { user } = useAuth()
  const { toast } = useToast()

  // Function to detect image brightness - focuses on bottom portion where frosted glass is
  const detectImageBrightness = (imageUrl: string, productId: string) => {
    const img = new Image()
    img.crossOrigin = "Anonymous"
    img.src = imageUrl
    
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        const width = canvas.width
        const height = canvas.height
        
        // Sample only the bottom 25% of the image where frosted glass sits
        const bottomStartRow = Math.floor(height * 0.75)
        const startPixelIndex = (bottomStartRow * width) * 4
        const endPixelIndex = imageData.data.length
        
        let brightPixels = 0
        let mediumBrightPixels = 0
        let totalPixels = 0
        let r = 0, g = 0, b = 0
        
        // Sample every 2nd pixel for better accuracy
        for (let i = startPixelIndex; i < endPixelIndex; i += 8) {
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          totalPixels++
          
          const pixelBrightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
          
          // Count very bright pixels (white/very light) - threshold 180
          if (pixelBrightness > 180) {
            brightPixels++
          }
          // Count medium-bright pixels (light colors) - threshold 140
          if (pixelBrightness > 140) {
            mediumBrightPixels++
          }
        }
        
        const avgR = r / totalPixels
        const avgG = g / totalPixels
        const avgB = b / totalPixels
        
        // Calculate average brightness
        const avgBrightness = (avgR * 0.299 + avgG * 0.587 + avgB * 0.114)
        
        // Calculate percentages
        const brightPixelPercentage = (brightPixels / totalPixels) * 100
        const mediumBrightPercentage = (mediumBrightPixels / totalPixels) * 100
        
        // Consider it "light" if any of these conditions are true:
        // 1. Average brightness is over 145
        // 2. 15%+ of pixels are very bright (white)
        // 3. 35%+ of pixels are medium-bright (light colors)
        const isLight = avgBrightness > 145 || brightPixelPercentage > 15 || mediumBrightPercentage > 35
        
        setImageBrightness(prev => ({
          ...prev,
          [productId]: isLight ? 'light' : 'dark'
        }))
      } catch (e) {
        // If CORS error or other issue, default to dark
        setImageBrightness(prev => ({
          ...prev,
          [productId]: 'dark'
        }))
      }
    }
    
    img.onerror = () => {
      setImageBrightness(prev => ({
        ...prev,
        [productId]: 'dark'
      }))
    }
  }

  useEffect(() => {
    setMounted(true)
    fetchStoreData()
  }, [storeId])

  const fetchStoreData = async () => {
    setLoading(true)
    try {
      // Fetch store data using API
      const storeResponse = await fetch(`/api/database/stores/${storeId}`)
      const storeResult = await storeResponse.json()
      
      if (storeResult.success) {
        setStore(storeResult.data)
        
        // Fetch products for this store using the vendor ID from the store data
        const productsResponse = await fetch(`/api/database/products?vendorId=${storeResult.data.vendorId}`)
        const productsResult = await productsResponse.json()
        
        if (productsResult.success) {
          setProducts(productsResult.data)
          setFilteredProducts(productsResult.data)
          
          // Detect brightness for each product image
          productsResult.data.forEach((product: Product) => {
            if (product.images?.[0]) {
              detectImageBrightness(product.images[0], product.id)
            }
          })
        } else {
          console.error("Failed to fetch products:", productsResult.error)
        }

        // Check if user is following this store
        if (user) {
          checkFollowStatus(storeId, user.uid)
        }
      } else {
        console.error("Failed to fetch store:", storeResult.error)
      }
    } catch (error) {
      console.error("Error fetching store data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Check if user is following the store
  const checkFollowStatus = async (storeId: string, customerId: string) => {
    try {
      const response = await fetch(`/api/store/follow?storeId=${storeId}&customerId=${customerId}`)
      const result = await response.json()
      
      if (result.success) {
        setIsFollowing(result.isFollowing)
      }
    } catch (error) {
      console.error('Error checking follow status:', error)
    }
  }

  // Handle follow/unfollow action
  const handleFollowToggle = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to follow stores.",
        variant: "destructive"
      })
      return
    }

    if (!store) return

    setFollowLoading(true)
    try {
      const response = await fetch('/api/store/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId: store.id,
          vendorId: store.vendorId,
          customerId: user.uid,
          customerName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
          action: isFollowing ? 'unfollow' : 'follow'
        })
      })

      const result = await response.json()
      if (result.success) {
        setIsFollowing(result.isFollowing)
        toast({
          title: result.isFollowing ? "Following Store!" : "Unfollowed Store",
          description: result.isFollowing 
            ? `You're now following ${store.storeName}. You'll get updates on new products and deals.`
            : `You've unfollowed ${store.storeName}.`,
          variant: "default"
        })
      } else {
        toast({
          title: "Action Failed",
          description: result.error || "Something went wrong. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
      toast({
        title: "Network Error",
        description: "Please check your connection and try again.",
        variant: "destructive"
      })
    } finally {
      setFollowLoading(false)
    }
  }

  useEffect(() => {
    if (!products.length) return
    
    let filtered = [...products]
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(product =>
        (product.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(product => product.category === categoryFilter)
    }
    
    // Price range filter
    if (priceRange !== "all") {
      const [min, max] = priceRange.split("-").map(Number)
      if (max) {
        filtered = filtered.filter(product => product.price >= min && product.price <= max)
      } else {
        filtered = filtered.filter(product => product.price >= min)
      }
    }
    
    // Sort products
    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => a.price - b.price)
        break
      case "price-high":
        filtered.sort((a, b) => b.price - a.price)
        break
      case "newest":
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case "popular":
        filtered.sort((a, b) => b.sales - a.sales)
        break
      default:
        // Keep original order for featured
        break
    }
    
    setFilteredProducts(filtered)
  }, [products, searchQuery, sortBy, categoryFilter, priceRange])

  const handleAddToCart = (product: Product) => {
    // Safety check to ensure product has required fields (id and title or name)
    if (!product || !product.id || !(product.title || product.name)) {
      console.error('Cannot add invalid product to cart:', product)
      return
    }

    addItem({
      productId: product.id,
      id: product.id,
      title: product.title || product.name || '',
      price: product.price,
      image: product.images?.[0] || '',
      maxStock: product.stock || 100,
      vendorId: product.vendorId,
      vendorName: product.vendorName || (product as any).vendor?.name || 'Unknown Vendor'
    })
  }

  const formatCurrency = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(price)
  }

  const getUniqueCategories = () => {
    const categories = [...new Set(products.map(p => p.category))]
    return categories
  }

  const handleBackToStores = () => {
    setIsTransitioning(true)
    setTimeout(() => {
      router.push('/stores')
    }, 600) // Duration matches the CSS animation
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-80 bg-gray-200 rounded-lg"></div>
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-12 bg-gray-200 rounded w-full"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-80 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 container mx-auto px-4 py-8 text-center">
          <div className="max-w-md mx-auto">
            <StoreIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-2xl font-bold mb-4">Store Not Found</h1>
            <p className="text-muted-foreground mb-6">The store you're looking for doesn't exist or has been removed.</p>
            <Link href="/stores">
              <Button className="hover:bg-accent/80 hover:scale-105 transition-all hover:shadow-lg">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Stores
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
          animation: slideOutRight 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
      
      <div className={isTransitioning ? 'page-slide-transition' : ''}>
      <Header />
      
      {/* Store Header with Modern Design */}
      <div className="relative w-full h-112 md:h-96 overflow-hidden">
        {/* Background/Profile Card Image with Gradient Overlay */}
        <div className="absolute inset-0">
          <img
            src={
              (store as any).profileImage
                || (products[0]?.images?.[0])
                || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=600&fit=crop"
            }
            alt={store.storeName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/20" />
        </div>
        
        {/* Navigation */}
        <div className="absolute top-6 left-6 z-10 store-back-btn-mobile">
          <Button 
            variant="outline" 
            className="bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all"
            onClick={handleBackToStores}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Stores
          </Button>
        </div>
        {/* Store Information */}
        <div className="absolute bottom-0 left-0 right-0 p-8 text-white z-10">
          <div className="container mx-auto">
            <div className="flex flex-col lg:flex-row items-start lg:items-end gap-6 store-header-mobile-fix">
              {/* Store Avatar (Logo) and Store Name beside each other on mobile */}
              <div className="flex flex-row items-center gap-3 lg:flex-col lg:items-start">
                <Avatar className="w-16 h-16 border-4 border-white/20 backdrop-blur-sm store-logo-mobile">
                  <AvatarImage src={store.storeImage} alt={store.storeName} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {store.storeName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold">{store.storeName}</h1>
                    <Badge variant="secondary" className="bg-green-600/80 text-white border-0">
                      <Verified className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                    {store.isOpen && (
                      <Badge variant="secondary" className="bg-blue-600/80 text-white border-0">
                        <Clock className="w-3 h-3 mr-1" />
                        Open Now
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {/* Store Details */}
              <div className="flex-1">
                
                <p className="text-xl text-gray-200 mb-4 max-w-2xl">{store.storeDescription}</p>
                
                {/* Store Stats */}
                <div className="flex flex-wrap items-center gap-6 text-gray-300">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    <span>({store.totalProducts || products.length || 0} products)</span>
                  </div>
                  
                  <Separator orientation="vertical" className="h-6 bg-white/20" />
                  
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>Lagos, Nigeria</span>
                  </div>
                  
                  <Separator orientation="vertical" className="h-6 bg-white/20" />
                  
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    <span>Responds within {store.responseTime || '1 hour'}</span>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button variant="outline" className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contact Seller
                </Button>
                <Button 
                  className={isFollowing ? "bg-green-600 hover:bg-green-700 hover:scale-105 transition-all" : "bg-primary hover:bg-primary/90 hover:scale-105 transition-all"}
                  onClick={handleFollowToggle}
                  disabled={!user || followLoading}
                >
                  <Heart className={`w-4 h-4 mr-2 ${isFollowing ? 'fill-current' : ''}`} />
                  {followLoading ? 'Loading...' : (isFollowing ? 'Following' : 'Follow Store')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Store Content */}
      <div className="container mx-auto px-4 py-8 flex-1">
        {/* Store Highlights Section */}
        <div className="mb-8">
          {/* Make 3-up even on mobile, tighten spacing on small screens */}
          <div className="grid grid-cols-3 gap-2 sm:gap-6">
            {/* Products Available */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow min-h-[88px] sm:min-h-0">
              <CardContent className="p-3 sm:p-6 text-center">
                <Package className="w-5 h-5 sm:w-8 sm:h-8 mx-auto mb-2 sm:mb-3 text-blue-600" />
                <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{(store.totalProducts || products.length || 0).toLocaleString('en-NG')}</div>
                <div className="text-[10px] sm:text-sm text-muted-foreground dark:text-white">Products Available</div>
              </CardContent>
            </Card>
            
            {/* Store Quality Assurance */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow min-h-[88px] sm:min-h-0">
              <CardContent className="p-3 sm:p-6 text-center">
                <div className="flex items-center justify-center mb-2 sm:mb-3">
                  <Shield className="w-5 h-5 sm:w-8 sm:h-8 text-green-600" />
                </div>
                <div className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white">Quality</div>
                <div className="text-[10px] sm:text-sm text-muted-foreground dark:text-white">Assured</div>
                <div className="text-[10px] sm:text-xs text-green-600 mt-1 font-medium">
                  Verified Business
                </div>
              </CardContent>
            </Card>
            
            {/* Store Features */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow min-h-[88px] sm:min-h-0">
              <CardContent className="p-3 sm:p-6 text-center">
                <Shield className="w-5 h-5 sm:w-8 sm:h-8 mx-auto mb-2 sm:mb-3 text-green-600" />
                <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">Trusted Seller</div>
                <div className="space-y-0.5 sm:space-y-1">
                  <div className="flex items-center justify-center text-[10px] sm:text-xs text-green-600">
                    <Verified className="w-3 h-3 mr-1" />
                    Verified Account
                  </div>
                  <div className="flex items-center justify-center text-[10px] sm:text-xs text-blue-600">
                    <Truck className="w-3 h-3 mr-1" />
                    Fast Shipping
                  </div>
                  <div className="flex items-center justify-center text-[10px] sm:text-xs text-purple-600">
                    <MessageCircle className="w-3 h-3 mr-1" />
                    Quick Response
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Store Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
            <TabsTrigger value="about">About Store</TabsTrigger>
          </TabsList>
          
          <TabsContent value="products" className="space-y-6">
            {/* Advanced Search and Filter */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder={`Search products in ${store.storeName}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {/* Filters */}
                  <div className="flex gap-3">
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {getUniqueCategories().map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={priceRange} onValueChange={setPriceRange}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Price Range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Prices</SelectItem>
                        <SelectItem value="0-5000">₦0 - ₦5,000</SelectItem>
                        <SelectItem value="5000-20000">₦5,000 - ₦20,000</SelectItem>
                        <SelectItem value="20000-50000">₦20,000 - ₦50,000</SelectItem>
                        <SelectItem value="50000">₦50,000+</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="featured">Featured</SelectItem>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="popular">Most Popular</SelectItem>
                        <SelectItem value="price-low">Price: Low to High</SelectItem>
                        <SelectItem value="price-high">Price: High to Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Filter Summary */}
                {(searchQuery || categoryFilter !== "all" || priceRange !== "all") && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing {filteredProducts.length} of {products.length} products
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchQuery("")
                          setCategoryFilter("all")
                          setPriceRange("all")
                        }}
                        className="hover:bg-accent/10 hover:text-accent transition-all"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No products found</h3>
                  <p className="text-muted-foreground mb-6">
                    {searchQuery || categoryFilter !== "all" || priceRange !== "all"
                      ? "Try adjusting your search and filter criteria"
                      : "This store hasn't added any products yet"
                    }
                  </p>
                  {(searchQuery || categoryFilter !== "all" || priceRange !== "all") && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("")
                        setCategoryFilter("all")
                        setPriceRange("all")
                      }}
                      className="hover:bg-accent/10 hover:text-accent transition-all"
                    >
                      Clear All Filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4 md:gap-6 auto-rows-max">
                  {filteredProducts.filter(product => product && product.id).map((product) => (
                    <Card key={product.id} className="border-0 shadow-md overflow-hidden relative h-[280px] sm:h-[350px] md:h-[380px] lg:h-[450px] hover:shadow-xl transition-all duration-500 hover:-translate-y-2 rounded-2xl sm:rounded-3xl active:scale-95 md:active:scale-100">
                      {/* Image Container with Group Hover */}
                      <div className="group absolute inset-0 overflow-hidden">
                        {/* Full Card Image Background */}
                        <img
                          src={product.images?.[0] || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"}
                          alt={(product.title || (product as any).name || 'Product') as string}
                          className={`absolute inset-0 w-full h-full ${store?.category?.toLowerCase() === 'electronics' ? 'object-contain bg-white' : 'object-cover'} group-hover:scale-110 transition-transform duration-500`}
                        />
                        
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
                        
                        {/* Action Buttons - Visible on mobile */}
                        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex gap-1 sm:gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-white/90 backdrop-blur-sm hover:bg-white hover:scale-110 active:scale-95 transition-all h-8 w-8 p-0 sm:h-9 sm:w-9"
                            onClick={() => {/* Add to wishlist */}}
                          >
                            <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </Button>
                        </div>
                        
                        {/* Quick View - Visible on hover or mobile */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 items-center justify-center z-20 hidden sm:flex">
                          <Button 
                            variant="outline" 
                            className="bg-white/90 backdrop-blur-sm text-black hover:bg-white hover:scale-105 active:scale-95 transition-all text-xs sm:text-sm"
                            onClick={(e) => {
                              e.preventDefault()
                              setSelectedProduct(product)
                              setQuickViewOpen(true)
                            }}
                          >
                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                            Quick View
                          </Button>
                        </div>
                      </div>
                      
                      {/* Frosted Glass Bubble Content */}
                      <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-2.5 md:p-3 backdrop-blur-xl bg-accent/10 border-t border-white/30 rounded-t-2xl sm:rounded-t-3xl z-30 space-y-1 gap-1 sm:gap-2">
                        <Badge
                          variant="outline"
                          role="button"
                          className={`inline-flex max-w-[80%] truncate text-[11px] sm:text-xs md:text-sm font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 shadow cursor-pointer hover:opacity-90 transition ${
                            imageBrightness[product.id] === 'light' ? 'bg-accent text-white' : 'bg-accent text-white'
                          }`}
                          onClick={() => {
                            setSelectedProduct(product)
                            setQuickViewOpen(true)
                          }}
                        >
                          {product.title || (product as any).name}
                        </Badge>
                        
                        <div className="flex items-center justify-between gap-1 sm:gap-2">
                          <Badge variant="outline" className={`text-[9px] sm:text-[10px] md:text-xs backdrop-blur-sm border-white/50 px-1 sm:px-1.5 py-0 ${
                            imageBrightness[product.id] === 'light' ? 'text-white bg-accent' : 'text-white bg-accent'
                          }`}>
                            {product.category}
                          </Badge>
                          
                          <Badge
                            variant="outline"
                            className={`text-[9px] sm:text-[10px] md:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 backdrop-blur-sm ${
                              imageBrightness[product.id] === 'light' ? 'bg-white/80 text-accent' : 'bg-white/70 text-accent'
                            }`}
                          >
                            {formatCurrency(product.price)}
                          </Badge>
                        </div>
                        
                        <Button 
                          size="sm"
                          onClick={() => handleAddToCart(product)}
                          disabled={product.stock === 0}
                          className={`w-full h-6 sm:h-7 md:h-8 text-[10px] sm:text-xs md:text-xs backdrop-blur-sm hover:scale-105 active:scale-95 transition-all hover:shadow-lg flex items-center justify-center gap-0 ${
                            imageBrightness[product.id] === 'light' 
                              ? 'bg-white/20 hover:bg-white/80 text-accent' 
                              : 'bg-white/50 hover:bg-white text-black'
                          }`}
                        >
                          <img src="/images/logo3.png" alt="Add" className="w-6 sm:w-7 md:w-8 h-6 sm:h-7 md:h-8 -mt-1 sm:-mt-2" />
                          <span className="leading-none hidden sm:inline">Add</span>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="about">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>About {store.storeName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Store Description</h4>
                  <p className="text-muted-foreground leading-relaxed">{store.storeDescription}</p>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Store Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Category:</span>
                        <Badge variant="outline">{store.category}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location:</span>
                        <span>{store.address || 'Nigeria'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Products:</span>
                        <span>{(store.totalProducts || products.length || 0)} items</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Response Time:</span>
                        <span>{store.responseTime || '1 hour'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Store Status:</span>
                        <Badge variant={store.isOpen ? "default" : "secondary"}>
                          {store.isOpen ? "Open" : "Closed"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3">Shipping Information</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Free shipping on orders over {formatCurrency(store.shippingInfo?.freeShippingThreshold || 5000)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Estimated delivery: {store.shippingInfo?.estimatedDelivery || store.deliveryTime || '1-3 days'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Shipping cost: {formatCurrency(store.shippingInfo?.shippingCost || 500)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      
      
      {/* Quick View Modal */}
      <ProductQuickView
        product={selectedProduct}
        open={quickViewOpen}
        onClose={() => {
          setQuickViewOpen(false)
          setSelectedProduct(null)
        }}
        onAddToCart={handleAddToCart}
        storeName={store?.storeName}
      />
      </div>
    </div>
  )
}