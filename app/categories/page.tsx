"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { 
  Smartphone, 
  Shirt, 
  Home, 
  Watch, 
  Dumbbell,
  Headphones,
  Camera,
  Book,
  Gamepad2,
  Car,
  Wrench,
  Truck,
  HeartPulse,
  Briefcase,
  Music2,
  Sparkles,
  Coffee,
  Shield,
  Search,
  Settings,
} from "lucide-react"

const categories = [
  {
    slug: "electronics",
    name: "Electronics",
    description: "Latest gadgets, smartphones, computers and more",
    icon: Smartphone,
    color: "bg-blue-500"
  },
  {
    slug: "fashion",
    name: "Fashion",
    description: "Clothing, shoes, bags and accessories",
    icon: Shirt,
    color: "bg-pink-500"
  },
  {
    slug: "home",
    name: "Home & Garden",
    description: "Furniture, decor, kitchen and garden items",
    icon: Home,
    color: "bg-green-500"
  },
  {
    slug: "accessories",
    name: "Accessories",
    description: "Watches, jewelry, bags and more",
    icon: Watch,
    color: "bg-purple-500"
  },
  {
    slug: "sports",
    name: "Sports & Fitness",
    description: "Exercise equipment, sportswear and outdoor gear",
    icon: Dumbbell,
    color: "bg-orange-500"
  },
  {
    slug: "audio",
    name: "Audio & Music",
    description: "Headphones, speakers, instruments",
    icon: Headphones,
    color: "bg-red-500"
  },
  {
    slug: "photography",
    name: "Photography",
    description: "Cameras, lenses, lighting equipment",
    icon: Camera,
    color: "bg-indigo-500"
  },
  {
    slug: "books",
    name: "Books & Media",
    description: "Books, magazines, digital content",
    icon: Book,
    color: "bg-amber-500"
  },
  {
    slug: "gaming",
    name: "Gaming",
    description: "Video games, consoles, accessories",
    icon: Gamepad2,
    color: "bg-teal-500"
  },
  {
    slug: "automotive",
    name: "Automotive",
    description: "Car accessories, tools, parts",
    icon: Car,
    color: "bg-slate-500"
  },
  {
    slug: "home-services",
    name: "Home Services",
    description: "Repairs, maintenance, installation and cleaning",
    icon: Wrench,
    color: "bg-cyan-500"
  },
  {
    slug: "logistics-delivery",
    name: "Logistics & Delivery",
    description: "Moving, delivery and transport services",
    icon: Truck,
    color: "bg-lime-500"
  },
  {
    slug: "health-wellness",
    name: "Health & Wellness",
    description: "Healthcare, wellness and personal care",
    icon: HeartPulse,
    color: "bg-rose-500"
  },
  {
    slug: "business-services",
    name: "Business Services",
    description: "Consulting, accounting and virtual support",
    icon: Briefcase,
    color: "bg-sky-500"
  },
  {
    slug: "events",
    name: "Events & Catering",
    description: "Event planning, catering and coordination",
    icon: Music2,
    color: "bg-fuchsia-500"
  },
  {
    slug: "pet-care",
    name: "Pet Care",
    description: "Pet products, grooming and sitter services",
    icon: Sparkles,
    color: "bg-emerald-500"
  },
  {
    slug: "groceries",
    name: "Groceries",
    description: "Fresh produce, pantry and daily essentials",
    icon: Coffee,
    color: "bg-yellow-600"
  },
  {
    slug: "pharmacy",
    name: "Pharmacy",
    description: "Medicines, wellness and health supplies",
    icon: Shield,
    color: "bg-red-600"
  },
  {
    slug: "furniture",
    name: "Furniture",
    description: "Home and office furniture stores",
    icon: Home,
    color: "bg-stone-500"
  },
  {
    slug: "toys-baby",
    name: "Toys & Baby",
    description: "Kids essentials, toys and baby products",
    icon: Gamepad2,
    color: "bg-violet-500"
  }
]

const serviceSystemCategories = [
  { slug: "photography", name: "Photography", description: "Photo and video sessions", icon: Camera, color: "bg-indigo-500" },
  { slug: "consulting", name: "Consulting", description: "Business and professional advice", icon: Briefcase, color: "bg-sky-500" },
  { slug: "repairs", name: "Repairs & Maintenance", description: "Fixes, installations and upkeep", icon: Wrench, color: "bg-cyan-500" },
  { slug: "design", name: "Design & Creative", description: "Branding, graphics and visuals", icon: Sparkles, color: "bg-pink-500" },
  { slug: "fitness", name: "Fitness & Wellness", description: "Training, coaching and wellness", icon: Dumbbell, color: "bg-orange-500" },
  { slug: "education", name: "Education & Tutoring", description: "Lessons, classes and mentorship", icon: Book, color: "bg-amber-500" },
  { slug: "beauty", name: "Beauty", description: "Personal care and beauty services", icon: Shirt, color: "bg-rose-500" },
  { slug: "cleaning", name: "Cleaning Services", description: "Home and office cleaning", icon: Sparkles, color: "bg-emerald-500" },
  { slug: "tech", name: "Tech Support", description: "Device setup and troubleshooting", icon: Smartphone, color: "bg-blue-500" },
  { slug: "rentals", name: "Rentals", description: "Short and long term rentals", icon: Car, color: "bg-slate-500" },
  { slug: "marketing", name: "Marketing", description: "Promotion and campaign services", icon: Music2, color: "bg-fuchsia-500" },
  { slug: "legal", name: "Legal Services", description: "Legal advice and support", icon: Shield, color: "bg-red-600" },
  { slug: "healthcare", name: "Healthcare & Wellness", description: "Health and care solutions", icon: HeartPulse, color: "bg-rose-500" },
  { slug: "logistics", name: "Logistics & Delivery", description: "Delivery and transport services", icon: Truck, color: "bg-lime-500" },
  { slug: "home-improvement", name: "Home Improvement", description: "Renovation and home projects", icon: Home, color: "bg-green-500" },
  { slug: "automotive", name: "Automotive Services", description: "Vehicle repairs and maintenance", icon: Car, color: "bg-slate-500" },
  { slug: "event-planning", name: "Event Planning", description: "Planning and event coordination", icon: Music2, color: "bg-fuchsia-500" },
  { slug: "moving-relocation", name: "Moving & Relocation", description: "Packing, moving and setup support", icon: Truck, color: "bg-lime-500" },
  { slug: "pet-care", name: "Pet Care", description: "Pet grooming, walking and sitter services", icon: Sparkles, color: "bg-emerald-500" },
  { slug: "childcare", name: "Childcare", description: "Babysitting and child support services", icon: Gamepad2, color: "bg-violet-500" },
  { slug: "elderly-care", name: "Elderly Care", description: "Home support and care assistance", icon: HeartPulse, color: "bg-rose-500" },
  { slug: "laundry-drycleaning", name: "Laundry & Dry Cleaning", description: "Clothing wash and care services", icon: Sparkles, color: "bg-cyan-500" },
  { slug: "catering", name: "Catering & Food Services", description: "Cooks, catering and meal prep", icon: Coffee, color: "bg-yellow-600" },
  { slug: "real-estate", name: "Real Estate Services", description: "Property management and advisory", icon: Home, color: "bg-stone-500" },
  { slug: "accounting-tax", name: "Accounting & Tax", description: "Bookkeeping, payroll and tax support", icon: Briefcase, color: "bg-sky-500" },
  { slug: "writing-translation", name: "Writing & Translation", description: "Content writing and language services", icon: Book, color: "bg-amber-500" },
  { slug: "software-development", name: "Software Development", description: "Web, app and software engineering", icon: Smartphone, color: "bg-blue-500" },
  { slug: "virtual-assistant", name: "Virtual Assistant", description: "Admin and online business support", icon: Briefcase, color: "bg-sky-500" },
  { slug: "security-services", name: "Security Services", description: "Guarding, surveillance and safety", icon: Shield, color: "bg-red-600" },
  { slug: "other", name: "Other Services", description: "Browse all additional services", icon: Settings, color: "bg-gray-500" },
]

const storeSystemCategories = [
  { slug: "electronics", name: "Electronics", description: "Gadgets and devices", icon: Smartphone, color: "bg-blue-500" },
  { slug: "fashion", name: "Fashion", description: "Style and apparel stores", icon: Shirt, color: "bg-pink-500" },
  { slug: "home", name: "Home & Garden", description: "Home essentials and decor", icon: Home, color: "bg-green-500" },
  { slug: "beauty", name: "Beauty & Personal Care", description: "Wellness and beauty products", icon: Sparkles, color: "bg-rose-500" },
  { slug: "sports", name: "Sports & Outdoors", description: "Fitness and outdoor gear", icon: Dumbbell, color: "bg-orange-500" },
  { slug: "automotive", name: "Automotive", description: "Auto parts and accessories", icon: Car, color: "bg-slate-500" },
  { slug: "books", name: "Books & Media", description: "Books and media stores", icon: Book, color: "bg-amber-500" },
  { slug: "food", name: "Food & Beverages", description: "Food and drinks stores", icon: Coffee, color: "bg-yellow-600" },
  { slug: "groceries", name: "Groceries", description: "Daily groceries and essentials", icon: Coffee, color: "bg-yellow-600" },
  { slug: "pharmacy", name: "Pharmacy & Health", description: "Medicines and health supplies", icon: Shield, color: "bg-red-600" },
  { slug: "furniture", name: "Furniture", description: "Home and office furniture", icon: Home, color: "bg-stone-500" },
  { slug: "appliances", name: "Appliances", description: "Home and kitchen appliances", icon: Smartphone, color: "bg-blue-500" },
  { slug: "toys", name: "Toys & Games", description: "Toys and games stores", icon: Gamepad2, color: "bg-violet-500" },
  { slug: "baby", name: "Baby & Kids", description: "Baby and children essentials", icon: Gamepad2, color: "bg-violet-500" },
  { slug: "office-supplies", name: "Office Supplies", description: "Business and office supplies", icon: Briefcase, color: "bg-sky-500" },
  { slug: "pet-supplies", name: "Pet Supplies", description: "Pet food and accessories", icon: Sparkles, color: "bg-emerald-500" },
  { slug: "jewelry", name: "Jewelry & Accessories", description: "Jewelry and lifestyle items", icon: Watch, color: "bg-purple-500" },
  { slug: "hardware", name: "Hardware & Tools", description: "Tools and hardware stores", icon: Wrench, color: "bg-cyan-500" },
  { slug: "other", name: "Other Stores", description: "More marketplace stores", icon: Settings, color: "bg-gray-500" },
]

const serviceSlugToUnifiedSlug: Record<string, string> = {
  repairs: "home-services",
  automotive: "automotive",
  consulting: "business-services",
  catering: "events",
  "event-planning": "events",
  healthcare: "health-wellness",
  fitness: "sports",
  "home-improvement": "home-services",
  logistics: "logistics-delivery",
  "moving-relocation": "logistics-delivery",
  "pet-care": "pet-care",
  childcare: "toys-baby",
  "elderly-care": "health-wellness",
  "laundry-drycleaning": "home-services",
}

const storeSlugToUnifiedSlug: Record<string, string> = {
  electronics: "electronics",
  fashion: "fashion",
  beauty: "health-wellness",
  sports: "sports",
  automotive: "automotive",
  books: "books",
  food: "events",
  groceries: "groceries",
  pharmacy: "pharmacy",
  furniture: "furniture",
  toys: "toys-baby",
  baby: "toys-baby",
  "pet-supplies": "pet-care",
  hardware: "home-services",
  "office-supplies": "business-services",
  home: "home",
}

const categoryToServiceCategories: Record<string, string[]> = {
  electronics: ["tech", "repairs"],
  fashion: ["beauty", "design"],
  home: ["home-improvement", "cleaning", "repairs"],
  accessories: ["design", "other"],
  sports: ["fitness"],
  audio: ["event-planning"],
  automotive: ["automotive", "logistics"],
  photography: ["photography"],
  books: ["education"],
  gaming: ["tech", "other"],
  "home-services": ["home-improvement", "cleaning", "repairs", "laundry-drycleaning"],
  "logistics-delivery": ["logistics", "moving-relocation"],
  "health-wellness": ["healthcare", "fitness", "elderly-care"],
  "business-services": ["consulting", "accounting-tax", "virtual-assistant", "writing-translation", "software-development"],
  events: ["event-planning", "catering"],
  "pet-care": ["pet-care"],
  groceries: ["catering"],
  pharmacy: ["healthcare"],
  furniture: ["home-improvement"],
  "toys-baby": ["childcare"],
}

const categoryToStoreCategories: Record<string, string[]> = {
  electronics: ["electronics"],
  fashion: ["fashion", "beauty"],
  home: ["home", "home-garden"],
  accessories: ["fashion", "other"],
  sports: ["sports"],
  audio: ["electronics"],
  automotive: ["automotive"],
  photography: ["other"],
  books: ["books"],
  gaming: ["electronics"],
  "home-services": ["home", "hardware"],
  "logistics-delivery": ["other"],
  "health-wellness": ["beauty", "pharmacy"],
  "business-services": ["office-supplies"],
  events: ["food", "other"],
  "pet-care": ["pet-supplies"],
  groceries: ["groceries", "food"],
  pharmacy: ["pharmacy"],
  furniture: ["furniture", "home"],
  "toys-baby": ["toys", "baby"],
}

import { Skeleton } from "@/components/ui/skeleton"

type CategoryExplorerItem = {
  key: string
  slug: string
  name: string
  description: string
  icon: any
  color: string
  segment: "goods" | "services" | "stores"
  href: string
  countKind: "goods" | "services" | "stores"
}

const goodsCards: CategoryExplorerItem[] = categories.map((category) => ({
  key: `goods:${category.slug}`,
  slug: category.slug,
  name: category.name,
  description: category.description,
  icon: category.icon,
  color: category.color,
  segment: "goods",
  href: `/category/${category.slug}`,
  countKind: "goods",
}))

const serviceCards: CategoryExplorerItem[] = serviceSystemCategories.map((category) => {
  const unifiedSlug = serviceSlugToUnifiedSlug[category.slug]
  return {
    key: `services:${category.slug}`,
    slug: category.slug,
    name: category.name,
    description: category.description,
    icon: category.icon,
    color: category.color,
    segment: "services",
    href: unifiedSlug ? `/category/${unifiedSlug}` : `/services?category=${encodeURIComponent(category.slug)}`,
    countKind: "services",
  }
})

const storeCards: CategoryExplorerItem[] = storeSystemCategories.map((category) => {
  const unifiedSlug = storeSlugToUnifiedSlug[category.slug]
  return {
    key: `stores:${category.slug}`,
    slug: category.slug,
    name: category.name,
    description: category.description,
    icon: category.icon,
    color: category.color,
    segment: "stores",
    href: unifiedSlug ? `/category/${unifiedSlug}` : `/stores?category=${encodeURIComponent(category.slug)}`,
    countKind: "stores",
  }
})

const allCategoryCards: CategoryExplorerItem[] = [...goodsCards, ...serviceCards, ...storeCards]

const CATEGORY_OVERVIEW_CACHE_KEY = "mis:categories:overview:v2"
const CATEGORY_OVERVIEW_CACHE_TTL_MS = 5 * 60 * 1000

export default function CategoriesPage() {
  const CATEGORIES_SCROLL_KEY = "mis:scroll:categories:list:v1"
  const [categoryImages, setCategoryImages] = useState<{ [key: string]: string }>({})
  const [categoryCounts, setCategoryCounts] = useState<{ [key: string]: number }>({})
  const [loading, setLoading] = useState(true)
  const [segmentFilter, setSegmentFilter] = useState<"all" | "goods" | "services" | "stores">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [showOnlyWithListings, setShowOnlyWithListings] = useState(false)

  const saveScrollPosition = () => {
    if (typeof window === "undefined") return
    sessionStorage.setItem(CATEGORIES_SCROLL_KEY, String(window.scrollY))
  }

  useEffect(() => {
    const fetchCategoryData = async () => {
      if (typeof window !== "undefined") {
        try {
          const cached = sessionStorage.getItem(CATEGORY_OVERVIEW_CACHE_KEY)
          if (cached) {
            const parsed = JSON.parse(cached)
            const isFresh = Date.now() - Number(parsed?.timestamp || 0) < CATEGORY_OVERVIEW_CACHE_TTL_MS
            if (isFresh && parsed?.images && parsed?.counts) {
              setCategoryImages(parsed.images)
              setCategoryCounts(parsed.counts)
              setLoading(false)
              return
            }
          }
        } catch {
          // ignore corrupt cache and proceed with network fetch
        }
      }

      const categoryResults = await Promise.all(
        allCategoryCards.map(async (categoryCard) => {
          try {
            if (categoryCard.countKind === "goods") {
              const countResponse = await fetch(`/api/database/products?category=${categoryCard.slug}&count=true`)
              const countResult = await countResponse.json()
              const productCount = countResult.success ? (countResult.data?.length || countResult.count || 0) : 0

              const serviceCategories = categoryToServiceCategories[categoryCard.slug] || []
              const storeCategories = categoryToStoreCategories[categoryCard.slug] || [categoryCard.slug]

              const [serviceCountResponses, storeCountResponses, topProductResult] = await Promise.all([
                Promise.all(
                  serviceCategories.map((serviceCategory) =>
                    fetch(`/api/database/services?category=${encodeURIComponent(serviceCategory)}&count=true`)
                      .then((res) => res.json())
                      .catch(() => ({ success: false, count: 0, data: [] }))
                  )
                ),
                Promise.all(
                  storeCategories.map((storeCategory) =>
                    fetch(`/api/database/stores?category=${encodeURIComponent(storeCategory)}&count=true`)
                      .then((res) => res.json())
                      .catch(() => ({ success: false, count: 0, data: [] }))
                  )
                ),
                fetch(`/api/database/products?category=${categoryCard.slug}&limit=1&sortBy=popular`)
                  .then((res) => res.json())
                  .catch(() => ({ success: false, data: [] })),
              ])

              const serviceCount = serviceCountResponses.reduce((total, result) => {
                if (!result?.success) return total
                return total + Number(result.count || result.data?.length || 0)
              }, 0)

              const storeCount = storeCountResponses.reduce((total, result) => {
                if (!result?.success) return total
                return total + Number(result.count || result.data?.length || 0)
              }, 0)

              const topProduct = topProductResult?.success && Array.isArray(topProductResult?.data)
                ? topProductResult.data[0]
                : null
              const productImage = topProduct
                ? (Array.isArray(topProduct.images) ? topProduct.images[0] : topProduct.image)
                : null

              return {
                key: categoryCard.key,
                count: productCount + serviceCount + storeCount,
                image: productImage && productImage !== "/placeholder.svg" ? productImage : null,
              }
            }

            const endpoint = categoryCard.countKind === "services" ? "services" : "stores"
            const countResponse = await fetch(`/api/database/${endpoint}?category=${encodeURIComponent(categoryCard.slug)}&count=true`)
            const countResult = await countResponse.json()
            const count = countResult?.success ? Number(countResult.count || countResult.data?.length || 0) : 0

            return { key: categoryCard.key, count, image: null as string | null }
          } catch (error) {
            console.error(`Error fetching data for ${categoryCard.key}:`, error)
            return { key: categoryCard.key, count: 0, image: null as string | null }
          }
        })
      )

      const imageMap: { [key: string]: string } = {}
      const countMap: { [key: string]: number } = {}
      categoryResults.forEach((result) => {
        countMap[result.key] = result.count
        if (result.image) {
          imageMap[result.key] = result.image
        }
      })

      setCategoryImages(imageMap)
      setCategoryCounts(countMap)

      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(
            CATEGORY_OVERVIEW_CACHE_KEY,
            JSON.stringify({
              timestamp: Date.now(),
              images: imageMap,
              counts: countMap,
            })
          )
        } catch {
          // ignore storage quota errors
        }
      }

      setLoading(false)
    }
    fetchCategoryData()
  }, [])

  useEffect(() => {
    if (loading || typeof window === "undefined") return

    const savedScroll = sessionStorage.getItem(CATEGORIES_SCROLL_KEY)
    if (!savedScroll) return

    const targetScroll = Number(savedScroll)
    if (Number.isNaN(targetScroll)) {
      sessionStorage.removeItem(CATEGORIES_SCROLL_KEY)
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

      sessionStorage.removeItem(CATEGORIES_SCROLL_KEY)
    }

    window.requestAnimationFrame(restore)
  }, [loading])

  const normalizedSearch = searchQuery.toLowerCase().trim()

  const visibleCards = allCategoryCards.filter((category) => {
    if (segmentFilter !== "all" && category.segment !== segmentFilter) {
      return false
    }

    if (normalizedSearch) {
      const haystack = `${category.name} ${category.description} ${category.slug}`.toLowerCase()
      if (!haystack.includes(normalizedSearch)) {
        return false
      }
    }

    if (showOnlyWithListings) {
      return Number(categoryCounts[category.key] || 0) > 0
    }

    return true
  })

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
          {/* Header in Glass Bubble */}
          <div className="mb-8 p-6 md:p-8 bg-linear-to-br from-accent/5 via-accent/15 to-accent/50 backdrop-blur-2xl rounded-3xl border border-accent/30 shadow-2xl shadow-accent/20 hover:shadow-3xl hover:shadow-accent/30 transition-all duration-500">
            <div className="animate-fade-in">
              <nav className="text-xs sm:text-sm text-accent mb-2 sm:mb-4">
                <Link href="/" className="hover:text-primary">
                  Home
                </Link>
                <span className="mx-2">/</span>
                <span>Categories</span>
              </nav>
              <h1 className="text-xl sm:text-3xl font-extrabold mb-2 sm:mb-4 text-accent tracking-tight" style={{
                fontFamily: 'Inter, Poppins, Arial, Helvetica, sans-serif',
                textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))'
              }}>SHOP BY CATEGORY</h1>
              <p className="text-accent text-xs sm:text-base">
                Discover all categories across goods, services and stores
              </p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent/70" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search category cards..."
                    className="w-full h-10 rounded-full border border-accent/30 bg-white/80 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowOnlyWithListings((prev) => !prev)}
                  className={`h-10 rounded-full border text-sm font-semibold transition ${showOnlyWithListings ? "bg-accent text-white border-accent" : "bg-white/80 text-accent border-accent/30"}`}
                >
                  {showOnlyWithListings ? "Showing with listings" : "Show listed only"}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { key: "all", label: "All" },
                  { key: "goods", label: "Goods" },
                  { key: "services", label: "Services" },
                  { key: "stores", label: "Stores" },
                ].map((segment) => (
                  <button
                    key={segment.key}
                    type="button"
                    onClick={() => setSegmentFilter(segment.key as "all" | "goods" | "services" | "stores")}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-full border transition ${segmentFilter === segment.key ? "bg-accent text-white border-accent" : "bg-white/80 text-accent border-accent/30"}`}
                  >
                    {segment.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Categories Grid with Loading Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {loading
              ? Array.from({ length: 10 }).map((_, idx) => (
                  <div key={idx} className="h-full">
                    <div className="aspect-9/16 relative overflow-hidden rounded-2xl sm:rounded-3xl">
                      <Skeleton className="absolute inset-0 w-full h-full rounded-2xl sm:rounded-3xl" />
                    </div>
                    <div className="mt-2 space-y-2">
                      <Skeleton className="h-4 w-2/3 rounded-full" />
                      <Skeleton className="h-3 w-1/2 rounded-full" />
                    </div>
                  </div>
                ))
              : visibleCards.map((category, index) => {
                  const IconComponent = category.icon
                  const categoryImage = categoryImages[category.key]
                  return (
                    <Link key={category.key} href={category.href} onClick={saveScrollPosition}>
                      <Card className={`h-full hover:shadow-2xl hover:shadow-accent/40 transition-all duration-300 group overflow-hidden border-none rounded-2xl sm:rounded-3xl relative ${category.slug === 'electronics' ? '' : 'hover:scale-[1.01]'}`} style={{ animationDelay: `${index * 0.05}s` }}>
                        {/* Full Background with Product Image or Gradient */}
                        <div className="aspect-9/16 relative overflow-hidden rounded-2xl sm:rounded-3xl">
                          {categoryImage ? (
                            <>
                              {/* Product Image Background */}
                              <Image
                                src={categoryImage}
                                alt={`Top product in ${category.name}`}
                                fill
                                className={`${category.slug === 'electronics' ? 'object-contain' : 'object-cover'} ${category.slug === 'electronics' ? '' : 'group-hover:scale-105'} transition-transform duration-500`}
                              />
                              {/* Darker overlay for better text readability on images */}
                              <div className="absolute inset-0 bg-linear-to-b from-black/30 via-transparent via-40% to-black/80" />
                            </>
                          ) : (
                            <>
                              {/* Gradient Background for categories without products */}
                              <div className={`flex items-center justify-center h-full ${category.color} bg-linear-to-br from-current via-current to-black/20`}>
                                {/* Background pattern overlay */}
                                <div className="absolute inset-0 opacity-10">
                                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-size-[20px_20px]" />
                                </div>
                              </div>
                              {/* Lighter overlay for gradient backgrounds */}
                              <div className="absolute inset-0 bg-linear-to-b from-black/10 via-transparent via-50% to-black/60" />
                            </>
                          )}
                          {/* Icon/Logo in Center Top */}
                          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white border-4 border-white overflow-hidden shadow-2xl ring-4 ring-white/30 group-hover:ring-white/50 transition-all group-hover:scale-110 flex items-center justify-center">
                              <IconComponent className="h-6 w-6 sm:h-8 sm:w-8 text-gray-700" />
                            </div>
                          </div>
                          {/* Frosted Glass Bubble Content - Store Style */}
                          <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-2.5 md:p-3 backdrop-blur-xl bg-accent/10 border border-white/30 rounded-2xl sm:rounded-3xl z-30 space-y-1 gap-1 sm:gap-2">
                            <Badge
                              variant="outline"
                              role="button"
                              className="inline-flex w-full text-[10px] sm:text-xs md:text-sm font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 shadow cursor-pointer hover:opacity-90 transition min-h-5 sm:min-h-6 items-center justify-center text-center leading-tight bg-accent text-white"
                              style={{
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                hyphens: 'auto',
                                lineHeight: '1.2'
                              }}
                            >
                              <span className="line-clamp-1">
                                {category.name}
                              </span>
                            </Badge>
                            <div className="flex items-center justify-between gap-1 sm:gap-2">
                              <Badge variant="outline" className="text-[9px] sm:text-[10px] md:text-xs backdrop-blur-sm border-white/50 px-1 sm:px-1.5 py-0 text-white bg-accent">
                                {categoryCounts[category.key] ? `${categoryCounts[category.key]} listings` : 'No listings yet'}
                              </Badge>
                              <div className="shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/70 flex items-center justify-center shadow hover:scale-110 active:scale-95 hover:bg-white transition-all duration-200 cursor-pointer group/arrow">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent group-hover/arrow:translate-x-0.5 transition-transform">
                                  <path d="M5 12h14" />
                                  <path d="m12 5 7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                            <p className="text-[9px] sm:text-[10px] text-white/90 line-clamp-2 leading-tight">
                              {category.description}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  )
                })}
          </div>

          {/* Popular Categories */}
          <div className="mt-8 sm:mt-12 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-6" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>Popular Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              {goodsCards.slice(0, 4).map((category, index) => (
                <Link 
                  key={`popular-${category.slug}`} 
                  href={category.href}
                  onClick={saveScrollPosition}
                  className="group animate-scale-in hover-lift"
                  style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                >
                  <div className="bg-muted/50 rounded-lg p-2 sm:p-4 text-center hover:bg-muted transition-colors">
                    <div className={`${category.color} w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3 text-white`}>
                      <category.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="font-medium text-xs sm:text-base group-hover:text-accent transition-colors truncate">
                      {category.name}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      
    </>
  )
}
