"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Store, RefreshCw, Filter, MapPin, Clock, Users } from "lucide-react"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Skeleton } from "@/components/ui/skeleton"
import Image from "next/image"
import { useRouter } from "next/navigation"

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

export default function ShopPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stores, setStores] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [sortBy, setSortBy] = useState("name")
  const [refreshing, setRefreshing] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    fetchStores()
  }, [selectedCategory])

  const fetchStores = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      if (selectedCategory !== "all") {
        params.append("category", selectedCategory)
      }
      
      params.append("limit", "20")
      
      const response = await fetch(`/api/database/stores?${params}&t=${Date.now()}`)
      const data = await response.json()
      
      if (data.success) {
        setStores(data.data || [])
      } else {
        console.error("Failed to fetch stores:", data.error)
        setStores([])
      }
    } catch (error) {
      console.error("Error fetching stores:", error)
      setStores([])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchStores()
    setRefreshing(false)
  }

  const filteredStores = stores.filter((store) => {
    const matchesSearch = searchQuery === "" || 
      (store.name || store.storeName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (store.description || store.storeDescription || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (store.category || "").toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesSearch
  })

  const handleStoreClick = (storeId: string) => {
    setIsTransitioning(true)
    setTimeout(() => {
      router.push(`/store/${storeId}`)
    }, 600) // Duration matches the CSS animation
  }

  const sortedStores = [...filteredStores].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return (a.name || "").localeCompare(b.name || "")
      case "newest":
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      case "products":
        return (b.productCount || 0) - (a.productCount || 0)
      default:
        return 0
    }
  })

  const StoreCard = ({ store }: { store: any }) => (
    <Card className="h-full hover:shadow-2xl hover:shadow-accent/40 hover:scale-[1.02] transition-all duration-300 group overflow-hidden border-none rounded-[2.5rem] relative" style={{ fontFamily: '"Montserrat", "Inter", system-ui, sans-serif' }}>
      {/* Full Image Background */}
      <div className="aspect-[9/16] relative overflow-hidden rounded-[2.5rem]">
        {store.profileImage || store.featuredProduct?.image || store.productImages?.[0] || store.bannerImage ? (
          <Image
            src={store.profileImage || store.featuredProduct?.image || store.productImages?.[0] || store.bannerImage}
            alt={store.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-accent/90 via-orange-500/90 to-red-600/90">
            <Store className="h-20 w-20 text-white drop-shadow-lg animate-pulse" />
          </div>
        )}
        
        {/* Dark overlay gradient at bottom for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent via-50% to-black/90" />
        
        {/* Logo in Center Top */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="w-16 h-16 rounded-full bg-white border-4 border-white overflow-hidden shadow-2xl ring-4 ring-white/30 group-hover:ring-white/50 transition-all group-hover:scale-110">
            {store.storeImage || store.logoImage ? (
              <Image
                src={store.storeImage || store.logoImage}
                alt={`${store.name} logo`}
                width={64}
                height={64}
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent to-orange-500 flex items-center justify-center">
                <Store className="h-8 w-8 text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Content Overlay at Bottom - Full Width */}
        <div className="absolute bottom-0 left-0 right-0 z-10 backdrop-blur-md bg-black/20 rounded-b-[2.5rem] border-t border-white/10 p-3 sm:p-4">
          <div className="flex items-start justify-between w-full gap-2 mb-1.5">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold tracking-tight mb-0.5 text-white drop-shadow-lg truncate">
                {store.name || "Unnamed Store"}
              </h3>
              <div className="flex items-center text-[10px] sm:text-xs font-medium text-white/90 tracking-wide mb-1.5">
                <MapPin className="h-3 w-3 mr-1 shrink-0" />
                <span className="truncate">{store.location || store.city || "Location not specified"}</span>
              </div>
              
              {store.category && (
                <Badge variant="outline" className="w-fit text-[10px] font-semibold py-0.5 px-2 h-5 tracking-wide border-2 border-white/40 bg-white/10 text-white backdrop-blur-sm">
                  {categories.find(c => c.id === store.category)?.name || store.category}
                </Badge>
              )}
            </div>

            {/* Arrow Button */}
            <Link href={`/store/${store._id || store.id}`} onClick={(e) => {
              e.preventDefault()
              handleStoreClick(store._id || store.id)
            }}>
              <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 hover:bg-accent hover:text-white transition-all duration-200 cursor-pointer group/arrow">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent group-hover/arrow:text-white transition-colors group-hover/arrow:translate-x-0.5">
                  <path d="M5 12h14"/>
                  <path d="m12 5 7 7-7 7"/>
                </svg>
              </div>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-medium text-white/80 tracking-wide">
            <div className="flex items-center gap-0.5 sm:gap-1">
              <Users className="h-3 w-3" />
              <span>{store.productCount || 0} products</span>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1">
              <Clock className="h-3 w-3" />
              <span>Est. {new Date(store.createdAt || Date.now()).getFullYear()}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <style jsx global>{`
        @keyframes slideOutLeft {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(-100%);
            opacity: 0;
          }
        }
        
        .page-slide-transition {
          animation: slideOutLeft 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
      
      <div className={isTransitioning ? 'page-slide-transition' : ''}>
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Header with Title and Filters */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <h1 className="text-5xl md:text-7xl font-black tracking-wider uppercase" style={{ fontFamily: '"Bebas Neue", "Impact", sans-serif' }}>
            <span className="drop-shadow-[0_2px_2px_oklch(0.35_0.15_15/0.5)]" style={{WebkitTextFillColor: 'white', WebkitTextStroke: '1px oklch(0.35 0.15 15)', color: 'white'}}>ALL STORES</span>
          </h1>
          
          {/* Filter Section */}
          <div className="flex items-center gap-3 p-4 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50">
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
              placeholder="Search stores by name, category, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 border-2 focus:border-primary transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="products">Most Products</SelectItem>
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
            {loading ? "Loading stores..." : `Showing ${sortedStores.length} store${sortedStores.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Stores Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="h-full">
                <Skeleton className="aspect-video rounded-t-lg" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-5 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full mb-4" />
                  <div className="flex justify-between mb-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedStores.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 animate-in fade-in duration-500">
            {sortedStores.map((store) => (
              <StoreCard key={store._id || store.id} store={store} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24" style={{ fontFamily: '"Bebas Neue", "Impact", sans-serif' }}>
            <div className="inline-flex p-8 bg-linear-to-br from-accent/20 to-orange-500/20 rounded-full mb-8 border-4 border-accent/20 shadow-2xl shadow-accent/20 animate-pulse">
              <Store className="h-24 w-24 text-accent" />
            </div>
            <h3 className="text-5xl font-black mb-4 tracking-wider uppercase">NO STORES FOUND BESTIE</h3>
            <p className="text-muted-foreground text-xl font-bold mb-8 max-w-md mx-auto uppercase tracking-wide">
              TRY DIFFERENT FILTERS OR SEARCH TERMS TO FIND UR VIBE
            </p>
            <Button onClick={handleRefresh} size="lg" className="bg-linear-to-r from-accent to-orange-600 hover:from-orange-600 hover:to-accent text-white font-black text-xl px-8 py-6 rounded-full shadow-2xl shadow-accent/30 hover:scale-105 transition-all uppercase tracking-wider">
              <RefreshCw className="h-5 w-5 mr-2" />
              REFRESH FR
            </Button>
          </div>
        )}
      </main>

      <Footer />
      </div>
    </div>
  )
}