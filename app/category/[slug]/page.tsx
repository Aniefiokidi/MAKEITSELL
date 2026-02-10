"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ShoppingCart, Heart, ArrowLeft } from "lucide-react"
import { useCart } from "@/contexts/CartContext"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
// import { getProducts } from "@/lib/firestore"

// Use real products from Firestore

const categoryNames: { [key: string]: string } = {
  electronics: "Electronics",
  fashion: "Fashion",
  home: "Home & Garden",
  accessories: "Accessories",
  sports: "Sports & Fitness",
}

const fashionSubcategories = [
  "All Fashion",
  "Shoes",
  "Jewelry",
  "Shirts",
  "Sweaters",
  "Swimwear",
  "Pants & Jeans",
  "Dresses",
  "Jackets & Coats",
  "Accessories",
  "Bags",
  "Hats & Caps",
  "Socks & Underwear",
]

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const categorySlug = params.slug as string
  const [products, setProducts] = useState<any[]>([])
  const [filteredProducts, setFilteredProducts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("featured")
  const [fashionSubcategory, setFashionSubcategory] = useState("All Fashion")
  const { addToCart } = useCart()

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch(`/api/database/products?category=${categorySlug}`)
        const result = await response.json()
        
        if (result.success && result.data) {
          // Get unique vendor IDs
          const vendorIds = [...new Set(result.data.map((p: any) => p.vendorId))]
          
          // Fetch store names for all vendors
          const storeNamesMap: { [key: string]: string } = {}
          for (const vendorId of vendorIds) {
            try {
              const storeRes = await fetch(`/api/database/stores?vendorId=${vendorId}`)
              const storeData = await storeRes.json()
              if (storeData.success && storeData.data && storeData.data.length > 0) {
                storeNamesMap[vendorId as string] = storeData.data[0].storeName || "Store"
              }
            } catch (err) {
              console.error('Error fetching store:', err)
            }
          }
          
          const mappedProducts = result.data.map((p: any) => {
            const storeName = storeNamesMap[p.vendorId] || "Store"
            return {
              id: p.id || p._id,
              name: p.name || p.title,
              price: p.price,
              image: Array.isArray(p.images) ? p.images[0] : p.image || "/placeholder.svg",
              storeName: storeName,
              inStock: typeof p.stock === "number" ? p.stock > 0 : true,
              rating: p.rating || 5,
              reviews: p.reviews || 0,
              originalPrice: p.originalPrice || null,
              maxStock: p.stock || 99,
              vendorCategory: p.category || "",
              category: p.category || "",
              description: p.description || "",
              subcategory: p.subcategory || ""
            }
          })
          setProducts(mappedProducts)
        } else {
          console.log('No products found or API error')
        }
      } catch (error) {
        console.error('Error fetching products:', error)
      }
    }
    fetchProducts()
  }, [categorySlug])

  useEffect(() => {
    // Products are already filtered by category from the API, just apply search and sort
    let filtered = [...products]
    
    // Apply fashion subcategory filter
    if (categorySlug === "fashion" && fashionSubcategory !== "All Fashion") {
      filtered = filtered.filter(
        (product) => product.subcategory?.toLowerCase() === fashionSubcategory.toLowerCase()
      )
    }
    
    if (searchQuery) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (product.description?.toLowerCase() || "").includes(searchQuery.toLowerCase()),
      )
    }
    
    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => a.price - b.price)
        break
      case "price-high":
        filtered.sort((a, b) => b.price - a.price)
        break
      case "rating":
        filtered.sort((a, b) => b.rating - a.rating)
        break
      case "newest":
        filtered.reverse()
        break
      default:
        break
    }
    
    setFilteredProducts(filtered)
  }, [searchQuery, sortBy, products, fashionSubcategory, categorySlug])

  const handleAddToCart = (product: any) => {
    addToCart({
      productId: product.id,
      title: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      vendorId: product.storeName || "", 
      vendorName: product.storeName,
      maxStock: product.inStock ? 999 : 0,
      id: product
    })
  }

  const categoryProducts = products.filter((p) => p.category === categorySlug)
  const categoryName = categoryNames[categorySlug] || "Category"

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header with Back Button */}
          <div className="mb-8">
            {/* Back Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="mb-4 hover:bg-accent hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <nav className="text-sm text-muted-foreground mb-4">
              <Link href="/" className="hover:text-primary">
                Home
              </Link>
              <span className="mx-2">/</span>
              <Link href="/categories" className="hover:text-primary">
                Categories
              </Link>
              <span className="mx-2">/</span>
              <span>{categoryName}</span>
            </nav>
            <h1 className="text-3xl font-bold mb-4">{categoryName}</h1>
            {filteredProducts.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800">
                  Sorry, we do not have products in "{categoryName}" yet.<br />
                  Here are some other products you might like:
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Discover amazing {categoryName.toLowerCase()} products from our trusted sellers
              </p>
            )}
          </div>

        {/* Search and Sort */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={`Search in ${categoryName}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {categorySlug === "fashion" && (
            <Select value={fashionSubcategory} onValueChange={setFashionSubcategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Subcategory" />
              </SelectTrigger>
              <SelectContent>
                {fashionSubcategories.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    {sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Products Grid */}
        <div className="mb-6">
          <p className="text-muted-foreground">
            Showing {filteredProducts.length} products
            {categoryProducts.length === 0 && ` (showing all products as suggestions)`}
          </p>
        </div>

        {filteredProducts.length === 0 ? (
          <>
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">No products found in this category.</p>
              <Button onClick={() => setSearchQuery("")}>Clear Search</Button>
            </div>
            {/* Show all products as suggestions */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 mt-8">
              {products.map((product) => (
                <Card key={product.id} className={`border-0 shadow-md overflow-hidden relative h-[350px] sm:h-[450px] hover:shadow-xl transition-all duration-500 ${categorySlug === 'electronics' ? 'hover:-translate-y-1' : 'hover:-translate-y-2'} rounded-3xl`}>
                  {/* Image Container with Group Hover */}
                  <div className="group absolute inset-0 overflow-hidden">
                    {/* Full Card Image Background */}
                    <img
                      src={product.image || "/placeholder.svg"}
                      alt={product.name}
                      className={`absolute inset-0 w-full h-full ${categorySlug === 'electronics' ? 'object-contain bg-white' : 'object-cover'} group-hover:scale-110 transition-transform duration-500`}
                    />
                    
                    {/* Product Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                      {!product.inStock && (
                        <Badge variant="secondary" className="bg-gray-600">
                          Out of Stock
                        </Badge>
                      )}
                      {product.category !== categorySlug && (
                        <Badge className="bg-blue-500 text-white font-semibold">
                          Suggested
                        </Badge>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white/90 backdrop-blur-sm hover:bg-white hover:scale-110 transition-all"
                      >
                        <Heart className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Frosted Glass Bubble Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 backdrop-blur-xl bg-white/20 dark:bg-black/20 border-t border-white/30 rounded-t-3xl z-30 space-y-1.5">
                    <Link href={`/product/${product.id}`}>
                      <h3 className="font-semibold text-xs sm:text-sm line-clamp-1 text-white drop-shadow-lg cursor-pointer hover:text-blue-200 transition-colors">
                        {product.name}
                      </h3>
                    </Link>
                    
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white text-[11px] sm:text-xs font-medium px-2 py-1 bg-accent/80 backdrop-blur-sm rounded-full border border-white/50">
                        {product.storeName}
                      </span>
                      
                      <div className="font-bold text-sm text-white drop-shadow-lg">
                        ₦{product.price}
                      </div>
                    </div>
                    
                    <Button 
                      size="sm"
                      onClick={() => handleAddToCart(product)}
                      disabled={!product.inStock}
                      className="w-full h-7 text-xs bg-white/90 hover:bg-white text-black backdrop-blur-sm hover:scale-105 transition-all hover:shadow-lg flex items-center justify-center gap-0"
                    >
                      <img src="/images/logo3.png" alt="Add" className="w-8 h-8 -mt-2" />
                      <span className="leading-none text-accent">Add</span>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className={`border-0 shadow-md overflow-hidden relative h-[350px] sm:h-[450px] hover:shadow-xl transition-all duration-500 ${categorySlug === 'electronics' ? 'hover:-translate-y-1' : 'hover:-translate-y-2'} rounded-3xl`}>
                {/* Image Container with Group Hover */}
                <div className="group absolute inset-0 overflow-hidden">
                  {/* Full Card Image Background */}
                  <img
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    className={`absolute inset-0 w-full h-full ${categorySlug === 'electronics' ? 'object-contain bg-white' : 'object-cover'} ${categorySlug === 'electronics' ? 'group-hover:scale-105' : 'group-hover:scale-110'} transition-transform duration-500`}
                  />
                  
                  {/* Product Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                    {!product.inStock && (
                      <Badge variant="secondary" className="bg-gray-600">
                        Out of Stock
                      </Badge>
                    )}
                    {product.category !== categorySlug && (
                      <Badge className="bg-blue-500 text-white font-semibold">
                        Suggested
                      </Badge>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white/90 backdrop-blur-sm hover:bg-white hover:scale-110 transition-all"
                    >
                      <Heart className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Frosted Glass Bubble Content */}
                <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 backdrop-blur-xl bg-white/20 dark:bg-black/20 border-t border-white/30 rounded-t-3xl z-30 space-y-1.5">
                  <Link href={`/product/${product.id}`}>
                    <h3 className="font-semibold text-xs sm:text-sm line-clamp-1 text-white drop-shadow-lg cursor-pointer hover:text-blue-200 transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white text-[11px] sm:text-xs font-medium px-2 py-1 bg-accent/80 backdrop-blur-sm rounded-full border border-white/50">
                      {product.storeName}
                    </span>
                    
                    <div className="font-bold text-sm text-white drop-shadow-lg">
                      ₦{product.price}
                    </div>
                  </div>
                  
                  <Button 
                    size="sm"
                    onClick={() => handleAddToCart(product)}
                    disabled={!product.inStock}
                    className="w-full h-7 text-xs bg-white/90 hover:bg-white text-black backdrop-blur-sm hover:scale-105 transition-all hover:shadow-lg flex items-center justify-center gap-0"
                  >
                    <img src="/images/logo3.png" alt="Add" className="w-8 h-8 -mt-2" />
                    <span className="leading-none text-accent">Add</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      </div>
      <Footer />
    </>
  )
}
