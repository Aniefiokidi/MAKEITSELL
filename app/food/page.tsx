"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Clock, MapPin, UtensilsCrossed, ArrowRight } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import Header from "@/components/Header"
import { buildPublicStorePath } from "@/lib/public-links"

function resolveImg(src?: string) {
  if (!src) return "/placeholder.svg"
  const n = src.trim()
  if (!n) return "/placeholder.svg"
  if (/\.pdf(\?|#|$)/i.test(n)) return "/placeholder.svg"
  if (n.startsWith("/") || n.startsWith("data:image/")) return n
  if (/^https?:\/\//i.test(n) && /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)(\?|#|$)/i.test(n)) return n
  return "/placeholder.svg"
}

function RestaurantCard({ store }: { store: any }) {
  const banner = store.bannerImage || store.profileImage || store.backgroundImage || store.productImages?.[0]
  const logo = store.storeImage || store.logoImage || store.profileImage
  const isClosed = store.isOpen === false
  const hasLogo = !!logo && resolveImg(logo) !== "/placeholder.svg"

  const location = (() => {
    const city = store.city || (store.address ? String(store.address).split(",")[0]?.trim() : "")
    const state = store.state || (store.address ? String(store.address).split(",")[1]?.trim() : "")
    if (city && state) return `${city}, ${state}`
    return city || state || "Location not specified"
  })()

  return (
    <Link
      href={isClosed ? "#" : buildPublicStorePath(store)}
      className={`block group rounded-2xl overflow-hidden border border-orange-100 shadow-md transition-all duration-300 bg-white ${
        isClosed ? "opacity-60 pointer-events-none grayscale" : "hover:shadow-xl hover:-translate-y-1"
      }`}
    >
      {/* Banner */}
      <div className="relative h-44 bg-gradient-to-br from-orange-400 to-red-500 overflow-hidden">
        {resolveImg(banner) !== "/placeholder.svg" ? (
          <Image
            src={resolveImg(banner)}
            alt={store.name || "Restaurant"}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <UtensilsCrossed className="h-14 w-14 text-white/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {isClosed && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-gray-900 text-white text-xs">Closed</Badge>
          </div>
        )}

        {hasLogo && (
          <div className="absolute bottom-0 left-4 translate-y-1/2 z-10">
            <div className="w-14 h-14 rounded-full border-4 border-white overflow-hidden shadow-lg bg-white">
              <Image
                src={resolveImg(logo)}
                alt={`${store.name} logo`}
                width={56}
                height={56}
                className="object-cover"
              />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className={`p-4 ${hasLogo ? "pt-10" : "pt-4"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-gray-900 truncate">{store.name || "Restaurant"}</h3>
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          </div>
          <div className="shrink-0 w-8 h-8 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center group-hover:bg-orange-600 group-hover:border-orange-600 transition-colors">
            <ArrowRight className="h-4 w-4 text-orange-600 group-hover:text-white transition-colors" />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-orange-700 font-medium bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5">
            <Clock className="h-3 w-3" />
            3–4 hrs prep
          </span>
          {(store.productCount || 0) > 0 && (
            <span className="text-xs text-gray-400">{store.productCount} items on menu</span>
          )}
        </div>
      </div>
    </Link>
  )
}

function RestaurantSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-orange-100 shadow-md bg-white">
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="p-4 pt-10 space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
    </div>
  )
}

export default function FoodPage() {
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const fetchFoodStores = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ category: "food", limit: "50" })
      if (debounced) params.set("search", debounced)
      const res = await fetch(`/api/database/stores?${params}`, { cache: "no-store" })
      const data = await res.json()
      setStores(data.success ? (data.data || []) : [])
    } catch {
      setStores([])
    } finally {
      setLoading(false)
    }
  }, [debounced])

  useEffect(() => {
    void fetchFoodStores()
  }, [fetchFoodStores])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      {/* Hero */}
      <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-4">
            <UtensilsCrossed className="h-8 w-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 tracking-tight">Food & Restaurants</h1>
          <p className="text-orange-100 mb-6 text-sm sm:text-base max-w-md mx-auto">
            Order from local restaurants. Every meal is made fresh — no pre-orders needed, just pick your delivery slot at checkout.
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
            <Input
              placeholder="Search restaurants..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-11 bg-white text-gray-800 border-0 h-12 rounded-full shadow-xl text-sm focus-visible:ring-orange-300"
            />
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 text-center">
        <p className="text-xs sm:text-sm text-amber-800 flex items-center justify-center gap-1.5 flex-wrap">
          <Clock className="h-4 w-4 shrink-0" />
          All meals are made to order — average prep time is{" "}
          <strong>3–4 hours</strong>. Pick a delivery slot when you check out.
        </p>
      </div>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <RestaurantSkeleton key={i} />)}
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-24">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-100 mb-6">
              <UtensilsCrossed className="h-10 w-10 text-orange-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-700 mb-2">No restaurants found</h2>
            <p className="text-gray-500 text-sm">
              {debounced ? `No results for "${debounced}". Try a different search.` : "No food vendors available right now. Check back soon."}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-5">
              {stores.length} restaurant{stores.length !== 1 ? "s" : ""} available
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {stores.map(store => (
                <RestaurantCard key={store._id || store.id} store={store} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
