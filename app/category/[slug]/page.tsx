"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Search, ShoppingCart, Heart, ArrowLeft, Filter, Star, X, ChevronDown, ChevronUp, Clock } from "lucide-react"
import { useCart } from "@/contexts/CartContext"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
// import { getProducts } from "@/lib/firestore"

// Use real products from Firestore

const categoryNames: { [key: string]: string } = {
  electronics: "Electronics",
  fashion: "Fashion",
  home: "Home & Garden",
  accessories: "Accessories",
  sports: "Sports & Fitness",
}

const fashionSubcategories = [
  "All Fashion",
  "Shoes",
  "Jewelry",
  "Shirts",
  "Sweaters",
  "Swimwear",
  "Pants & Jeans",
  "Dresses",
  "Jackets & Coats",
  "Accessories",
  "Bags",
  "Hats & Caps",
  "Socks & Underwear",
]

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const categorySlug = params.slug as string
  const [products, setProducts] = useState<any[]>([])
  const [filteredProducts, setFilteredProducts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("featured")
  const [fashionSubcategory, setFashionSubcategory] = useState("All Fashion")
  
  // Advanced filtering states
  const [priceRange, setPriceRange] = useState([0, 100000])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [minRating, setMinRating] = useState(0)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [availableBrands, setAvailableBrands] = useState<string[]>([])
  
  // Search suggestions
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  
  // Recently viewed products
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([])
  
  const { addToCart } = useCart()

  // Load recently viewed products from localStorage
  useEffect(() => {
    const viewed = localStorage.getItem('recentlyViewed')
    if (viewed) {
      try {
        setRecentlyViewed(JSON.parse(viewed))
      } catch (e) {
        console.error('Error loading recently viewed:', e)
      }
    }
  }, [])

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch(`/api/database/products?category=${categorySlug}`)
        const result = await response.json()
        
        if (result.success && result.data) {
          // Get unique vendor IDs
          const vendorIds = [...new Set(result.data.map((p: any) => p.vendorId))]
          
          // Fetch store names for all vendors
          const storeNamesMap: { [key: string]: string } = {}
          for (const vendorId of vendorIds) {
            try {
              const storeRes = await fetch(`/api/database/stores?vendorId=${vendorId}`)
              const storeData = await storeRes.json()
              if (storeData.success && storeData.data && storeData.data.length > 0) {
                storeNamesMap[vendorId as string] = storeData.data[0].storeName || "Store"
              }
            } catch (err) {
              console.error('Error fetching store:', err)
            }
          }
          
          const mappedProducts = result.data.map((p: any) => {
            const storeName = storeNamesMap[p.vendorId] || "Store"
            return {
              id: p.id || p._id,
              name: p.name || p.title,
              price: p.price,
              image: Array.isArray(p.images) ? p.images[0] : p.image || "/placeholder.svg",
              storeName: storeName,
              inStock: typeof p.stock === "number" ? p.stock > 0 : true,
              rating: p.rating || 5,
              reviews: p.reviews || 0,
              originalPrice: p.originalPrice || null,
              maxStock: p.stock || 99,
              vendorCategory: p.category || "",
              category: p.category || "",
              description: p.description || "",
              subcategory: p.subcategory || ""
            }
          })
          setProducts(mappedProducts)
          
          // Set available brands and price range
          const brands = [...new Set(mappedProducts.map((p: any) => p.storeName))]
          setAvailableBrands(brands)
          
          const prices = mappedProducts.map((p: any) => p.price).filter(Boolean)
          if (prices.length > 0) {
            const minPrice = Math.min(...prices)
            const maxPrice = Math.max(...prices)
            setPriceRange([minPrice, maxPrice])
          }
        } else {
          console.log('No products found or API error')
        }
      } catch (error) {
        console.error('Error fetching products:', error)
      }
    }
    fetchProducts()
  }, [categorySlug])

  // Search suggestions logic
  useEffect(() => {
    if (searchQuery.length > 0) {
      const suggestions = products
        .filter((product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 5)
        .map((product) => product.name)
      setSearchSuggestions([...new Set(suggestions)])
    } else {
      setSearchSuggestions([])
    }
  }, [searchQuery, products])

  useEffect(() => {
    // Products are already filtered by category from the API, apply all filters
    let filtered = [...products]
    
    // Apply fashion subcategory filter
    if (categorySlug === "fashion" && fashionSubcategory !== "All Fashion") {
      filtered = filtered.filter(
        (product) => product.subcategory?.toLowerCase() === fashionSubcategory.toLowerCase()
      )
    }
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (product.description?.toLowerCase() || "").includes(searchQuery.toLowerCase()),
      )
    }
    
    // Apply price range filter
    filtered = filtered.filter(
      (product) => product.price >= priceRange[0] && product.price <= priceRange[1]
    )
    
    // Apply brand/store filter
    if (selectedBrands.length > 0) {
      filtered = filtered.filter(
        (product) => selectedBrands.includes(product.storeName)
      )
    }
    
    // Apply rating filter
    if (minRating > 0) {
      filtered = filtered.filter(
        (product) => product.rating >= minRating
      )
    }
    
    // Apply sorting
    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => a.price - b.price)
        break
      case "price-high":
        filtered.sort((a, b) => b.price - a.price)
        break
      case "rating":
        filtered.sort((a, b) => b.rating - a.rating)
        break
      case "newest":
        filtered.reverse()
        break
      default:
        break
    }
    
    setFilteredProducts(filtered)
  }, [searchQuery, sortBy, products, fashionSubcategory, categorySlug, priceRange, selectedBrands, minRating])

  // Handle brand selection
  const handleBrandToggle = (brand: string) => {
    setSelectedBrands(prev => 
      prev.includes(brand) 
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    )
  }

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery("")
    setSelectedBrands([])
    setMinRating(0)
    setFashionSubcategory("All Fashion")
    const prices = products.map((p: any) => p.price).filter(Boolean)
    if (prices.length > 0) {
      setPriceRange([Math.min(...prices), Math.max(...prices)])
    }
  }

  // Add product to recently viewed
  const addToRecentlyViewed = (product: any) => {
    let recent = [...recentlyViewed]
    // Remove if already exists
    recent = recent.filter(p => p.id !== product.id)
    // Add to beginning
    recent.unshift(product)
    // Keep only last 6 items
    recent = recent.slice(0, 6)
    setRecentlyViewed(recent)
    localStorage.setItem('recentlyViewed', JSON.stringify(recent))
  }

  const handleAddToCart = (product: any) => {
    addToCart({
      productId: product.id,
      title: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      vendorId: product.storeName || "", 
      vendorName: product.storeName,
      maxStock: product.inStock ? 999 : 0,
      id: product
    })
  }

  const categoryProducts = products.filter((p) => p.category === categorySlug)
  const categoryName = categoryNames[categorySlug] || "Category"

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header with Back Button */}
          <div className="mb-8">
            {/* Back Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="mb-4 hover:bg-accent hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            {/* Glass Bubble Header */}
            <div className="backdrop-blur-2xl bg-linear-to-br from-accent/5 via-accent/10 to-accent/5 dark:from-accent/10 dark:via-accent/20 dark:to-accent/10 border border-accent/20 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg">
              <nav className="text-xs sm:text-sm text-accent dark:text-white mb-2 sm:mb-4">
                <Link href="/" className="hover:opacity-80 transition-opacity">
                  Home
                </Link>
                <span className="mx-2">/</span>
                <Link href="/categories" className="hover:opacity-80 transition-opacity">
                  Categories
                </Link>
                <span className="mx-2">/</span>
                <span>{categoryName}</span>
              </nav>
              <h1 className="text-xl sm:text-3xl font-bold mb-2 sm:mb-4 text-accent dark:text-white" style={{ 
                fontFamily: '"Bebas Neue", "Impact", sans-serif',
                textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' 
              }}>{categoryName}</h1>
              {filteredProducts.length === 0 ? (
                <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-accent dark:text-white">
                    Sorry, we do not have products in "{categoryName}" yet.<br />
                    Here are some other products you might like:
                  </p>
                </div>
              ) : (
                <p className="text-accent dark:text-white text-xs sm:text-base">
                  Discover amazing {categoryName.toLowerCase()} products from our trusted sellers
                </p>
              )}
            </div>
          </div>

        {/* Search, Filters and Sort */}
        <div className="mb-8 space-y-4">
          {/* Search with suggestions and filters button */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
              <Input
                placeholder={`Search in ${categoryName}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="pl-10"
              />
              {/* Search Suggestions */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                  {searchSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                      onMouseDown={() => {
                        setSearchQuery(suggestion)
                        setShowSuggestions(false)
                      }}
                    >
                      <Search className="inline w-3 h-3 mr-2 text-muted-foreground" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <Button
              variant="outline"
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
              {(selectedBrands.length > 0 || minRating > 0 || 
                priceRange[0] !== Math.min(...products.map(p => p.price).filter(Boolean)) ||
                priceRange[1] !== Math.max(...products.map(p => p.price).filter(Boolean))
              ) && (
                <Badge variant="destructive" className="ml-1">
                  {selectedBrands.length + (minRating > 0 ? 1 : 0) + 1}
                </Badge>
              )}
              {isFiltersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          {/* Advanced Filters Panel */}
          <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <CollapsibleContent className="space-y-6">
              <Card className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Price Range */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Price Range</label>
                    <Slider
                      value={priceRange}
                      onValueChange={setPriceRange}
                      max={Math.max(...products.map(p => p.price).filter(Boolean), 100000)}
                      min={Math.min(...products.map(p => p.price).filter(Boolean), 0)}
                      step={1000}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>₦{priceRange[0].toLocaleString()}</span>
                      <span>₦{priceRange[1].toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Brand/Store Filter */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Stores</label>
                    <div className="max-h-32 overflow-y-auto space-y-2">
                      {availableBrands.slice(0, 8).map((brand) => (
                        <div key={brand} className="flex items-center space-x-2">
                          <Checkbox
                            id={brand}
                            checked={selectedBrands.includes(brand)}
                            onCheckedChange={() => handleBrandToggle(brand)}
                          />
                          <label htmlFor={brand} className="text-sm cursor-pointer">
                            {brand}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rating Filter */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Minimum Rating</label>
                    <Select value={minRating.toString()} onValueChange={(value) => setMinRating(Number(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Any rating</SelectItem>
                        <SelectItem value="1">⭐ 1 & up</SelectItem>
                        <SelectItem value="2">⭐ 2 & up</SelectItem>
                        <SelectItem value="3">⭐ 3 & up</SelectItem>
                        <SelectItem value="4">⭐ 4 & up</SelectItem>
                        <SelectItem value="5">⭐ 5 stars</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Clear Filters */}
                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllFilters}
                    className="flex items-center gap-2"
                  >
                    <X className="w-3 h-3" />
                    Clear All Filters
                  </Button>
                </div>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Fashion subcategory and Sort */}
          <div className="flex flex-col sm:flex-row gap-4">
            {categorySlug === "fashion" && (
              <Select value={fashionSubcategory} onValueChange={setFashionSubcategory}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Subcategory" />
                </SelectTrigger>
                <SelectContent>
                  {fashionSubcategories.map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Recently Viewed Products */}
        {recentlyViewed.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Recently Viewed</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {recentlyViewed.map((product) => (
                <Card key={product.id} className="min-w-[200px] border-0 shadow-md overflow-hidden relative h-[280px] hover:shadow-xl transition-all duration-500 hover:-translate-y-1 rounded-2xl">
                  <div className="group absolute inset-0 overflow-hidden">
                    <img
                      src={product.image || "/placeholder.svg"}
                      alt={product.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-3 backdrop-blur-xl bg-white/20 dark:bg-black/20 border-t border-white/30 rounded-t-2xl z-30">
                      <Link href={`/product/${product.id}`} onClick={() => addToRecentlyViewed(product)}>
                        <h3 className="font-semibold text-xs line-clamp-1 text-white drop-shadow-lg cursor-pointer hover:text-blue-200 transition-colors">
                          {product.name}
                        </h3>
                      </Link>
                      <div className="font-bold text-sm text-white drop-shadow-lg mt-1">
                        ₦{product.price}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div className="mb-6">
          <p className="text-muted-foreground">
            Showing {filteredProducts.length} products
            {categoryProducts.length === 0 && ` (showing all products as suggestions)`}
          </p>
        </div>

        {filteredProducts.length === 0 ? (
          <>
            {/* Improved No Results Section */}
            <Card className="p-8 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-semibold">No products found</h2>
                <p className="text-muted-foreground">
                  {searchQuery ? (
                    <>We couldn't find any products matching "<strong>{searchQuery}</strong>" in {categoryName}.</>
                  ) : (
                    <>No products match your current filters in {categoryName}.</>
                  )}
                </p>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Try:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {searchQuery && (
                      <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                        Clear search
                      </Button>
                    )}
                    {selectedBrands.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setSelectedBrands([])}>
                        Clear store filters
                      </Button>
                    )}
                    {minRating > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setMinRating(0)}>
                        Clear rating filter
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={clearAllFilters}>
                      Clear all filters
                    </Button>
                  </div>
                </div>
                
                {/* Alternative categories */}
                <div className="pt-4">
                  <p className="text-sm text-muted-foreground mb-3">Or explore these categories:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Link href="/category/electronics">
                      <Badge variant="secondary" className="cursor-pointer hover:bg-accent hover:text-white">
                        Electronics
                      </Badge>
                    </Link>
                    <Link href="/category/fashion">
                      <Badge variant="secondary" className="cursor-pointer hover:bg-accent hover:text-white">
                        Fashion
                      </Badge>
                    </Link>
                    <Link href="/category/home">
                      <Badge variant="secondary" className="cursor-pointer hover:bg-accent hover:text-white">
                        Home & Garden
                      </Badge>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
            {/* Show all products as suggestions */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 mt-8">
              {products.map((product) => (
                <Card key={product.id} className={`border-0 shadow-md overflow-hidden relative h-[350px] sm:h-[450px] hover:shadow-xl transition-all duration-500 ${categorySlug === 'electronics' ? 'hover:-translate-y-1' : 'hover:-translate-y-2'} rounded-3xl`}>
                  {/* Image Container with Group Hover */}
                  <div className="group absolute inset-0 overflow-hidden">
                    {/* Full Card Image Background */}
                    <img
                      src={product.image || "/placeholder.svg"}
                      alt={product.name}
                      className={`absolute inset-0 w-full h-full ${categorySlug === 'electronics' ? 'object-contain bg-white' : 'object-cover'} group-hover:scale-110 transition-transform duration-500`}
                    />
                    
                    {/* Product Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                      {!product.inStock && (
                        <Badge variant="secondary" className="bg-gray-600">
                          Out of Stock
                        </Badge>
                      )}
                      {product.category !== categorySlug && (
                        <Badge className="bg-blue-500 text-white font-semibold">
                          Suggested
                        </Badge>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white/90 backdrop-blur-sm hover:bg-white hover:scale-110 transition-all"
                      >
                        <Heart className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Frosted Glass Bubble Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 backdrop-blur-xl bg-white/20 dark:bg-black/20 border-t border-white/30 rounded-t-3xl z-30 space-y-1.5">
                    <Link href={`/product/${product.id}`} onClick={() => addToRecentlyViewed(product)}>
                      <h3 className="font-semibold text-xs sm:text-sm line-clamp-1 text-white drop-shadow-lg cursor-pointer hover:text-blue-200 transition-colors">
                        {product.name}
                      </h3>
                    </Link>
                    
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white text-[11px] sm:text-xs font-medium px-2 py-1 bg-accent/80 backdrop-blur-sm rounded-full border border-white/50">
                        {product.storeName}
                      </span>
                      
                      <div className="font-bold text-sm text-white drop-shadow-lg">
                        ₦{product.price}
                      </div>
                    </div>
                    
                    <Button 
                      size="sm"
                      onClick={() => handleAddToCart(product)}
                      disabled={!product.inStock}
                      className="w-full h-7 text-xs bg-white/90 hover:bg-white text-black backdrop-blur-sm hover:scale-105 transition-all hover:shadow-lg flex items-center justify-center gap-0"
                    >
                      <img src="/images/logo3.png" alt="Add" className="w-8 h-8 -mt-2" />
                      <span className="leading-none text-accent">Add</span>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4 md:gap-6 auto-rows-max">
            {filteredProducts.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                onClick={() => addToRecentlyViewed(product)}
                className="block"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Card
                  className="border-0 shadow-md overflow-hidden relative h-[280px] sm:h-[350px] md:h-[380px] lg:h-[450px] hover:shadow-xl transition-all duration-500 hover:-translate-y-2 rounded-2xl sm:rounded-3xl active:scale-95 md:active:scale-100 cursor-pointer"
                  onClick={(e) => {
                    // Prevent navigation if clicking on a button or badge
                    const tag = (e.target as HTMLElement).tagName.toLowerCase()
                    if (tag === 'button' || tag === 'svg' || tag === 'img' || tag === 'span' || tag === 'input' || tag === 'a') {
                      return
                    }
                  }}
                >
                  {/* Image Container with Group Hover */}
                  <div className="group absolute inset-0 overflow-hidden">
                    {/* Full Card Image Background */}
                    <img
                      src={product.image || "/placeholder.svg"}
                      alt={product.name}
                      className={`absolute inset-0 w-full h-full ${categorySlug === 'electronics' ? 'object-contain bg-white' : 'object-cover'} group-hover:scale-105 transition-transform duration-500`}
                    />
                    {/* Out of Stock Red Tape Overlay */}
                    {!product.inStock && (
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
                      {product.stock < 10 && product.stock > 0 && (
                        <Badge variant="destructive" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                          Only {product.stock} left
                        </Badge>
                      )}
                      {!product.inStock && (
                        <Badge variant="secondary" className="bg-gray-600 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                          Out of Stock
                        </Badge>
                      )}
                      {product.category !== categorySlug && (
                        <Badge className="bg-blue-500 text-white font-semibold text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                          Suggested
                        </Badge>
                      )}
                    </div>
                    {/* Action Buttons */}
                    <div className="absolute top-2 sm:top-3 right-2 sm:right-3 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex gap-1 sm:gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white/90 backdrop-blur-sm hover:bg-white hover:scale-110 active:scale-95 transition-all h-8 w-8 p-0 sm:h-9 sm:w-9"
                        onClick={e => e.preventDefault()}
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
                      className="inline-flex w-full text-[10px] sm:text-xs md:text-sm font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 shadow cursor-pointer hover:opacity-90 transition min-h-5 sm:min-h-6 items-center justify-center text-center leading-tight bg-accent text-white"
                      onClick={e => {
                        e.preventDefault()
                        window.location.href = `/product/${product.id}`
                        addToRecentlyViewed(product)
                      }}
                      style={{
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        hyphens: 'auto',
                        lineHeight: '1.2'
                      }}
                    >
                      <span className="line-clamp-2 sm:line-clamp-1">
                        {product.name}
                      </span>
                    </Badge>
                    <div className="flex items-center justify-between gap-1 sm:gap-2">
                      <Badge variant="outline" className="text-[9px] sm:text-[10px] md:text-xs backdrop-blur-sm border-white/50 px-1 sm:px-1.5 py-0 text-white bg-accent">
                        {product.storeName}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[9px] sm:text-[10px] md:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 backdrop-blur-sm bg-white/70 text-accent"
                      >
                        ₦{product.price.toLocaleString()}
                      </Badge>
                    </div>
                    <Button 
                      size="sm"
                      onClick={e => {
                        e.preventDefault()
                        handleAddToCart(product)
                      }}
                      disabled={!product.inStock}
                      className="w-full h-6 sm:h-7 md:h-8 text-[10px] sm:text-xs md:text-xs backdrop-blur-sm hover:scale-105 active:scale-95 transition-all hover:shadow-lg flex items-center justify-center gap-0 bg-white/50 hover:bg-white text-black"
                    >
                      <img src="/images/logo3.png" alt="Add" className="w-6 sm:w-7 md:w-8 h-6 sm:h-7 md:h-8 -mt-1 sm:-mt-2" />
                      <span className="leading-none hidden sm:inline">Add</span>
                    </Button>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      </div>
      <Footer />
    </>
  )
}
