"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Filter, Grid, List, Heart, ShoppingCart } from "lucide-react"
import { useCart } from "@/contexts/CartContext"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { getProducts } from "@/lib/firestore"
import { Skeleton } from "@/components/ui/skeleton"

const categories = [
  { id: "all", name: "All Categories" },
  { id: "electronics", name: "Electronics" },
  { id: "fashion", name: "Fashion" },
  { id: "home", name: "Home & Garden" },
  { id: "accessories", name: "Accessories" },
  { id: "sports", name: "Sports & Fitness" },
]

export default function ShopPage() {
  const [loading, setLoading] = useState(true)
  // Fetch products from Firestore on mount
  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      const firestoreProducts = await getProducts();
      // Map Firestore fields to expected frontend fields
      const mapped = (firestoreProducts || []).map((p: any) => ({
        ...p,
        name: p.title,
        image: Array.isArray(p.images) ? p.images[0] : p.image || "/placeholder.svg",
        vendor: p.vendorName || p.vendor || "Vendor",
        inStock: typeof p.stock === "number" ? p.stock > 0 : true,
        rating: p.rating || 5,
        reviews: p.reviews || 0,
        originalPrice: p.originalPrice || null,
        maxStock: p.stock || 99,
      }));
      setProducts(mapped);
      setLoading(false)
    }
    fetchProducts();
  }, []);
  const [products, setProducts] = useState<any[]>([])
  const [filteredProducts, setFilteredProducts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [sortBy, setSortBy] = useState("featured")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 })
  const [showFilters, setShowFilters] = useState(false)
  const [inStockOnly, setInStockOnly] = useState(false)
  const { addToCart } = useCart()

  useEffect(() => {
    let filtered = products

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (product) =>
          (product.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
          (product.description?.toLowerCase() || "").includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category (case-insensitive, flexible)
    if (selectedCategory !== "all") {
      filtered = filtered.filter((product) =>
        (product.category || "").toLowerCase().replace(/\s|&/g, "") === selectedCategory.replace(/\s|&/g, "")
      )
    }

    // Filter by stock
    if (inStockOnly) {
      filtered = filtered.filter((product) => product.inStock)
    }

    // Filter by price range
    filtered = filtered.filter((product) => product.price >= priceRange.min && product.price <= priceRange.max)

    // Sort products
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
        // For demo, we'll just reverse the array
        filtered.reverse()
        break
      default:
        // Featured - keep original order
        break
    }

    setFilteredProducts(filtered)
  }, [searchQuery, selectedCategory, sortBy, priceRange, inStockOnly, products])

  const handleAddToCart = (product: any) => {
    addToCart({
      id: product.id,
      productId: product.id,
      title: product.name,
      vendorId: product.vendorId,
      vendorName: product.vendor,
      price: product.price,
      image: product.image,
      quantity: 1,
      maxStock: product.maxStock,
    })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header/>
      <div className="container mx-auto px-4 py-8 flex-1">
     
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Shop All Products</h1>
          <p className="text-muted-foreground">Discover amazing products from our trusted sellers</p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full lg:w-48">
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
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="lg:hidden">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Mobile Filters */}
          {showFilters && (
            <Card className="lg:hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="inStock"
                    checked={inStockOnly}
                    onCheckedChange={(checked) => setInStockOnly(checked === true)}
                  />
                  <label htmlFor="inStock" className="text-sm">
                    In stock only
                  </label>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex gap-8">
          {/* Desktop Filters Sidebar */}
          <div className="hidden lg:block w-64 space-y-6">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4">Filters</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="inStockDesktop"
                      checked={inStockOnly}
                      onCheckedChange={(checked) => setInStockOnly(checked === true)}
                    />
                    <label htmlFor="inStockDesktop" className="text-sm">
                      In stock only
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Products Grid */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <p className="text-muted-foreground">
                Showing {filteredProducts.length} of {products.length} products
              </p>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="w-full h-48 mb-4" />
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-1/3" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground mb-4">No products found matching your criteria.</p>
                <Button
                  onClick={() => {
                    setSearchQuery("")
                    setSelectedCategory("all")
                    setInStockOnly(false)
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div
                className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}
              >
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="group hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      {viewMode === "grid" ? (
                        <div>
                          <div className="relative mb-4">
                            <Link href={`/product/${product.id}`}>
                              <img
                                src={product.image || "/placeholder.svg"}
                                alt={product.name}
                                className="w-full h-48 object-cover rounded-lg cursor-pointer"
                              />
                            </Link>
                            <Button
                              size="sm"
                              variant="outline"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-transparent"
                            >
                              <Heart className="w-4 h-4" />
                            </Button>
                            {!product.inStock && (
                              <Badge variant="secondary" className="absolute bottom-2 left-2">
                                Out of Stock
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Link href={`/product/${product.id}`}>
                              <h3 className="font-semibold hover:text-primary cursor-pointer">{product.name}</h3>
                            </Link>
                            <p className="text-sm text-muted-foreground">by {product.vendor}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center">
                                {[...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className={`w-4 h-4 ${
                                      i < Math.floor(product.rating) ? "text-yellow-400 fill-current" : "text-gray-300"
                                    }`}
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                              <span className="text-sm text-muted-foreground">({product.reviews})</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold">₦{product.price}</span>
                                {product.originalPrice && (
                                  <span className="text-sm text-muted-foreground line-through">
                                    ₦{product.originalPrice}
                                  </span>
                                )}
                              </div>
                              <Button size="sm" onClick={() => handleAddToCart(product)} disabled={!product.inStock}>
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Add to Cart
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-4">
                          <Link href={`/product/${product.id}`}>
                            <img
                              src={product.image || "/placeholder.svg"}
                              alt={product.name}
                              className="w-24 h-24 object-cover rounded-lg cursor-pointer"
                              loading="lazy"
                            />
                          </Link>
                          <div className="flex-1 space-y-2">
                            <Link href={`/product/${product.id}`}>
                              <h3 className="font-semibold hover:text-primary cursor-pointer">{product.name}</h3>
                            </Link>
                            <p className="text-sm text-muted-foreground">by {product.vendor}</p>
                            <p className="text-sm text-muted-foreground">{product.description}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold">₦{product.price}</span>
                                {product.originalPrice && (
                                  <span className="text-sm text-muted-foreground line-through">
                                    ₦{product.originalPrice}
                                  </span>
                                )}
                              </div>
                              <Button size="sm" onClick={() => handleAddToCart(product)} disabled={!product.inStock}>
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Add to Cart
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
