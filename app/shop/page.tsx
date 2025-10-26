"use client"

import { useState, useEffect } from "react"
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

export default function ShopPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stores, setStores] = useState<Store[]>([])
  const [filteredStores, setFilteredStores] = useState<Store[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [sortBy, setSortBy] = useState("featured")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [showFilters, setShowFilters] = useState(false)
  const [openOnly, setOpenOnly] = useState(false)

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch stores from Firestore on mount
  useEffect(() => {
    async function fetchStores() {
      setLoading(true)
      try {
        const firestoreStores = await getStores();
        // Add some mock stores if none exist
        if (!firestoreStores || firestoreStores.length === 0) {
          const mockStores: Store[] = [
            {
              id: "1",
              vendorId: "vendor1",
              storeName: "TechHub Electronics",
              storeDescription: "Your one-stop shop for the latest electronics and gadgets",
              storeImage: "/images/store-electronics.jpg",
              category: "electronics",
              rating: 4.8,
              reviewCount: 245,
              isOpen: true,
              deliveryTime: "30-45 min",
              deliveryFee: 500,
              minimumOrder: 2000,
              address: "Victoria Island, Lagos",
              createdAt: null,
              updatedAt: null
            },
            {
              id: "2",
              vendorId: "vendor2",
              storeName: "Fashion Forward",
              storeDescription: "Trendy fashion for the modern individual",
              storeImage: "/images/store-fashion.jpg",
              category: "fashion",
              rating: 4.6,
              reviewCount: 189,
              isOpen: true,
              deliveryTime: "45-60 min",
              deliveryFee: 800,
              minimumOrder: 3000,
              address: "Lekki Phase 1, Lagos",
              createdAt: null,
              updatedAt: null
            },
            {
              id: "3",
              vendorId: "vendor3",
              storeName: "Home Essentials",
              storeDescription: "Beautiful home decor and essential items",
              storeImage: "/images/store-home.jpg",
              category: "home",
              rating: 4.7,
              reviewCount: 156,
              isOpen: false,
              deliveryTime: "60-90 min",
              deliveryFee: 1000,
              minimumOrder: 5000,
              address: "Ikeja, Lagos",
              createdAt: null,
              updatedAt: null
            },
            {
              id: "YD3PD8mzl8KzTTpPcJS46",
              vendorId: "vendor4",
              storeName: "swagshack",
              storeDescription: "streetwear clothing",
              storeImage: "/placeholder.svg",
              category: "fashion",
              rating: 5.0,
              reviewCount: 0,
              isOpen: true,
              deliveryTime: "30-60 min",
              deliveryFee: 500,
              minimumOrder: 2000,
              address: "16 Olu Akerete Street",
              createdAt: null,
              updatedAt: null
            }
          ];
          setStores(mockStores);
        } else {
          setStores(firestoreStores);
        }
      } catch (error) {
        console.error("Error fetching stores:", error);
        setStores([]);
      }
      setLoading(false)
    }
    fetchStores();
  }, []);

  useEffect(() => {
    let filtered = stores

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (store) =>
          store.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          store.storeDescription.toLowerCase().includes(searchQuery.toLowerCase())
      );
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

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search stores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
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
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="lg:hidden">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Mobile Filters */}
          {showFilters && (
            <Card className="lg:hidden">
              <CardContent className="p-4 space-y-4">
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
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex gap-8">
          {/* Desktop Filters Sidebar */}
          <div className="hidden lg:block w-64 space-y-6">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4">Filters</h3>
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
              <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
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
                <Button
                  onClick={() => {
                    setSearchQuery("")
                    setSelectedCategory("all")
                    setOpenOnly(false)
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div
                className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}
              >
                {filteredStores.map((store, index) => (
                  <Link key={store.id} href={`/store/${store.id}`}>
                    <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer hover-lift animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
                      <CardContent className="p-0">
                        {viewMode === "grid" ? (
                          <div>
                            <div className="relative overflow-hidden">
                              <img
                                src={store.storeImage || "/placeholder.svg"}
                                alt={store.storeName}
                                className="w-full h-48 object-cover rounded-t-lg transition-transform duration-500 group-hover:scale-110"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                }}
                              >
                                <Heart className="w-4 h-4" />
                              </Button>
                              {!store.isOpen && (
                                <Badge variant="secondary" className="absolute bottom-2 left-2">
                                  Closed
                                </Badge>
                              )}
                              {store.isOpen && (
                                <Badge variant="default" className="absolute bottom-2 left-2 bg-green-600">
                                  Open
                                </Badge>
                              )}
                            </div>
                            <div className="p-4 space-y-3">
                              <div>
                                <h3 className="font-semibold text-lg group-hover:text-primary">{store.storeName}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2">{store.storeDescription}</p>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <div className="flex items-center">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`w-4 h-4 ${
                                        i < Math.floor(store.rating) ? "text-yellow-400 fill-current" : "text-gray-300"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-sm font-medium">{store.rating}</span>
                                <span className="text-sm text-muted-foreground">({store.reviewCount} reviews)</span>
                              </div>

                              <div className="flex items-center justify-between text-sm text-muted-foreground">
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

                              <div className="pt-2">
                                <p className="text-xs text-muted-foreground">
                                  Min order: ₦{store.minimumOrder.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-4 p-4">
                            <div className="relative">
                              <img
                                src={store.storeImage || "/placeholder.svg"}
                                alt={store.storeName}
                                className="w-24 h-24 object-cover rounded-lg"
                              />
                              {!store.isOpen ? (
                                <Badge variant="secondary" className="absolute -top-1 -right-1 text-xs">
                                  Closed
                                </Badge>
                              ) : (
                                <Badge variant="default" className="absolute -top-1 -right-1 text-xs bg-green-600">
                                  Open
                                </Badge>
                              )}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div>
                                <h3 className="font-semibold group-hover:text-primary">{store.storeName}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-1">{store.storeDescription}</p>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <div className="flex items-center">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`w-3 h-3 ${
                                        i < Math.floor(store.rating) ? "text-yellow-400 fill-current" : "text-gray-300"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-sm font-medium">{store.rating}</span>
                                <span className="text-xs text-muted-foreground">({store.reviewCount})</span>
                              </div>

                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{store.deliveryTime}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Truck className="w-3 h-3" />
                                  <span>₦{store.deliveryFee}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span>{store.address}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
