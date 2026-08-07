"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShoppingCart, Heart } from "lucide-react"
import { useCart } from "@/contexts/CartContext"
import Header from "@/components/Header"
import { optimizedImageUrl } from "@/lib/cloudinary-url"
// All product fetching must be done via API route only. Do not import getProducts or any database logic directly in client components.

export default function DealsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [filteredProducts, setFilteredProducts] = useState<any[]>([])
  const [sortBy, setSortBy] = useState("featured")
  const cartContext = useCart();
  const addToCart = cartContext?.addToCart;

  // Format currency with commas
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-NG')
  }

  useEffect(() => {
    async function fetchProducts() {
      const json = await fetch("/api/database/products?limit=24")
        .then(res => res.json())
        .catch(() => ({ data: [] }));
      const list = Array.isArray(json?.data) ? json.data : [];
      const mapped = list.map((p: any) => ({
        ...p,
        name: p.name || p.title,
        image: Array.isArray(p.images) ? p.images[0] : p.image || "/placeholder.svg",
        vendor: p.vendorName || p.vendor || "Vendor",
        inStock: typeof p.stock === "number" ? p.stock > 0 : true,
      }));

      setProducts(mapped);
    }
    fetchProducts();
  }, []);

  useEffect(() => {
    let sorted = [...products];

    switch (sortBy) {
      case "price-low":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "featured":
      default:
        break;
    }

    setFilteredProducts(sorted);
  }, [sortBy, products]);

  const handleAddToCart = (product: any) => {
    if (!addToCart) return;
    addToCart({
      productId: product.id,
      id: product.id,
      title: product.name || product.title,
      price: product.price,
      image: product.image || '',
      vendorId: product.vendorId || '',
      vendorName: product.vendor || 'Unknown Vendor',
      maxStock: product.inStock ? 999 : 0
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8 animate-fade-in">
            <nav className="text-sm text-muted-foreground mb-4">
              <Link href="/" className="hover:text-primary">Home</Link>
              <span className="mx-2">/</span>
              <span>Featured Products</span>
            </nav>
            <div className="flex flex-col md:flex-row md:items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>Featured Products</h1>
                <p className="text-muted-foreground">
                  A selection of products from across our vendors.
                </p>
              </div>
              <div className="mt-4 md:mt-0">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <Card key={product.id} className="group hover:shadow-lg transition-shadow relative overflow-hidden animate-scale-in hover-lift" style={{ animationDelay: `${index * 0.05}s` }}>
                <CardContent className="p-4">
                  <div className="relative mb-4 overflow-hidden rounded-lg">
                    <Link href={`/products/${product.id}`}>
                      <img
                        src={optimizedImageUrl(product.image, { width: 400 }) || "/placeholder.svg"}
                        alt={product.name}
                        className="w-full h-48 object-cover rounded-lg cursor-pointer group-hover:scale-110 transition-transform duration-300"
                      />
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-card"
                    >
                      <Heart className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Link href={`/products/${product.id}`}>
                      <h3 className="font-semibold hover:text-accent cursor-pointer line-clamp-2">
                        {product.name}
                      </h3>
                    </Link>
                    <p className="text-sm text-muted-foreground">by {product.vendor}</p>

                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">₦{formatCurrency(product.price)}</span>
                    </div>

                    <Button
                      className="w-full bg-accent text-accent-foreground font-bold rounded-lg py-2 hover:bg-accent/90 hover:scale-105 transition-all duration-200 shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => handleAddToCart(product)}
                      disabled={!product.inStock}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Add to Cart
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">No products available at the moment.</p>
              <p className="text-muted-foreground">Check back soon!</p>
            </div>
          )}
      </main>
    </div>
  )
}
