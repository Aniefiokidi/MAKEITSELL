"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ShoppingCart, Heart } from "lucide-react"
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

export default function CategoryPage() {
  const params = useParams()
  const categorySlug = params.slug as string
  const [products, setProducts] = useState<any[]>([])
  const [filteredProducts, setFilteredProducts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("featured")
  const { addToCart } = useCart()

  useEffect(() => {
    async function fetchProducts() {
      // TODO: Replace with API call to fetch products from MongoDB
      // Example stub:
      // const all = await fetch(`/api/products?category=${categorySlug}`).then(res => res.json())
      // Example mapping logic for MongoDB products:
      // setProducts(all.map((p: any) => ({
      //   name: p.title,
      //   image: Array.isArray(p.images) ? p.images[0] : p.image || "/placeholder.svg",
      //   vendor: p.vendorName || p.vendor || "Vendor",
      //   inStock: typeof p.stock === "number" ? p.stock > 0 : true,
      //   rating: p.rating || 5,
      //   reviews: p.reviews || 0,
      //   originalPrice: p.originalPrice || null,
      //   maxStock: p.stock || 99,
      //   vendorCategory: p.vendorCategory || p.category || ""
      // })));
    }
    fetchProducts();
  }, [categorySlug]);

  useEffect(() => {
    // More flexible category matching - check multiple possible category formats
    let filtered = products.filter((product) => {
      const productCategory = (product.vendorCategory || product.category || "").toLowerCase()
      const categoryDisplayName = categoryNames[categorySlug]?.toLowerCase()
      
      return productCategory === categorySlug ||
             productCategory === categoryDisplayName ||
             productCategory.includes(categorySlug) ||
             (categoryDisplayName && productCategory.includes(categoryDisplayName))
    })
    
    // If no products in this category, show fallback and suggestions
    if (filtered.length === 0) {
      setFilteredProducts([])
    } else {
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
    }
  }, [categorySlug, searchQuery, sortBy, products])

  const handleAddToCart = (product: any) => {
    addToCart({
      productId: product.id,
      title: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      vendorId: product.vendor || "", 
      vendorName: product.vendor,
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
          {/* Header */}
          <div className="mb-8">
            <nav className="text-sm text-muted-foreground mb-4">
              <Link href="/" className="hover:text-primary">
                Home
              </Link>
              <span className="mx-2">/</span>
              <Link href="/stores" className="hover:text-primary">
                Shop
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
              {products.map((product) => (
                <Card key={product.id} className="group hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
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
                      {product.category !== categorySlug && (
                        <Badge variant="outline" className="absolute bottom-2 right-2">
                          Suggested
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Link href={`/product/${product.id}`}>
                        <h3 className="font-semibold hover:text-primary cursor-pointer line-clamp-2">{product.name}</h3>
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
                            <span className="text-sm text-muted-foreground line-through">₦{product.originalPrice}</span>
                          )}
                        </div>
                        <Button size="sm" onClick={() => handleAddToCart(product)} disabled={!product.inStock}>
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="group hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
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
                    {product.category !== categorySlug && (
                      <Badge variant="outline" className="absolute bottom-2 right-2">
                        Suggested
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Link href={`/product/${product.id}`}>
                      <h3 className="font-semibold hover:text-primary cursor-pointer line-clamp-2">{product.name}</h3>
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
                          <span className="text-sm text-muted-foreground line-through">₦{product.originalPrice}</span>
                        )}
                      </div>
                      <Button size="sm" onClick={() => handleAddToCart(product)} disabled={!product.inStock}>
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Add
                      </Button>
                    </div>
                  </div>
                </CardContent>
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
