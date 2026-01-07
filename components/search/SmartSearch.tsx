"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Search, Clock, TrendingUp, X, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface SearchSuggestion {
  id: string
  text: string
  type: "product" | "brand" | "category" | "tag"
  category?: string
  icon?: React.ReactNode
}

interface RecentSearch {
  id: string
  query: string
  timestamp: Date
}

interface SmartSearchProps {
  onSearch?: (query: string, filters?: SearchFilters) => void
  placeholder?: string
  className?: string
}

interface SearchFilters {
  category?: string
  priceRange?: [number, number]
  brands?: string[]
  tags?: string[]
}

// Mock data - replace with real API calls
const mockSuggestions: SearchSuggestion[] = [
  { id: "1", text: "iPhone 15 Pro", type: "product", category: "Electronics" },
  { id: "2", text: "Samsung Galaxy", type: "product", category: "Electronics" },
  { id: "3", text: "Apple", type: "brand", icon: <TrendingUp className="h-4 w-4" /> },
  { id: "4", text: "Electronics", type: "category" },
  { id: "5", text: "Smartphones", type: "tag" },
  { id: "6", text: "Nike Air Max", type: "product", category: "Fashion" },
  { id: "7", text: "Nike", type: "brand", icon: <TrendingUp className="h-4 w-4" /> },
  { id: "8", text: "Fashion", type: "category" },
  { id: "9", text: "Sneakers", type: "tag" },
  { id: "10", text: "Wireless Headphones", type: "product", category: "Electronics" },
]

const trendingSearches = [
  "iPhone 15", "Samsung Galaxy S24", "MacBook Pro", "Nike Air Jordan",
  "Gaming Laptop", "Wireless Earbuds", "Smart Watch", "PS5 Games"
]

export default function SmartSearch({ onSearch, placeholder = "Search for products, brands, or categories...", className }: SmartSearchProps) {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("makeitsell-recent-searches")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setRecentSearches(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })))
      } catch (error) {
        console.error("Error loading recent searches:", error)
      }
    }
  }, [])

  // Save recent searches to localStorage
  const saveRecentSearch = useCallback((searchQuery: string) => {
    const newSearch: RecentSearch = {
      id: Date.now().toString(),
      query: searchQuery,
      timestamp: new Date()
    }

    const updated = [newSearch, ...recentSearches.filter(s => s.query !== searchQuery)].slice(0, 10)
    setRecentSearches(updated)
    localStorage.setItem("makeitsell-recent-searches", JSON.stringify(updated))
  }, [recentSearches])

  // Simulate API search with debouncing
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Filter mock suggestions based on query
    const filtered = mockSuggestions.filter(suggestion =>
      suggestion.text.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 8)
    
    setSuggestions(filtered)
    setIsLoading(false)
  }, [])

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query)
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [query, performSearch])

  // Handle search submission
  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim())
      onSearch?.(searchQuery.trim())
      setQuery(searchQuery)
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    const totalItems = suggestions.length + recentSearches.length + trendingSearches.length
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % totalItems)
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems)
        break
      case "Enter":
        e.preventDefault()
        if (selectedIndex >= 0) {
          const allItems = [
            ...suggestions.map(s => s.text),
            ...recentSearches.map(r => r.query),
            ...trendingSearches
          ]
          handleSearch(allItems[selectedIndex])
        } else {
          handleSearch(query)
        }
        break
      case "Escape":
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem("makeitsell-recent-searches")
  }

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={searchRef} className={cn("relative w-full max-w-2xl", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-10 h-12 text-base"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 h-6 w-6 p-0 -translate-y-1/2"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search Dropdown */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-2 max-h-96 overflow-y-auto shadow-lg">
          <div className="p-4 space-y-4">
            
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            )}

            {/* Search Suggestions */}
            {suggestions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Suggestions</h4>
                <div className="space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSearch(suggestion.text)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-accent transition-colors",
                        selectedIndex === index && "bg-accent"
                      )}
                    >
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{suggestion.text}</span>
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.type}
                      </Badge>
                      {suggestion.category && (
                        <span className="text-xs text-muted-foreground">
                          in {suggestion.category}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Searches */}
            {recentSearches.length > 0 && query.length === 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Recent Searches</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearRecentSearches}
                    className="text-xs h-6 px-2"
                  >
                    Clear
                  </Button>
                </div>
                <div className="space-y-1">
                  {recentSearches.slice(0, 5).map((recent, index) => (
                    <button
                      key={recent.id}
                      onClick={() => handleSearch(recent.query)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-accent transition-colors",
                        selectedIndex === suggestions.length + index && "bg-accent"
                      )}
                    >
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{recent.query}</span>
                      <span className="text-xs text-muted-foreground">
                        {recent.timestamp.toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Searches */}
            {query.length === 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Trending Now
                </h4>
                <div className="flex flex-wrap gap-2">
                  {trendingSearches.map((trend, index) => (
                    <button
                      key={trend}
                      onClick={() => handleSearch(trend)}
                      className={cn(
                        "px-3 py-1 text-sm rounded-full border hover:bg-accent transition-colors",
                        selectedIndex === suggestions.length + recentSearches.length + index && "bg-accent"
                      )}
                    >
                      {trend}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {query.length >= 2 && suggestions.length === 0 && !isLoading && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  No suggestions found for "{query}"
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSearch(query)}
                  className="mt-2"
                >
                  Search anyway
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}