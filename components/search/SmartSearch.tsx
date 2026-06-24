"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Search, Clock, TrendingUp, X, Loader2, Package } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface Suggestion {
  id: string
  text: string
  category?: string | null
  price?: number | null
  image?: string | null
}

interface SmartSearchProps {
  onSearch?: (query: string) => void
  placeholder?: string
  className?: string
}

const CATEGORIES = [
  "Electronics", "Fashion", "Beauty", "Food & Beverages",
  "Home & Garden", "Sports", "Books", "Services",
]

const TRENDING = [
  "Phones", "Sneakers", "Hair products", "Laptops", "Bags", "Perfume", "Watches", "Shoes",
]

const RECENT_KEY = "mis:recent-searches"

export default function SmartSearch({ onSearch, placeholder = "Search products...", className }: SmartSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_KEY)
      if (saved) setRecentSearches(JSON.parse(saved))
    } catch {}
  }, [])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([])
      setSuggestedCategories([])
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}&limit=6`)
      if (!res.ok) throw new Error("fetch failed")
      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setSuggestedCategories(data.categories || [])
    } catch {
      setSuggestions([])
      setSuggestedCategories([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(query), 200)
    return () => clearTimeout(t)
  }, [query, fetchSuggestions])

  const commitSearch = (q: string, category?: string | null) => {
    const term = q.trim()
    if (!term) return
    const updated = [term, ...recentSearches.filter((r) => r !== term)].slice(0, 8)
    setRecentSearches(updated)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)) } catch {}
    setIsOpen(false)
    setQuery(term)
    onSearch?.(term)
    const params = new URLSearchParams({ query: term })
    const cat = category ?? activeCategory
    if (cat) params.set("category", cat)
    router.push(`/search?${params.toString()}`)
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const showDropdown = isOpen
  const hasQuery = query.length >= 2
  const hasResults = suggestions.length > 0

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          autoComplete="off"
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitSearch(query) }
            if (e.key === "Escape") { setIsOpen(false); inputRef.current?.blur() }
          }}
          className="w-full rounded-full border border-gray-200 bg-white pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setSuggestions([]); setSuggestedCategories([]); inputRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 z-9999 mt-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          {/* Category filter pills */}
          <div className="flex gap-1.5 overflow-x-auto px-3 pt-2.5 pb-1" style={{ scrollbarWidth: "none" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  activeCategory === cat
                    ? "border-accent bg-accent text-white"
                    : "border-gray-200 bg-white text-gray-500 hover:border-accent/40 hover:text-accent"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* Loading */}
            {isLoading && (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            )}

            {/* Live results */}
            {!isLoading && hasQuery && (
              <>
                {/* Category quick-filters from API */}
                {suggestedCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-gray-50">
                    {suggestedCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => commitSearch(query, cat)}
                        className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {hasResults ? (
                  <div className="py-1">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => commitSearch(s.text)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50"
                      >
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                          {s.image ? (
                            <img src={s.image} alt={s.text} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-4 w-4 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">{s.text}</p>
                          {s.category && <p className="text-xs text-gray-400">{s.category}</p>}
                        </div>
                        {s.price != null && s.price > 0 && (
                          <p className="shrink-0 text-xs font-semibold text-accent">
                            ₦{Number(s.price).toLocaleString("en-NG")}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3">
                    <p className="text-sm text-gray-400">No results for &ldquo;{query}&rdquo;</p>
                    <button onClick={() => commitSearch(query)} className="mt-1 text-sm text-accent hover:underline">
                      Search anyway →
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Recent searches */}
            {!hasQuery && recentSearches.length > 0 && (
              <div className="py-1">
                <div className="flex items-center justify-between px-4 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Recent</span>
                  <button
                    onClick={() => {
                      setRecentSearches([])
                      try { localStorage.removeItem(RECENT_KEY) } catch {}
                    }}
                    className="text-[11px] text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                </div>
                {recentSearches.slice(0, 5).map((r) => (
                  <button
                    key={r}
                    onClick={() => commitSearch(r)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-gray-50"
                  >
                    <Clock className="h-4 w-4 shrink-0 text-gray-300" />
                    <span className="text-sm text-gray-700">{r}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Trending */}
            {!hasQuery && (
              <div className="border-t border-gray-50 px-4 py-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-accent" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Trending</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TRENDING.map((t) => (
                    <button
                      key={t}
                      onClick={() => commitSearch(t)}
                      className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 transition-colors hover:bg-accent/10 hover:text-accent"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
