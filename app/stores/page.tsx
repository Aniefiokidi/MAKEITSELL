"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Store, RefreshCw, Filter, MapPin, Clock, Users, Package, Wrench, ArrowRight, ExternalLink } from "lucide-react"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Skeleton } from "@/components/ui/skeleton"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { initPersonalizationSync, personalizeStores, trackSearch, trackStoreView } from "@/lib/personalization"
import { buildPublicStorePath } from "@/lib/public-links"

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
  { id: "groceries", name: "Groceries" },
  { id: "pharmacy", name: "Pharmacy & Health" },
  { id: "furniture", name: "Furniture" },
  { id: "appliances", name: "Appliances" },
  { id: "toys", name: "Toys & Games" },
  { id: "baby", name: "Baby & Kids" },
  { id: "office-supplies", name: "Office Supplies" },
  { id: "pet-supplies", name: "Pet Supplies" },
  { id: "jewelry", name: "Jewelry & Accessories" },
  { id: "hardware", name: "Hardware & Tools" },
  { id: "other", name: "Other" },
]

const getCompactPagination = (currentPage: number, totalPages: number): Array<number | string> => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis-right", totalPages]
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis-left", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, "ellipsis-left", currentPage - 1, currentPage, currentPage + 1, "ellipsis-right", totalPages]
}

export default function ShopPage() {
  const STORES_SCROLL_KEY = "mis:scroll:stores:list:v1"
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stores, setStores] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedLocation, setSelectedLocation] = useState("all")
  const [locationOptions, setLocationOptions] = useState<string[]>([])
  const [sortBy, setSortBy] = useState("for-you")
  const [refreshing, setRefreshing] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionDirection, setTransitionDirection] = useState<"left" | "right">("left")
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalStores, setTotalStores] = useState(0)
  const itemsPerPage = 20

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim())
    }, 250)

    return () => clearTimeout(timeout)
  }, [searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchQuery, selectedCategory, selectedLocation, sortBy])

  useEffect(() => {
    void initPersonalizationSync()
  }, [])

  useEffect(() => {
    if (!debouncedSearchQuery) return
    trackSearch(debouncedSearchQuery, "stores")
  }, [debouncedSearchQuery])

  useEffect(() => {
    fetchStores()
  }, [debouncedSearchQuery, selectedCategory, selectedLocation, sortBy, currentPage])

  const fetchStores = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      if (selectedCategory !== "all") {
        params.append("category", selectedCategory)
      }

      if (debouncedSearchQuery) {
        params.append("search", debouncedSearchQuery)
      }

      if (selectedLocation !== "all") {
        params.append("location", selectedLocation)
      }

      params.append("sortBy", sortBy)
      params.append("page", String(currentPage))
      params.append("limit", String(itemsPerPage))
      
      const response = await fetch(`/api/database/stores?${params}`, { cache: "no-store" })
      const data = await response.json()
      
      if (data.success) {
        const rawStores = data.data || []
        const shouldPersonalize = sortBy === "for-you" && selectedCategory === "all"
        const rankedStores = shouldPersonalize ? personalizeStores(rawStores) : rawStores
        const pinnedStores = [...rankedStores]

        const pinnedIndex = pinnedStores.findIndex((store) => {
          const name = String(store?.name || store?.storeName || "").trim().toLowerCase()
          return name === "jlc" && store?.isOpen !== false
        })

        if (pinnedIndex > 0) {
          const [pinnedStore] = pinnedStores.splice(pinnedIndex, 1)
          pinnedStores.unshift(pinnedStore)
        }

        setStores(pinnedStores)
        setLocationOptions(Array.isArray(data.locationOptions) ? data.locationOptions : [])
        setTotalPages(Math.max(1, Number(data?.pagination?.totalPages || 1)))
        setTotalStores(Math.max(0, Number(data?.pagination?.total || 0)))
      } else {
        console.error("Failed to fetch stores:", data.error)
        setStores([])
        setLocationOptions([])
        setTotalPages(1)
        setTotalStores(0)
      }
    } catch (error) {
      console.error("Error fetching stores:", error)
      setStores([])
      setLocationOptions([])
      setTotalPages(1)
      setTotalStores(0)
    } finally {
      setLoading(false)
    }
  }

  const saveScrollPosition = () => {
    if (typeof window === "undefined") return
    sessionStorage.setItem(STORES_SCROLL_KEY, String(window.scrollY))
  }

  useEffect(() => {
    if (loading || typeof window === "undefined") return

    const savedScroll = sessionStorage.getItem(STORES_SCROLL_KEY)
    if (!savedScroll) return

    const targetScroll = Number(savedScroll)
    if (Number.isNaN(targetScroll)) {
      sessionStorage.removeItem(STORES_SCROLL_KEY)
      return
    }

    let attempts = 0
    const maxAttempts = 8

    const restore = () => {
      window.scrollTo({ top: targetScroll, behavior: "auto" })
      attempts += 1

      if (attempts < maxAttempts && Math.abs(window.scrollY - targetScroll) > 2) {
        window.requestAnimationFrame(restore)
        return
      }

      sessionStorage.removeItem(STORES_SCROLL_KEY)
    }

    window.requestAnimationFrame(restore)
  }, [loading])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchStores()
    setRefreshing(false)
  }

  const isPdfAsset = (value?: string) => {
    if (!value) return false
    return /\.pdf(\?|#|$)/i.test(value)
  }

  const resolveStoreImageSrc = (value?: string, fallbackValue?: string) => {
    if (!value) return "/placeholder.svg"
    const normalized = value.trim()
    if (!normalized) return "/placeholder.svg"
    if (isPdfAsset(normalized)) return "/placeholder.svg"
    if (normalized.startsWith("data:image/")) return normalized
    if (normalized.startsWith("/")) return normalized

    const isHttpUrl = /^https?:\/\//i.test(normalized)
    const looksLikeImageFile = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)(\?|#|$)/i.test(normalized)

    if (isHttpUrl && looksLikeImageFile) return normalized

    if (fallbackValue && fallbackValue !== value) {
      return resolveStoreImageSrc(fallbackValue)
    }

    return "/placeholder.svg"
  }

  const handleStoreClick = (store: any) => {
    trackStoreView(store)
    saveScrollPosition()
    setTransitionDirection("left")
    setIsTransitioning(true)
    setTimeout(() => {
      router.push(buildPublicStorePath(store))
    }, 220)
  }

  const handlePageSwitch = (target: string, direction: "left" | "right") => {
    setTransitionDirection(direction)
    setIsTransitioning(true)
    setTimeout(() => {
      router.push(target)
    }, 220)
  }

  const paginationItems = useMemo(() => getCompactPagination(currentPage, totalPages), [currentPage, totalPages])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const renderPaginationControls = () => {
    if (loading || totalPages <= 1) return null

    const changePage = (nextPage: number) => {
      if (nextPage === currentPage) return
      setCurrentPage(nextPage)
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    }

    return (
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => changePage(Math.max(1, currentPage - 1))}
        >
          Previous
        </Button>
        {paginationItems.map((item, idx) =>
          typeof item === "number" ? (
            <Button
              key={`page-${item}`}
              variant={item === currentPage ? "default" : "outline"}
              size="sm"
              onClick={() => changePage(item)}
              className="min-w-9"
            >
              {item}
            </Button>
          ) : (
            <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground select-none">...</span>
          )
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => changePage(Math.min(totalPages, currentPage + 1))}
        >
          Next
        </Button>
      </div>
    )
  }

  const StoreCard = ({ store }: { store: any }) => (
    (() => {
      const firstProductImage = store.featuredProduct?.image || store.productImages?.[0]
      const backgroundImageCandidate = store.profileImage || store.bannerImage || store.backgroundImage || firstProductImage
      const logoImageCandidate = store.storeImage || store.logoImage || store.profileImage || firstProductImage
      const isClosed = store.isOpen === false

      const storeBrandingPdfUrl = [
        store.storeImage,
        store.logoImage,
        store.profileImage,
        store.bannerImage,
        store.backgroundImage,
      ].find((value) => isPdfAsset(value))

      return (
    <Card className={`h-full transition-all duration-300 group overflow-hidden border-none rounded-2xl relative ${isClosed ? "grayscale opacity-75" : "hover:shadow-2xl hover:shadow-accent/40 hover:scale-[1.02]"}`} style={{ fontFamily: '"Montserrat", "Inter", system-ui, sans-serif' }}>
      {/* Full Image Background */}
      <div className="aspect-9/16 relative overflow-hidden rounded-2xl">
        {backgroundImageCandidate ? (
          <Image
            src={resolveStoreImageSrc(backgroundImageCandidate, firstProductImage)}
            alt={store.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-linear-to-br from-accent/90 via-orange-500/90 to-red-600/90">
            <Store className="h-20 w-20 text-white drop-shadow-lg animate-pulse" />
          </div>
        )}
        
        {/* Dark overlay gradient at bottom for text readability */}
        <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent via-50% to-black/90" />
        {isClosed && (
          <div className="absolute inset-0 bg-slate-900/35 z-5" />
        )}

        {isClosed && (
          <div className="absolute top-4 right-4 z-30">
            <Badge className="bg-slate-800/90 text-white border border-white/20 uppercase tracking-wide text-[10px]">Closed Store</Badge>
          </div>
        )}
        
        {/* Logo in Center Top */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="w-16 h-16 rounded-full bg-white border-4 border-white overflow-hidden shadow-2xl ring-4 ring-white/30 group-hover:ring-white/50 transition-all group-hover:scale-110">
            {logoImageCandidate ? (
              <Image
                src={resolveStoreImageSrc(logoImageCandidate, firstProductImage)}
                alt={`${store.name} logo`}
                width={64}
                height={64}
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-accent to-orange-500 flex items-center justify-center">
                <Store className="h-8 w-8 text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Content Overlay at Bottom - Full Width */}
        <div className="absolute bottom-0 left-0 right-0 z-10 backdrop-blur-md bg-black/20 rounded-b-2xl border-t border-white/10 p-3 sm:p-4">
          <div className="flex items-start justify-between w-full gap-1 mb-1">
            <div className="flex-1 min-w-0">
              <h3 className="text-xs sm:text-base md:text-lg font-bold tracking-tight mb-0.5 text-white drop-shadow-lg truncate">
                {store.name || "Unnamed Store"}
              </h3>
              <div className="flex items-center text-[8px] sm:text-xs font-medium text-white/90 tracking-wide mb-1">
                <MapPin className="h-2.5 w-2.5 mr-0.5 shrink-0" />
                <span className="truncate">{store.location || store.city || "Location not specified"}</span>
              </div>
              
              {store.category && (
                <Badge variant="outline" className="inline-flex max-w-full text-[clamp(6px,1.9vw,9px)] sm:text-[10px] font-semibold py-0.5 px-1 sm:px-1.5 h-4 sm:h-5 tracking-wide border-2 border-white/40 bg-white/10 text-white backdrop-blur-sm whitespace-nowrap">
                  {categories.find(c => c.id === store.category)?.name || store.category}
                </Badge>
              )}
              {isClosed && (
                <p className="mt-1 text-[8px] sm:text-[10px] uppercase font-bold tracking-wider text-white/90">Temporarily closed</p>
              )}
            </div>

            {/* Arrow Button */}
            <Link href={buildPublicStorePath(store)} onClick={(e) => {
              e.preventDefault()
              handleStoreClick(store)
            }}>
              <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 hover:bg-accent hover:text-white transition-all duration-200 cursor-pointer group/arrow">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent group-hover/arrow:text-white transition-colors group-hover/arrow:translate-x-0.5">
                  <path d="M5 12h14"/>
                  <path d="m12 5 7 7-7 7"/>
                </svg>
              </div>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 text-[7px] sm:text-[10px] md:text-[11px] font-medium text-white/80 tracking-wide">
            <div className="flex items-center gap-0.5">
              <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span className="hidden sm:inline">{store.productCount || 0} products</span>
              <span className="sm:hidden">{store.productCount || 0}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span className="hidden sm:inline">Est. {new Date(store.createdAt || Date.now()).getFullYear()}</span>
              <span className="sm:hidden">{new Date(store.createdAt || Date.now()).getFullYear()}</span>
            </div>
          </div>
          {storeBrandingPdfUrl && (
            <div className="mt-2">
              <a
                href={storeBrandingPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[9px] sm:text-[11px] font-semibold text-white/90 hover:text-white underline underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                View Brand PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </Card>
      )
    })()
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

        @keyframes pageFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes ctaArrowNudge {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(5px);
          }
        }
        
        .page-slide-transition {
          animation: slideOutLeft 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .page-slide-transition-right {
          animation: slideOutRight 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .page-enter-fade {
          animation: pageFadeIn 0.35s ease-out;
        }
      `}</style>
      
      <div className={`${isTransitioning ? (transitionDirection === 'right' ? 'page-slide-transition-right' : 'page-slide-transition') : 'page-enter-fade'}`}>
      <Header  />
      
      <main className="flex-1 container mx-auto px-2 sm:px-4 pt-6 sm:pt-8 pb-4 sm:pb-6">
        {/* Unified Header Bar */}
        <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
          {/* First Row - Products Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {/* View All Products Button */}
              <Link href="/products" className="inline-block sm:shrink-0 flex-1 sm:flex-none">
                <Button 
                  className="w-full sm:w-auto bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-accent/30 text-accent font-bold text-xs sm:text-sm px-3 sm:px-6 py-3 sm:py-3 rounded-full shadow-lg shadow-white/10 hover:shadow-xl hover:shadow-white/20 transition-all duration-200 active:scale-95 hover:border-white/40 flex items-center justify-center gap-2"
                  style={{ fontFamily: '"Montserrat", "Inter", system-ui, sans-serif' }}
                >
                  <Package className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>View All Products</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="hidden sm:inline">
                    <path d="M5 12h14"/>
                    <path d="m12 5 7 7-7 7"/>
                  </svg>
                </Button>
              </Link>

              <Button
                type="button"
                variant="outline"
                onClick={() => handlePageSwitch("/services", "right")}
                className="group inline-flex sm:shrink-0 flex-1 sm:flex-none xl:hidden w-full sm:w-auto h-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-accent/30 text-accent font-bold text-xs sm:text-sm px-3 sm:px-5 py-3 rounded-full shadow-lg shadow-white/10 hover:shadow-xl hover:shadow-white/20 transition-all duration-200 active:scale-95 hover:border-white/40 items-center justify-center gap-2"
                style={{ fontFamily: '"Montserrat", "Inter", system-ui, sans-serif' }}
              >
                <Wrench className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Check out Services</span>
                <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" style={{ animation: 'ctaArrowNudge 1s ease-in-out infinite' }} />
              </Button>
            </div>

            {/* Controls Row */}
            <div className="flex items-center gap-1 sm:gap-3 w-full sm:flex-1">
              {/* Mobile Search Icon */}
              <Button
                variant="outline"
                size="icon"
                className="sm:hidden h-10 w-10 shrink-0 border-accent/20 hover:border-accent/40 transition-all p-1"
                onClick={() => setShowMobileSearch(!showMobileSearch)}
              >
                <Search className="h-4 w-4" />
              </Button>

              {/* Desktop Search Bar */}
              <div className="hidden sm:flex flex-1 relative group">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 group-focus-within:text-primary transition-colors" />
                <Input
                  type="text"
                  placeholder="Search stores..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 border-2 focus:border-primary transition-colors w-full text-sm"
                />
              </div>

              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="flex-1 sm:w-auto border-2 border-accent/20 hover:border-accent/40 transition-colors h-10 text-xs sm:text-sm p-2">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id} className="text-xs sm:text-sm">
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="flex-1 sm:w-auto border-2 border-accent/20 hover:border-accent/40 transition-colors h-10 text-xs sm:text-sm p-2">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs sm:text-sm">All Locations</SelectItem>
                  {locationOptions.map((location) => (
                    <SelectItem key={location} value={location} className="text-xs sm:text-sm">
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="flex-1 sm:w-auto h-10 text-xs sm:text-sm border-2 border-accent/20 hover:border-accent/40 transition-colors p-2">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="for-you" className="text-xs sm:text-sm">For You</SelectItem>
                  <SelectItem value="name" className="text-xs sm:text-sm">Name A-Z</SelectItem>
                  <SelectItem value="newest" className="text-xs sm:text-sm">Newest</SelectItem>
                  <SelectItem value="products" className="text-xs sm:text-sm">Most Products</SelectItem>
                </SelectContent>
              </Select>

              {/* Refresh */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
                className="hover:scale-110 hover:bg-accent/10 transition-all h-10 w-10 sm:w-12 shrink-0 border-accent/20 hover:border-accent/40 p-1"
              >
                <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Clear Button Row (only when category filter is active) */}
          {(selectedCategory !== "all" || selectedLocation !== "all") && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCategory("all")
                  setSelectedLocation("all")
                  setCurrentPage(1)
                }}
                className="text-[10px] sm:text-xs hover:text-accent hover:bg-accent/10 transition-all h-7 sm:h-8"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Search Slide Out */}
        {showMobileSearch && (
          <div className="sm:hidden mb-4 overflow-hidden animate-in slide-in-from-top-2 duration-300">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-primary transition-colors" />
              <Input
                type="text"
                placeholder="Search stores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 border-2 focus:border-primary transition-colors w-full text-xs sm:text-sm"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="mb-6 sm:mb-8">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {loading ? "Loading stores..." : `Showing ${totalStores === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, totalStores)} of ${totalStores} store${totalStores !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="mb-4 sm:mb-6">{renderPaginationControls()}</div>

        {/* Stores Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
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
        ) : stores.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5 lg:gap-6 animate-in fade-in duration-500">
            {stores.map((store) => (
              <StoreCard key={store._id || store.id} store={store} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 sm:py-24" style={{ fontFamily: '"Bebas Neue", "Impact", sans-serif' }}>
            <div className="inline-flex p-4 sm:p-8 bg-linear-to-br from-accent/20 to-orange-500/20 rounded-full mb-4 sm:mb-8 border-4 border-accent/20 shadow-2xl shadow-accent/20 animate-pulse">
              <Store className="h-12 w-12 sm:h-24 sm:w-24 text-accent" />
            </div>
            <h3 className="text-2xl sm:text-5xl font-black mb-2 sm:mb-4 tracking-wider uppercase">NO STORES</h3>
            <p className="text-muted-foreground text-xs sm:text-xl font-bold mb-4 sm:mb-8 max-w-md mx-auto uppercase tracking-wide px-2">
              TRY DIFFERENT FILTERS OR SEARCH
            </p>
            <Button onClick={handleRefresh} size="sm" className="bg-linear-to-r from-accent to-orange-600 hover:from-orange-600 hover:to-accent text-white font-black text-xs sm:text-xl px-4 sm:px-8 py-2 sm:py-6 rounded-full shadow-2xl shadow-accent/30 hover:scale-105 transition-all uppercase tracking-wider">
              <RefreshCw className="h-3 w-3 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">REFRESH</span>
              <span className="sm:hidden">REFRESH</span>
            </Button>
          </div>
        )}

        <div className="mt-6 sm:mt-8">{renderPaginationControls()}</div>
      </main>

      
      </div>
    </div>
  )
}