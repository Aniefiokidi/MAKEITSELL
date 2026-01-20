"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, RefreshCw, ShoppingCart, Heart, Package, TrendingUp, Eye } from "lucide-react"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Skeleton } from "@/components/ui/skeleton"
import Image from "next/image"
import { useCart } from "@/contexts/CartContext"
import { useToast } from "@/hooks/use-toast"

const categories = [
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
  const [sortBy, setSortBy] = useState("featured")
  const [refreshing, setRefreshing] = useState(false)
  const { addItem } = useCart()
  const { toast } = useToast()

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

  const handleAddToCart = (product: Product) => {
    addItem({
      productId: product.id,
      name: product.title || product.name || "Product",
      price: product.price,
      quantity: 1,
      image: product.images?.[0] || "/placeholder.png",
      vendorId: product.vendorId,
      vendorName: product.vendorName || "Unknown Vendor",
      stock: product.stock || 0
    })

    toast({
      title: "Added to Cart!",
      description: `${product.title || product.name} has been added to your cart.`,
      variant: "default"
    })
  }

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch = searchQuery === "" || 
      (product.title || product.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.category || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.vendorName || "").toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory
    
    return matchesSearch && matchesCategory
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

  const ProductCard = ({ product }: { product: Product }) => {
    const [imageBrightness, setImageBrightness] = useState<'light' | 'dark'>('dark')
    const isElectronics = product.category === 'electronics'

    useEffect(() => {
      if (product.images?.[0]) {
        detectImageBrightness(product.images[0])
      }
    }, [product.images])

    const detectImageBrightness = (imageUrl: string) => {
      const img = new window.Image()
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
          
          const bottomStartRow = Math.floor(height * 0.75)
          const startPixelIndex = (bottomStartRow * width) * 4
          
          let r = 0, g = 0, b = 0, totalPixels = 0
          
          for (let i = startPixelIndex; i < data.length; i += 8) {
            r += data[i]
            g += data[i + 1]
            b += data[i + 2]
            totalPixels++
          }
          
          const avgBrightness = (r + g + b) / (totalPixels * 3)
          setImageBrightness(avgBrightness > 128 ? 'light' : 'dark')
        } catch (error) {
          console.error('Error detecting brightness:', error)
        }
      }
    }

    return (
      <Card className="border-0 shadow-md overflow-hidden relative h-[350px] sm:h-[450px] hover:shadow-xl transition-all duration-500 hover:-translate-y-2 rounded-3xl group">
        {/* Image Container with Group Hover */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Full Card Image Background */}
          <img
            src={product.images?.[0] || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"}
            alt={product.title || product.name || 'Product'}
            className={`absolute inset-0 w-full h-full ${
              isElectronics ? 'object-contain bg-white' : 'object-cover'
            } group-hover:${isElectronics ? 'scale-105' : 'scale-110'} transition-transform duration-500`}
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent via-50% to-black/90" />
          
          {/* Product Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
            {product.featured && (
              <Badge className="bg-yellow-500 text-black font-semibold">
                <TrendingUp className="h-3 w-3 mr-1" />
                Featured
              </Badge>
            )}
            {(product.stock ?? 0) < 10 && (product.stock ?? 0) > 0 && (
              <Badge variant="destructive">
                Only {product.stock} left
              </Badge>
            )}
            {product.stock === 0 && (
              <Badge variant="secondary" className="bg-gray-600">
                Out of Stock
              </Badge>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
            <Button
              size="sm"
              variant="outline"
              className="bg-white/90 backdrop-blur-sm hover:bg-white hover:scale-110 transition-all"
              onClick={() => {/* Add to wishlist */}}
            >
              <Heart className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Quick View */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20">
            <Link href={`/store/${product.storeId || product.vendorId}`}>
              <Button 
                variant="outline" 
                className="bg-white/90 backdrop-blur-sm text-black hover:bg-white hover:scale-105 transition-all"
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Frosted Glass Bubble Content */}
        <div className={`absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 backdrop-blur-xl ${
          imageBrightness === 'light' 
            ? 'bg-white/30 border-white/40' 
            : 'bg-accent/10 border-white/30'
        } border-t rounded-t-3xl z-30 space-y-1.5`}>
          <h3 
            className={`font-semibold text-xs sm:text-sm line-clamp-1 drop-shadow-lg cursor-pointer hover:opacity-80 transition-colors ${
              imageBrightness === 'light' ? 'text-gray-900' : 'text-white'
            }`}
          >
            {product.title || product.name}
          </h3>
          
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className={`text-[10px] backdrop-blur-sm border-white/50 px-1.5 py-0 ${
              imageBrightness === 'light' ? 'text-gray-900 bg-white/30' : 'text-white bg-accent/80'
            }`}>
              {product.category}
            </Badge>
            
            <div className={`font-bold text-sm drop-shadow-lg ${
              imageBrightness === 'light' ? 'text-gray-900' : 'text-white'
            }`}>
              ₦{product.price.toLocaleString()}
            </div>
          </div>
          
          <Button 
            size="sm"
            onClick={() => handleAddToCart(product)}
            disabled={product.status !== 'active' || (product.stock || 0) === 0}
            className={`w-full h-7 text-xs backdrop-blur-sm hover:scale-105 transition-all hover:shadow-lg flex items-center justify-center gap-0 ${
              imageBrightness === 'light' 
                ? 'bg-accent/20 hover:bg-accent/30 text-accent' 
                : 'bg-white/50 hover:bg-white text-black'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="leading-none ml-1">Add</span>
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Header with Liquid Glass Effect */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 p-6 md:p-8 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl shadow-accent/5 hover:shadow-2xl hover:shadow-accent/10 transition-all duration-300">
          <div>
            <h1 className="text-5xl md:text-7xl font-black tracking-wider uppercase mb-2" style={{ fontFamily: '"Bebas Neue", "Impact", sans-serif' }}>
              <span className="drop-shadow-[0_2px_2px_oklch(0.35_0.15_15/0.5)]" style={{WebkitTextFillColor: 'white', WebkitTextStroke: '1px oklch(0.35 0.15 15)', color: 'white'}}>ALL PRODUCTS</span>
            </h1>
            <p className="text-muted-foreground text-lg">Browse products from all stores in one place</p>
          </div>
          
          {/* Category Filter */}
          <div className="flex items-center gap-3 p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-lg shadow-white/5 hover:shadow-xl hover:shadow-white/10 transition-all duration-300">
            <span className="text-sm font-black uppercase tracking-wider text-muted-foreground" style={{ fontFamily: '"Bebas Neue", "Impact", sans-serif' }}>Category:</span>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px] border-2 border-accent/20 hover:border-accent/40 transition-colors">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategory !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategory("all")}
                className="text-xs hover:text-accent hover:bg-accent/10 transition-all"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Search and Sort */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="flex-1 relative group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 group-focus-within:text-primary transition-colors" />
            <Input
              type="text"
              placeholder="Search products by name, category, vendor, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 border-2 focus:border-primary transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="hover:scale-110 hover:bg-accent/10 transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading products..." : `Showing ${sortedProducts.length} product${sortedProducts.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Products Display */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6">
            {[...Array(10)].map((_, i) => (
              <Card key={i} className="border-0 shadow-md overflow-hidden relative h-[350px] sm:h-[450px] rounded-3xl">
                <Skeleton className="w-full h-full rounded-3xl" />
              </Card>
            ))}
          </div>
        ) : selectedCategory === "all" && sortedProducts.length > 0 ? (
          // Display by category
          <div className="space-y-12">
            {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
              <div key={category} className="animate-in fade-in duration-500">
                <h2 className="text-3xl md:text-4xl font-black tracking-wider uppercase mb-6" style={{ fontFamily: '"Bebas Neue", "Impact", sans-serif' }}>
                  <span className="text-accent">
                    {categories.find(c => c.id === category)?.name || category}
                  </span>
                  <span className="text-muted-foreground ml-3">({categoryProducts.length})</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6">
                  {categoryProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : sortedProducts.length > 0 ? (
          // Display filtered results
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 animate-in fade-in duration-500">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24" style={{ fontFamily: '"Bebas Neue", "Impact", sans-serif' }}>
            <div className="inline-flex p-8 bg-gradient-to-br from-accent/20 to-orange-500/20 rounded-full mb-8 border-4 border-accent/20 shadow-2xl shadow-accent/20 animate-pulse">
              <Package className="h-24 w-24 text-accent" />
            </div>
            <h3 className="text-5xl font-black mb-4 tracking-wider uppercase">NO PRODUCTS FOUND</h3>
            <p className="text-muted-foreground text-xl font-bold mb-8 max-w-md mx-auto uppercase tracking-wide">
              TRY DIFFERENT FILTERS OR SEARCH TERMS
            </p>
            <Button onClick={handleRefresh} size="lg" className="bg-gradient-to-r from-accent to-orange-600 hover:from-orange-600 hover:to-accent text-white font-black text-xl px-8 py-6 rounded-full shadow-2xl shadow-accent/30 hover:scale-105 transition-all uppercase tracking-wider">
              <RefreshCw className="h-5 w-5 mr-2" />
              REFRESH
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
