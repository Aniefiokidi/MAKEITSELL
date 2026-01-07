"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Filter, Grid, List, Heart, Clock, Truck, Star, MapPin } from "lucide-react"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import SmartSearch from "@/components/search/SmartSearch"
import AdvancedFilters from "@/components/search/AdvancedFilters"

import { getStores, type Store } from "@/lib/firestore"
import { Skeleton } from "@/components/ui/skeleton"

const categories = [
  { id: "all", name: "All Stores" },
  { id: "electronics", name: "Electronics" },
  { id: "fashion", name: "Fashion" },
  { id: "food", name: "Food & Beverage" },
  { id: "home", name: "Home & Garden" },
  { id: "beauty", name: "Beauty & Health" },
  { id: "sports", name: "Sports & Fitness" },
  { id: "books", name: "Books & Media" },
]

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

export default function ShopPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stores, setStores] = useState<Store[]>([])
  const [filteredStores, setFilteredStores] = useState<Store[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [sortBy, setSortBy] = useState("featured")
  const [openOnly, setOpenOnly] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 200000],
    categories: [],
    brands: [],
    colors: [],
    materials: [],
    ratings: [],
    conditions: [],
    features: []
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchStores = async () => {
      setLoading(true)
      try {
        const firestoreStores = await getStores()
        if (!firestoreStores || firestoreStores.length === 0) {
          // Fallback to mock data
          const mockStores: Store[] = [
            {
              id: "mock1",
              vendorId: "vendor1",
              storeName: "Tech Hub",
              storeDescription: "Latest electronics and gadgets",
              storeImage: "/placeholder.svg",
              category: "electronics",
              rating: 4.5,
              reviewCount: 123,
              isOpen: true,
              deliveryTime: "30-45 min",
              deliveryFee: 500,
              minimumOrder: 5000,
              address: "Victoria Island, Lagos",
              createdAt: null,
              updatedAt: null
            },
            {
              id: "mock2",
              vendorId: "vendor2",
              storeName: "Fashion Forward",
              storeDescription: "Trendy clothing and accessories",
              storeImage: "/placeholder.svg",
              category: "fashion",
              rating: 4.8,
              reviewCount: 89,
              isOpen: true,
              deliveryTime: "45-60 min",
              deliveryFee: 800,
              minimumOrder: 3000,
              address: "Ikeja, Lagos",
              createdAt: null,
              updatedAt: null
            }
          ]
          setStores(mockStores)
        } else {
          setStores(firestoreStores)
        }
      } catch (error) {
        console.error("Error fetching stores:", error)
        setStores([])
      }
      setLoading(false)
    }
    fetchStores()
  }, [])

  useEffect(() => {
    let filtered = stores

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (store) =>
          store.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          store.storeDescription.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((store) => store.category === selectedCategory)
    }

    // Filter by open status
    if (openOnly) {
      filtered = filtered.filter((store) => store.isOpen)
    }

    // Sort stores
    switch (sortBy) {
      case "rating":
        filtered.sort((a, b) => b.rating - a.rating)
        break
      case "delivery-time":
        filtered.sort((a, b) => {
          const aTime = parseInt(a.deliveryTime.split("-")[0])
          const bTime = parseInt(b.deliveryTime.split("-")[0])
          return aTime - bTime
        })
        break
      case "delivery-fee":
        filtered.sort((a, b) => a.deliveryFee - b.deliveryFee)
        break
      case "newest":
        // For demo, reverse the array
        filtered.reverse()
        break
      default:
        // Featured - keep original order (by rating)
        filtered.sort((a, b) => b.rating - a.rating)
        break
    }

    setFilteredStores(filtered)
  }, [searchQuery, selectedCategory, sortBy, openOnly, stores])

  // Handle Smart Search
  const handleSmartSearch = (query: string) => {
    setSearchQuery(query)
  }

  // Handle Advanced Filters
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    // Apply filters to stores (simplified for now)
    let filtered = stores
    if (newFilters.categories.length > 0) {
      filtered = filtered.filter((store) => newFilters.categories.includes(store.category))
    }
    setFilteredStores(filtered)
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header/>
        <div className="container mx-auto px-4 py-8 flex-1">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">Discover Stores</h1>
            <p className="text-muted-foreground">Browse amazing stores from trusted sellers in your area</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="w-full h-48 mb-4" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header/>
      <div className="container mx-auto px-4 py-8 flex-1">
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Discover Stores</h1>
          <p className="text-muted-foreground">Browse amazing stores from trusted sellers in your area</p>
        </div>

        {/* Smart Product Discovery Features */}
        <div className="mb-8">
          <div className="mb-6">
            <SmartSearch 
              onSearch={handleSmartSearch}
              placeholder="Search stores, products, categories..."
            />
          </div>
          
          <AdvancedFilters
            onFiltersChange={handleFiltersChange}
            initialFilters={filters}
          />
        </div>

        {/* Search and Filters Row */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="delivery-time">Fastest Delivery</SelectItem>
                <SelectItem value="delivery-fee">Lowest Delivery Fee</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="openOnly"
                checked={openOnly}
                onCheckedChange={(checked) => setOpenOnly(checked === true)}
              />
              <label htmlFor="openOnly" className="text-sm">
                Open stores only
              </label>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-8">
          {/* Desktop Filters Sidebar */}
          <div className="hidden lg:block w-80">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-4">Additional Filters</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="openOnlyDesktop"
                      checked={openOnly}
                      onCheckedChange={(checked) => setOpenOnly(checked === true)}
                    />
                    <label htmlFor="openOnlyDesktop" className="text-sm">
                      Open stores only
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Products Grid */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <p className="text-muted-foreground">
                Showing {filteredStores.length} of {stores.length} stores
              </p>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="w-full h-48 mb-4" />
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-1/3" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground mb-4">No stores found matching your criteria.</p>
                <Button onClick={() => {
                  setSearchQuery("")
                  setSelectedCategory("all")
                  setOpenOnly(false)
                }}>
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                {filteredStores.map((store) => (
                  <Link key={store.id} href={`/store/${store.id}`}>
                    <Card className="group hover:shadow-lg transition-all duration-300 h-full">
                      <CardContent className="p-0">
                        <div className="relative">
                          <img
                            src={store.storeImage || "/placeholder.svg"}
                            alt={store.storeName}
                            className="w-full h-48 object-cover rounded-t-lg group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-3 right-3">
                            <Button size="icon" variant="secondary" className="rounded-full">
                              <Heart className="w-4 h-4" />
                            </Button>
                          </div>
                          {!store.isOpen && (
                            <Badge className="absolute top-3 left-3 bg-red-500">
                              Closed
                            </Badge>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                                {store.storeName}
                              </h3>
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                <span className="text-sm font-medium">{store.rating}</span>
                                <span className="text-sm text-muted-foreground">({store.reviewCount})</span>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {store.storeDescription}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{store.deliveryTime}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Truck className="w-4 h-4" />
                                <span>₦{store.deliveryFee}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="w-4 h-4" />
                              <span>{store.address}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Discovery Features */}
        <div className="mt-16 space-y-12">
        </div>
      </div>
      <Footer />
    </div>
  )
}