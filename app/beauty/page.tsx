"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Header from "@/components/Header"
import { Search, MapPin, Star, Clock, Banknote, ChevronRight, Sparkles, Heart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buildPublicServicePath } from "@/lib/public-links"

// ─── Specialty filter definitions ────────────────────────────────────────────

const SPECIALTIES = [
  { key: "all",           label: "All" },
  { key: "nail",          label: "Nail Tech" },
  { key: "lash",          label: "Lash Tech" },
  { key: "hair-braiding", label: "Hair Braiding" },
  { key: "makeup",        label: "Makeup Artist" },
  { key: "hair-styling",  label: "Hair Styling" },
  { key: "skincare",      label: "Skincare" },
  { key: "eyebrow",       label: "Eyebrows" },
  { key: "massage",       label: "Massage & Spa" },
  { key: "waxing",        label: "Waxing" },
]

const DEFAULT_BEAUTY_PHOTOS = [
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&h=800&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=600&h=800&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&h=800&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=800&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&h=800&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=600&h=800&fit=crop&auto=format",
]

// ─── Specialty matching ───────────────────────────────────────────────────────

// subcategory values set by vendors (nail-tech, lash-tech, etc.)
const SPECIALTY_SUBCATEGORY_MAP: Record<string, string> = {
  "nail":          "nail-tech",
  "lash":          "lash-tech",
  "hair-braiding": "hair-braiding",
  "makeup":        "makeup-artist",
  "hair-styling":  "hair-styling",
  "skincare":      "skincare",
  "eyebrow":       "eyebrows",
  "massage":       "massage-spa",
  "waxing":        "waxing",
}

function matchesSpecialty(service: any, specialty: string): boolean {
  if (specialty === "all") return true
  // Prefer the explicit subcategory field set by the vendor
  const sub = (service.subcategory || "").toLowerCase()
  if (sub && sub === SPECIALTY_SUBCATEGORY_MAP[specialty]) return true
  // Fallback: keyword match on title + description only (no subcategory to avoid circular match)
  const text = `${service.title || ""} ${service.description || ""}`.toLowerCase()
  switch (specialty) {
    case "nail":          return /\bnail\b|manicure|pedicure|nail art|press.on|gel nail|acrylic nail/i.test(text)
    case "lash":          return /\blash\b|eyelash|lash extension|lash lift/i.test(text)
    case "hair-braiding": return /braid|twist|\bloc\b|dreadlock|cornrow|knotless|faux loc/i.test(text)
    case "makeup":        return /\bmakeup\b|make.up|\bmua\b|foundation|contouring|\bglam\b|airbrush makeup/i.test(text)
    case "hair-styling":  return /hair stylist|hair styling|relaxer|blow.?out|haircut|silk press|keratin/i.test(text)
    case "skincare":      return /skincare|skin care|facial|esthetician|acne treatment|chemical peel|microderm/i.test(text)
    case "eyebrow":       return /eyebrow|brow arch|brow tint|brow threading|microblad/i.test(text)
    case "massage":       return /massage|body scrub|relaxation massage|steam/i.test(text)
    case "waxing":        return /\bwax\b|waxing|sugaring|epilat/i.test(text)
    default:              return true
  }
}

function getProviderImage(service: any, fallbackIndex: number): string {
  if (service.providerImage && !service.providerImage.endsWith(".pdf")) return service.providerImage
  if (Array.isArray(service.images) && service.images.length > 0) {
    const img = service.images.find((i: string) => i && !i.endsWith(".pdf"))
    if (img) return img
  }
  return DEFAULT_BEAUTY_PHOTOS[fallbackIndex % DEFAULT_BEAUTY_PHOTOS.length]
}

function formatPrice(price: any): string {
  const n = Number(price || 0)
  if (!n) return "Price varies"
  return `from ₦${n.toLocaleString()}`
}

// ─── Provider card ────────────────────────────────────────────────────────────

function ProviderCard({ service, fallbackIndex }: { service: any; fallbackIndex: number }) {
  const [liked, setLiked] = useState(false)
  const img = getProviderImage(service, fallbackIndex)
  const location = service.location || service.city || service.state || ""

  return (
    <Link href={buildPublicServicePath(service)} className="group block">
      <div className="relative rounded-3xl overflow-hidden aspect-[3/4] shadow-md hover:shadow-2xl hover:shadow-rose-200/50 transition-all duration-500 hover:-translate-y-1">
        {/* Background photo */}
        <img
          src={img}
          alt={service.providerName || service.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

        {/* Heart / wishlist */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setLiked(l => !l) }}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:bg-white/40 transition-all"
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-rose-400 text-rose-400" : "text-white"}`} />
        </button>

        {/* Specialty badge top-left */}
        {service.subcategory && (
          <div className="absolute top-3 left-3 z-10">
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-rose-500/80 backdrop-blur-sm text-white border border-white/20">
              {service.subcategory}
            </span>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5 z-10">
          <p className="text-white font-bold text-sm sm:text-base leading-tight line-clamp-1 drop-shadow">
            {service.providerName || "Beauty Artist"}
          </p>
          <p className="text-rose-200 text-xs line-clamp-1 mt-0.5 mb-2">
            {service.title || "Beauty Services"}
          </p>

          {location && (
            <div className="flex items-center gap-1 mb-2">
              <MapPin className="w-3 h-3 text-white/50 shrink-0" />
              <span className="text-white/60 text-[11px] line-clamp-1">{location}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="text-rose-300 font-semibold text-xs">
              {formatPrice(service.price)}
            </span>
            <span className="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30 hover:from-rose-400 hover:to-pink-400 transition-all">
              Book
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BeautyPage() {
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [specialty, setSpecialty] = useState("all")
  const pillsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/database/services?category=beauty&limit=60")
        const data = await res.json()
        if (data?.success && Array.isArray(data.data)) {
          setServices(data.data)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = services.filter((s) => {
    if (!matchesSpecialty(s, specialty)) return false
    if (search) {
      const q = search.toLowerCase()
      const hay = `${s.title || ""} ${s.providerName || ""} ${s.description || ""} ${s.location || ""}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  return (
    <>
      <Header />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden min-h-[300px] sm:min-h-[380px]">
        <img
          src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1400&h=600&fit=crop&auto=format"
          alt="Beauty & Glam"
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        {/* Dual-tone gradient: warm dark at bottom, hints of rose */}
        <div className="absolute inset-0 bg-gradient-to-br from-rose-950/80 via-black/55 to-pink-900/60" />

        {/* Decorative blurred circles */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-rose-400/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 container mx-auto px-4 py-10 sm:py-14 flex flex-col items-center text-center">
          {/* Tag */}
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-rose-200 mb-4 px-3 py-1 rounded-full border border-rose-300/30 bg-white/5 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5" /> Beauty & Glam
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-3 drop-shadow-lg">
            Find Your Perfect<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-300 to-pink-200">
              Beauty Artist
            </span>
          </h1>

          <p className="text-white/70 text-sm sm:text-base max-w-md mb-7">
            Nail techs, lash artists, hair braiders, makeup artists and more — all near you
          </p>

          {/* Search */}
          <div className="w-full max-w-lg relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300/70" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search nail tech, lash, makeup..."
              className="w-full h-12 pl-11 pr-4 rounded-full bg-white/10 backdrop-blur-md border border-white/25 text-white placeholder:text-white/40 text-sm outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-300/50 transition-all"
            />
          </div>

          {/* Stats */}
          {!loading && (
            <div className="flex items-center gap-4 mt-6 text-white/55 text-xs sm:text-sm">
              <span><b className="text-white">{services.length}</b> artists</span>
              <span className="text-white/20">•</span>
              <span><b className="text-white">{SPECIALTIES.length - 1}</b> specialties</span>
              <span className="text-white/20">•</span>
              <span><b className="text-white">{new Set(services.map(s => s.city || s.state || "").filter(Boolean)).size || "Multiple"}</b> cities</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Specialty filter bar ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-background/98 backdrop-blur-md border-b border-border/60">
        <div
          ref={pillsRef}
          className="container mx-auto px-4 flex gap-1 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {SPECIALTIES.map((sp) => (
            <button
              key={sp.key}
              type="button"
              onClick={() => setSpecialty(sp.key)}
              className={`shrink-0 relative px-4 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap ${
                specialty === sp.key
                  ? "text-rose-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {sp.label}
              {specialty === sp.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-rose-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="min-h-screen bg-gradient-to-b from-rose-50/40 to-background">
        <div className="container mx-auto px-4 py-8">

          {/* Result count */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                {specialty === "all" ? "All Beauty Artists" : SPECIALTIES.find(s => s.key === specialty)?.label}
              </h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                {loading ? "Loading…" : `${filtered.length} ${filtered.length === 1 ? "artist" : "artists"} available`}
              </p>
            </div>
            <Link
              href="/services?category=beauty"
              className="text-xs text-rose-500 font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-3xl bg-rose-100/60 animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-rose-300" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No artists found</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                {search ? `No results for "${search}"` : "No beauty artists in this specialty yet — check back soon!"}
              </p>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mt-4 px-5 py-2 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-colors"
                >
                  Clear search
                </button>
              )}
            </div>
          )}

          {/* Provider grid */}
          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filtered.map((service, i) => (
                <ProviderCard key={service.id || service._id || i} service={service} fallbackIndex={i} />
              ))}
            </div>
          )}

          {/* Bottom CTA */}
          {!loading && services.length > 0 && (
            <div className="mt-16 relative rounded-3xl overflow-hidden py-12 px-6 text-center">
              <img
                src="https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=1200&h=400&fit=crop&auto=format"
                alt="Beauty studio"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-rose-950/80 via-black/60 to-rose-900/70" />
              <div className="relative z-10">
                <p className="text-rose-200 text-xs font-semibold tracking-widest uppercase mb-3">For Artists</p>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
                  Are you a beauty professional?
                </h3>
                <p className="text-white/65 text-sm max-w-sm mx-auto mb-6">
                  List your services on MakeItSell and connect with thousands of clients in your area.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold text-sm shadow-xl shadow-rose-500/30 hover:from-rose-400 hover:to-pink-400 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  List Your Services
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
