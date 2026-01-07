"use client"

import React, { useState, useEffect } from "react"
import { Sparkles, TrendingUp, Heart, Eye, ShoppingBag, Star, ArrowRight, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"

interface Product {
  id: string
  name: string
  price: number
  originalPrice?: number
  image: string
  vendor: {
    id: string
    name: string
    verified: boolean
  }
  rating: {
    average: number
    count: number
  }
  category: string
  subcategory?: string
  tags: string[]
  views: number
  likes: number
  sales: number
  createdAt: Date
  isNew: boolean
  onSale: boolean
  discount?: number
}

interface UserBehavior {
  viewedProducts: string[]
  viewedCategories: Record<string, number>
  searchQueries: string[]
  likedProducts: string[]
  purchaseHistory: string[]
  timeSpentOnCategories: Record<string, number>
  priceRange: [number, number]
  preferredBrands: string[]
}

interface RecommendationEngine {
  type: "collaborative" | "content" | "hybrid" | "trending" | "personalized"
  weight: number
  description: string
}

interface RecommendationsProps {
  userId?: string
  className?: string
  maxItems?: number
  showTabs?: boolean
  engines?: RecommendationEngine["type"][]
}

// Mock data - replace with real API data and ML models
const mockProducts: Product[] = [
  {
    id: "1",
    name: "iPhone 15 Pro Max 256GB",
    price: 650000,
    originalPrice: 750000,
    image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400&h=400&fit=crop&crop=center",
    vendor: { id: "v1", name: "Apple Store Nigeria", verified: true },
    rating: { average: 4.8, count: 234 },
    category: "Electronics",
    subcategory: "Smartphones",
    tags: ["smartphone", "apple", "premium", "camera"],
    views: 5420,
    likes: 892,
    sales: 156,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    isNew: true,
    onSale: true,
    discount: 13
  },
  {
    id: "2",
    name: "MacBook Pro 14\" M3 Pro",
    price: 1200000,
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&fit=crop&crop=center",
    vendor: { id: "v1", name: "Apple Store Nigeria", verified: true },
    rating: { average: 4.7, count: 89 },
    category: "Electronics",
    subcategory: "Laptops",
    tags: ["laptop", "apple", "professional", "m3"],
    views: 2134,
    likes: 345,
    sales: 23,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    isNew: true,
    onSale: false
  },
  {
    id: "3",
    name: "Nike Air Jordan 1 Retro High",
    price: 85000,
    originalPrice: 120000,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop&crop=center",
    vendor: { id: "v3", name: "Nike Store", verified: true },
    rating: { average: 4.9, count: 456 },
    category: "Fashion",
    subcategory: "Sneakers",
    tags: ["sneakers", "nike", "basketball", "retro"],
    views: 8970,
    likes: 1234,
    sales: 298,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    isNew: true,
    onSale: true,
    discount: 29
  },
  {
    id: "4",
    name: "Sony WH-1000XM5 Headphones",
    price: 180000,
    originalPrice: 220000,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop&crop=center",
    vendor: { id: "v4", name: "Electronics Hub", verified: false },
    rating: { average: 4.5, count: 167 },
    category: "Electronics",
    subcategory: "Audio",
    tags: ["headphones", "sony", "noise-canceling", "wireless"],
    views: 1567,
    likes: 234,
    sales: 67,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    isNew: false,
    onSale: true,
    discount: 18
  }
]

// Mock user behavior - this would come from analytics/tracking
const mockUserBehavior: UserBehavior = {
  viewedProducts: ["1", "3", "5", "7"],
  viewedCategories: { "Electronics": 15, "Fashion": 8, "Home": 3 },
  searchQueries: ["iphone", "nike shoes", "laptop", "headphones"],
  likedProducts: ["1", "3"],
  purchaseHistory: ["2", "6"],
  timeSpentOnCategories: { "Electronics": 1200, "Fashion": 800 },
  priceRange: [50000, 800000],
  preferredBrands: ["apple", "nike", "sony"]
}

// Recommendations feature removed for project simplification
export default function RecommendationsEngine({
  userId,
  className,
  maxItems = 8,
  showTabs = true,
  engines = ["personalized", "collaborative", "trending"]
}: RecommendationsProps) {
  return null
}

  // Recommendation algorithms
  const recommendationAlgorithms = {
    // Personalized recommendations based on user behavior
    personalized: (products: Product[], behavior: UserBehavior): Product[] => {
      return products
        .filter(p => !behavior.viewedProducts.includes(p.id))
        .map(product => {
          let score = 0

          // Category preference
          const categoryWeight = behavior.viewedCategories[product.category] || 0
          score += categoryWeight * 0.3

          // Price range preference
          const inPriceRange = product.price >= behavior.priceRange[0] && product.price <= behavior.priceRange[1]
          score += inPriceRange ? 20 : -10

          // Brand preference
          const brandScore = behavior.preferredBrands.some(brand => 
            product.tags.some(tag => tag.toLowerCase().includes(brand.toLowerCase()))
          ) ? 15 : 0
          score += brandScore

          // Search query relevance
          const queryRelevance = behavior.searchQueries.some(query =>
            product.name.toLowerCase().includes(query.toLowerCase()) ||
            product.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
          ) ? 10 : 0
          score += queryRelevance

          // Quality indicators
          score += product.rating.average * 3
          score += product.vendor.verified ? 5 : 0
          score += product.onSale ? 5 : 0

          return { ...product, score }
        })
        .sort((a, b) => (b as any).score - (a as any).score)
        .slice(0, maxItems)
    },

    // Collaborative filtering (users who viewed similar items also viewed)
    collaborative: (products: Product[], behavior: UserBehavior): Product[] => {
      // Simulate collaborative filtering based on similar user patterns
      const viewedCategories = Object.keys(behavior.viewedCategories)
      
      return products
        .filter(p => !behavior.viewedProducts.includes(p.id))
        .filter(p => viewedCategories.includes(p.category))
        .map(product => {
          let score = 0

          // Similar users also liked
          score += product.likes * 0.1
          score += product.views * 0.05
          score += product.sales * 0.2

          // Category overlap
          const categoryBonus = behavior.viewedCategories[product.category] || 0
          score += categoryBonus * 0.5

          // Rating quality
          score += product.rating.average * product.rating.count * 0.01

          return { ...product, score }
        })
        .sort((a, b) => (b as any).score - (a as any).score)
        .slice(0, maxItems)
    },

    // Content-based filtering (similar products)
    content: (products: Product[], behavior: UserBehavior): Product[] => {
      const viewedProducts = products.filter(p => behavior.viewedProducts.includes(p.id))
      
      return products
        .filter(p => !behavior.viewedProducts.includes(p.id))
        .map(product => {
          let score = 0

          viewedProducts.forEach(viewedProduct => {
            // Same category
            if (viewedProduct.category === product.category) score += 10

            // Same subcategory
            if (viewedProduct.subcategory === product.subcategory) score += 15

            // Tag similarity
            const commonTags = product.tags.filter(tag => 
              viewedProduct.tags.includes(tag)
            ).length
            score += commonTags * 5

            // Similar price range
            const priceDiff = Math.abs(product.price - viewedProduct.price) / viewedProduct.price
            if (priceDiff < 0.3) score += 8

            // Same vendor
            if (product.vendor.id === viewedProduct.vendor.id) score += 5
          })

          return { ...product, score }
        })
        .sort((a, b) => (b as any).score - (a as any).score)
        .slice(0, maxItems)
    },

    // Trending products
    trending: (products: Product[]): Product[] => {
      const now = Date.now()
      const dayMs = 24 * 60 * 60 * 1000

      return products
        .map(product => {
          const daysOld = Math.max(1, (now - product.createdAt.getTime()) / dayMs)
          const trendingScore = (product.views + product.likes * 2 + product.sales * 5) / daysOld
          
          return { ...product, score: trendingScore }
        })
        .sort((a, b) => (b as any).score - (a as any).score)
        .slice(0, maxItems)
    },

    // Hybrid approach combining multiple signals
    hybrid: (products: Product[], behavior: UserBehavior): Product[] => {
      const personalizedResults = recommendationAlgorithms.personalized(products, behavior)
      const collaborativeResults = recommendationAlgorithms.collaborative(products, behavior)
      const contentResults = recommendationAlgorithms.content(products, behavior)
      const trendingResults = recommendationAlgorithms.trending(products)

      // Combine and weight results
      const combined = new Map<string, { product: Product; score: number }>()

      const addToMap = (results: Product[], weight: number) => {
        results.forEach((product, index) => {
          const existing = combined.get(product.id)
          const positionScore = (maxItems - index) / maxItems
          const newScore = positionScore * weight

          if (existing) {
            existing.score += newScore
          } else {
            combined.set(product.id, { product, score: newScore })
          }
        })
      }

      addToMap(personalizedResults, 0.4)  // 40% weight
      addToMap(collaborativeResults, 0.3)  // 30% weight
      addToMap(contentResults, 0.2)        // 20% weight
      addToMap(trendingResults, 0.1)       // 10% weight

      return Array.from(combined.values())
        .sort((a, b) => b.score - a.score)
        .map(item => item.product)
        .slice(0, maxItems)
    }
  }

  // Generate recommendations
  const generateRecommendations = async () => {
    setIsLoading(true)

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500))

      const results: Record<string, Product[]> = {}

      engines.forEach(engine => {
        if (engine === "trending") {
          results[engine] = recommendationAlgorithms[engine](mockProducts)
        } else {
          results[engine] = recommendationAlgorithms[engine](mockProducts, userBehavior)
        }
      })

      setRecommendations(results)
    } catch (error) {
      console.error("Error generating recommendations:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Update user behavior (this would be called from analytics)
  const updateUserBehavior = (updates: Partial<UserBehavior>) => {
    setUserBehavior(prev => ({ ...prev, ...updates }))
  }

  // Initialize recommendations
  useEffect(() => {
    generateRecommendations()
  }, [userBehavior])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Engine display names and descriptions
  const engineInfo = {
    personalized: {
      name: "For You",
      description: "Based on your browsing and purchase history",
      icon: <Sparkles className="h-4 w-4" />
    },
    collaborative: {
      name: "Others Also Viewed",
      description: "Products viewed by users with similar interests",
      icon: <Eye className="h-4 w-4" />
    },
    content: {
      name: "Similar Items",
      description: "Products similar to ones you've viewed",
      icon: <ShoppingBag className="h-4 w-4" />
    },
    trending: {
      name: "Trending",
      description: "Popular products right now",
      icon: <TrendingUp className="h-4 w-4" />
    },
    hybrid: {
      name: "Smart Picks",
      description: "AI-powered recommendations combining multiple signals",
      icon: <Sparkles className="h-4 w-4" />
    }
  }

  // Product Card Component
  const ProductCard = ({ product }: { product: Product }) => (
    <Link href={`/product/${product.id}`}>
      <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] w-48">
        <CardContent className="p-0">
          <div className="relative aspect-square overflow-hidden rounded-t-lg">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.currentTarget.src = "/images/placeholder-product.svg"
              }}
            />
            
            {/* Badges */}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {product.isNew && (
                <Badge className="bg-blue-500 hover:bg-blue-600 text-xs">NEW</Badge>
              )}
              {product.onSale && product.discount && (
                <Badge className="bg-red-500 hover:bg-red-600 text-xs">
                  -{product.discount}%
                </Badge>
              )}
            </div>

            {/* Vendor verification */}
            <div className="absolute top-2 right-2">
              {product.vendor.verified && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                  ✓
                </Badge>
              )}
            </div>
          </div>

          <div className="p-4 space-y-2">
            <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            
            <div className="flex items-center gap-1">
              <div className="flex">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-3 w-3",
                      i < Math.floor(product.rating.average)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                ({product.rating.count})
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{formatCurrency(product.price)}</span>
                {product.originalPrice && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatCurrency(product.originalPrice)}
                  </span>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground">
                by {product.vendor.name}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="w-48 h-64 bg-gray-200 rounded-lg shrink-0 animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  const activeRecommendations = recommendations[activeEngine] || []

  return (
    <div className={cn("space-y-6", className)}>
      {showTabs && engines.length > 1 ? (
        <Tabs value={activeEngine} onValueChange={setActiveEngine}>
          <div className="flex items-center justify-between">
            <TabsList className="grid w-fit grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {engines.slice(0, 4).map((engine) => (
                <TabsTrigger
                  key={engine}
                  value={engine}
                  className="flex items-center gap-2 text-xs"
                >
                  {engineInfo[engine].icon}
                  <span className="hidden sm:inline">{engineInfo[engine].name}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <Button variant="ghost" size="sm" onClick={generateRecommendations} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {engines.map((engine) => (
            <TabsContent key={engine} value={engine} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    {engineInfo[engine].icon}
                    {engineInfo[engine].name}
                  </h2>
                  <p className="text-muted-foreground text-sm">{engineInfo[engine].description}</p>
                </div>
                
                <Button variant="outline" asChild>
                  <Link href={`/recommendations?type=${engine}`}>
                    View All <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>

              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 pb-4">
                  {(recommendations[engine] || []).map((product) => (
                    <div key={product.id} className="shrink-0">
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        // Show primary engine without tabs
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                {engineInfo[activeEngine as keyof typeof engineInfo].icon}
                {engineInfo[activeEngine as keyof typeof engineInfo].name}
              </h2>
              <p className="text-muted-foreground text-sm">{engineInfo[activeEngine as keyof typeof engineInfo].description}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={generateRecommendations} disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                Refresh
              </Button>
              
              <Button variant="outline" asChild>
                <Link href={`/recommendations?type=${activeEngine}`}>
                  View All <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>

          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {activeRecommendations.map((product) => (
                <div key={product.id} className="shrink-0">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {activeRecommendations.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium text-lg mb-2">No Recommendations Available</h3>
          <p className="text-muted-foreground mb-4">
            Browse some products to get personalized recommendations
          </p>
          <Button asChild>
            <Link href="/stores">Browse Products</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

// Hook for tracking user behavior
export const useRecommendationTracking = () => {
  const trackView = (productId: string, category: string) => {
    // Track product view for recommendations
    const event = {
      type: 'product_view',
      productId,
      category,
      timestamp: new Date().toISOString()
    }
    
    // Send to analytics service
    console.log('Tracking view:', event)
  }

  const trackSearch = (query: string) => {
    const event = {
      type: 'search',
      query,
      timestamp: new Date().toISOString()
    }
    
    console.log('Tracking search:', event)
  }

  const trackPurchase = (productId: string, price: number) => {
    const event = {
      type: 'purchase',
      productId,
      price,
      timestamp: new Date().toISOString()
    }
    
    console.log('Tracking purchase:', event)
  }

  return {
    trackView,
    trackSearch,
    trackPurchase
  }
}