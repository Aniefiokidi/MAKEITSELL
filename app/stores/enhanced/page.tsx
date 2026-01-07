"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Grid, List, Heart, Clock, Truck, Star, MapPin } from "lucide-react"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import SmartSearch from "@/components/search/SmartSearch"
import AdvancedFilters from "@/components/search/AdvancedFilters"

// Filter state interface
interface FilterState {
  priceRange: [number, number]
  categories: string[]
  brands: string[]
  colors: string[]
  materials: string[]
  ratings: number[]
  conditions: string[]
  features: string[]
}

// Mock product data for smart discovery
interface Product {
  id: string
  name: string
  price: number
  originalPrice?: number
  image: string
  vendor: {
    id: string
    name: string
    verified: boolean
  }
  rating: {
    average: number
    count: number
  }
  category: string
  views: number
  likes: number
  sales: number
  createdAt: Date
  isNew: boolean
  onSale: boolean
  discount?: number
}

const mockProducts: Product[] = [
  {
    id: "1",
    name: "iPhone 15 Pro Max",
    price: 650000,
    originalPrice: 750000,
    image: "/images/products/iphone-15.jpg",
    vendor: { id: "v1", name: "Apple Store Nigeria", verified: true },
    rating: { average: 4.8, count: 234 },
    category: "Electronics",
    views: 5420,
    likes: 892,
    sales: 156,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    isNew: true,
    onSale: true,
    discount: 13
  },
  {
    id: "2",
    name: "Nike Air Jordan 1",
    price: 85000,
    originalPrice: 120000,
    image: "/images/products/jordan-1.jpg",
    vendor: { id: "v3", name: "Nike Store", verified: true },
    rating: { average: 4.9, count: 456 },
    category: "Fashion",
    views: 8970,
    likes: 1234,
    sales: 298,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    isNew: true,
    onSale: true,
    discount: 29
  }
]

export default function EnhancedShopPage() {
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("featured")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  
  // Advanced filters state
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 1000000],
    categories: [],
    brands: [],
    colors: [],
    materials: [],
    ratings: [],
    conditions: [],
    features: []
  })

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle smart search
  const handleSearch = (query: string, searchFilters?: any) => {
    setSearchQuery(query)
    if (searchFilters) {
      setFilters(prev => ({ ...prev, ...searchFilters }))
    }
  }

  // Handle filter changes
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
  }

  // Reset filters
  const resetFilters = () => {
    setFilters({
      priceRange: [0, 1000000],
      categories: [],
      brands: [],
      colors: [],
      materials: [],
      ratings: [],
      conditions: [],
      features: []
    })
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (!mounted) {
    return null // Prevent hydration mismatch
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        
        {/* Hero Section with Smart Search */}
        <section className="mb-12">
          <div className="max-w-4xl mx-auto text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Discover Amazing Products</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Find exactly what you're looking for with our intelligent search and discovery features
            </p>
            
            {/* Smart Search */}
            <div className="max-w-2xl mx-auto">
              <SmartSearch 
                onSearch={handleSearch}
                placeholder="Search for products, brands, or categories..."
              />
            </div>
          </div>
        </section>

        {/* Advanced Product Browse Section */}
        <section className="bg-white rounded-lg shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">Browse All Products</h2>
              <p className="text-muted-foreground">Use advanced filters to find exactly what you need</p>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-4">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex border rounded-lg">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-8">
            {/* Advanced Filters Sidebar */}
            <div className="w-80">
              <AdvancedFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                totalProducts={mockProducts.length}
                onReset={resetFilters}
              />
            </div>

            {/* Product Results */}
            <div className="flex-1">
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground">
                    Showing {mockProducts.length} results
                    {searchQuery && ` for "${searchQuery}"`}
                  </p>
                  
                  {/* Active filters count */}
                  {Object.values(filters).some(value => 
                    Array.isArray(value) ? value.length > 0 : 
                    value !== filters.priceRange ? true : 
                    value[0] > 0 || value[1] < 1000000
                  ) && (
                    <Badge variant="secondary" className="ml-4">
                      {Object.values(filters).reduce((count, value) => {
                        if (Array.isArray(value)) return count + value.length
                        if (value === filters.priceRange && (value[0] > 0 || value[1] < 1000000)) return count + 1
                        return count
                      }, 0)} filters active
                    </Badge>
                  )}
                </div>
              </div>

              {/* Product Grid */}
              <div className={`grid gap-6 ${
                viewMode === "grid" 
                  ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
                  : "grid-cols-1"
              }`}>
                {mockProducts.map((product) => (
                  <Link key={product.id} href={`/product/${product.id}`}>
                    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
                      <CardContent className="p-0">
                        {viewMode === "grid" ? (
                          // Grid view
                          <>
                            <div className="relative aspect-square overflow-hidden rounded-t-lg">
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  e.currentTarget.src = "/images/placeholder-product.jpg"
                                }}
                              />
                              
                              {/* Badges */}
                              <div className="absolute top-2 left-2 flex flex-col gap-1">
                                {product.isNew && (
                                  <Badge className="bg-blue-500 hover:bg-blue-600 text-xs">NEW</Badge>
                                )}
                                {product.onSale && product.discount && (
                                  <Badge className="bg-red-500 hover:bg-red-600 text-xs">
                                    -{product.discount}%
                                  </Badge>
                                )}
                              </div>

                              {/* Quick actions */}
                              <div className="absolute top-2 right-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 bg-white/80 hover:bg-white"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    // Add to wishlist logic
                                  }}
                                >
                                  <Heart className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="p-4 space-y-2">
                              <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                                {product.name}
                              </h3>
                              
                              <div className="flex items-center gap-1">
                                <div className="flex">
                                  {Array.from({ length: 5 }, (_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-3 w-3 ${
                                        i < Math.floor(product.rating.average)
                                          ? "fill-yellow-400 text-yellow-400"
                                          : "text-gray-300"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  ({product.rating.count})
                                </span>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-lg">{formatCurrency(product.price)}</span>
                                  {product.originalPrice && (
                                    <span className="text-sm text-muted-foreground line-through">
                                      {formatCurrency(product.originalPrice)}
                                    </span>
                                  )}
                                </div>
                                
                                <p className="text-xs text-muted-foreground">
                                  by {product.vendor.name}
                                  {product.vendor.verified && " ✓"}
                                </p>
                              </div>
                            </div>
                          </>
                        ) : (
                          // List view
                          <div className="flex gap-4 p-4">
                            <div className="relative w-24 h-24 shrink-0">
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover rounded-lg"
                                onError={(e) => {
                                  e.currentTarget.src = "/images/placeholder-product.jpg"
                                }}
                              />
                              
                              {product.onSale && product.discount && (
                                <Badge className="absolute -top-1 -right-1 bg-red-500 text-xs">
                                  -{product.discount}%
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex-1 space-y-2">
                              <div>
                                <h3 className="font-semibold group-hover:text-primary">{product.name}</h3>
                                <p className="text-sm text-muted-foreground">by {product.vendor.name}</p>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <div className="flex">
                                  {Array.from({ length: 5 }, (_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-3 w-3 ${
                                        i < Math.floor(product.rating.average)
                                          ? "fill-yellow-400 text-yellow-400"
                                          : "text-gray-300"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-sm">({product.rating.count})</span>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-lg">{formatCurrency(product.price)}</span>
                                  {product.originalPrice && (
                                    <span className="text-sm text-muted-foreground line-through">
                                      {formatCurrency(product.originalPrice)}
                                    </span>
                                  )}
                                </div>
                                
                                <Button variant="outline" size="sm">
                                  Add to Cart
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Load more */}
              <div className="text-center mt-12">
                <Button variant="outline" size="lg">
                  Load More Products
                </Button>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  )
}