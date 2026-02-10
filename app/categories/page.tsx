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
  Car
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
  }
]

export default function CategoriesPage() {
  const [categoryImages, setCategoryImages] = useState<{ [key: string]: string }>({})
  const [categoryCounts, setCategoryCounts] = useState<{ [key: string]: number }>({})

  useEffect(() => {
    // Fetch top selling products and counts for each category
    const fetchCategoryData = async () => {
      const imageMap: { [key: string]: string } = {}
      const countMap: { [key: string]: number } = {}
      
      for (const category of categories) {
        try {
          // Get products count for this category
          const countResponse = await fetch(`/api/database/products?category=${category.slug}&count=true`)
          const countResult = await countResponse.json()
          
          if (countResult.success) {
            countMap[category.slug] = countResult.data?.length || countResult.count || 0
          }
          
          // Get top selling product image
          const response = await fetch(`/api/database/products?category=${category.slug}&limit=1&sortBy=popular`)
          const result = await response.json()
          
          if (result.success && result.data && result.data.length > 0) {
            const topProduct = result.data[0]
            const productImage = Array.isArray(topProduct.images) ? topProduct.images[0] : topProduct.image
            if (productImage && productImage !== "/placeholder.svg") {
              imageMap[category.slug] = productImage
            }
          }
        } catch (error) {
          console.error(`Error fetching data for ${category.slug}:`, error)
        }
      }
      
      setCategoryImages(imageMap)
      setCategoryCounts(countMap)
    }

    fetchCategoryData()
  }, [])

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
          {/* Header in Glass Bubble */}
          <div className="mb-8 p-6 md:p-8 bg-gradient-to-br from-accent/5 via-accent/15 to-accent/50 backdrop-blur-2xl rounded-3xl border border-accent/30 shadow-2xl shadow-accent/20 hover:shadow-3xl hover:shadow-accent/30 transition-all duration-500">
            <div className="animate-fade-in">
              <nav className="text-xs sm:text-sm text-accent dark:text-white mb-2 sm:mb-4">
                <Link href="/" className="hover:text-primary">
                  Home
                </Link>
                <span className="mx-2">/</span>
                <span>Categories</span>
              </nav>
              <h1 className="text-xl sm:text-3xl font-bold mb-2 sm:mb-4 text-accent dark:text-white" style={{ 
                fontFamily: '"Bebas Neue", "Impact", sans-serif',
                textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' 
              }}>SHOP BY CATEGORY</h1>
              <p className="text-accent dark:text-white text-xs sm:text-base">
                Discover thousands of products across our diverse categories
              </p>
            </div>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {categories.map((category, index) => {
              const IconComponent = category.icon
              const categoryImage = categoryImages[category.slug]
              
              return (
                <Link key={category.slug} href={`/category/${category.slug}`}>
                  <Card className={`h-full hover:shadow-2xl hover:shadow-accent/40 transition-all duration-300 group overflow-hidden border-none rounded-2xl sm:rounded-3xl relative ${category.slug === 'electronics' ? '' : 'hover:scale-[1.01]'}`} style={{ animationDelay: `${index * 0.05}s` }}>
                    {/* Full Background with Product Image or Gradient */}
                    <div className="aspect-[9/16] relative overflow-hidden rounded-2xl sm:rounded-3xl">
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
                          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent via-40% to-black/80" />
                        </>
                      ) : (
                        <>
                          {/* Gradient Background for categories without products */}
                          <div className={`flex items-center justify-center h-full ${category.color} bg-gradient-to-br from-current via-current to-black/20`}>
                            {/* Background pattern overlay */}
                            <div className="absolute inset-0 opacity-10">
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:20px_20px]"></div>
                            </div>
                          </div>
                          {/* Lighter overlay for gradient backgrounds */}
                          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent via-50% to-black/60" />
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
                          className="inline-flex w-full text-[10px] sm:text-xs md:text-sm font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 shadow cursor-pointer hover:opacity-90 transition min-h-[20px] sm:min-h-[24px] items-center justify-center text-center leading-tight bg-accent text-white"
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
                            {categoryCounts[category.slug] ? `${categoryCounts[category.slug]} items` : 'No items yet'}
                          </Badge>
                          
                          <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/70 flex items-center justify-center shadow hover:scale-110 active:scale-95 hover:bg-white transition-all duration-200 cursor-pointer group/arrow">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent group-hover/arrow:translate-x-0.5 transition-transform">
                              <path d="M5 12h14"/>
                              <path d="m12 5 7 7-7 7"/>
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
              {categories.slice(0, 4).map((category, index) => (
                <Link 
                  key={`popular-${category.slug}`} 
                  href={`/category/${category.slug}`}
                  className="group animate-scale-in hover-lift"
                  style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                >
                  <div className="bg-muted/50 rounded-lg p-2 sm:p-4 text-center hover:bg-muted transition-colors">
                    <div className={`${category.color} w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3 text-white`}>
                      <category.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="font-medium text-xs sm:text-base group-hover:text-primary transition-colors truncate">
                      {category.name}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}