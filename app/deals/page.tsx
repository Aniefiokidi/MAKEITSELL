"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, ShoppingCart, Heart, Zap } from "lucide-react"
import { useCart } from "@/contexts/CartContext"
import Header from "@/components/Header"
// All product fetching must be done via API route only. Do not import getProducts or any database logic directly in client components.

export default function DealsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [filteredProducts, setFilteredProducts] = useState<any[]>([])
  const [sortBy, setSortBy] = useState("discount")
  const cartContext = useCart();
  const addToCart = cartContext?.addToCart;

  // Format currency with commas
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-NG')
  }

  useEffect(() => {
    async function fetchProducts() {
      // TODO: Replace this mock fetch with your real API call or import getProducts when available
      const all = await fetch("/api/products")
        .then(res => res.json())
        .catch(() => []);
      const dealsProducts = all.map((p: any) => ({
        ...p,
        name: p.title,
        image: Array.isArray(p.images) ? p.images[0] : p.image || "/placeholder.svg",
        vendor: p.vendorName || p.vendor || "Vendor",
        inStock: typeof p.stock === "number" ? p.stock > 0 : true,
        rating: p.rating || 5,
        reviews: p.reviews || Math.floor(Math.random() * 100),
        originalPrice: p.originalPrice || (p.price * (1 + Math.random() * 0.5)),
        discount: Math.floor(Math.random() * 40) + 10, // 10-50% discount
        dealEnds: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in next 7 days
        maxStock: p.stock || 99,
        isFlashDeal: Math.random() > 0.7
      })).filter(() => Math.random() > 0.3); // Show ~70% of products as deals
      
      setProducts(dealsProducts);
    }
    fetchProducts();
  }, []);

  useEffect(() => {
    let sorted = [...products];
    
    switch (sortBy) {
      case "discount":
        sorted.sort((a, b) => b.discount - a.discount);
        break;
      case "price-low":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "ending-soon":
        sorted.sort((a, b) => a.dealEnds.getTime() - b.dealEnds.getTime());
        break;
      case "rating":
        sorted.sort((a, b) => b.rating - a.rating);
        break;
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
      quantity: 1,
      vendorId: product.vendor || '', 
      vendorName: product.vendor || 'Unknown Vendor',
      maxStock: product.inStock ? 999 : 0
    });
  };

  const formatTimeLeft = (dealEnds: Date) => {
    const now = new Date();
    const timeLeft = dealEnds.getTime() - now.getTime();
    
    if (timeLeft <= 0) return "Deal ended";
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8 animate-fade-in">
            <nav className="text-sm text-muted-foreground mb-4">
              <Link href="/" className="hover:text-primary">Home</Link>
              <span className="mx-2">/</span>
              <span>Deals</span>
            </nav>
            <div className="flex flex-col md:flex-row md:items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>Amazing Deals</h1>
                <p className="text-muted-foreground">
                  Don't miss out on these limited-time offers!
                </p>
              </div>
              <div className="mt-4 md:mt-0">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discount">Highest Discount</SelectItem>
                    <SelectItem value="ending-soon">Ending Soon</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Flash Deals Banner */}
          <div className="bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg p-4 sm:p-6 mb-8 animate-scale-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4 sm:gap-0">
              <div className="flex items-center space-x-3">
                <Zap className="w-8 h-8 animate-pulse-glow" />
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold">Flash Deals</h2>
                  <p className="opacity-90 text-xs sm:text-base">Limited time offers - Act fast!</p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs sm:text-sm opacity-90">Ends in</p>
                <p className="text-lg sm:text-xl font-bold">23:45:12</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">{filteredProducts.length}</p>
              <p className="text-sm text-muted-foreground">Active Deals</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">Up to 50%</p>
              <p className="text-sm text-muted-foreground">Max Savings</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{filteredProducts.filter(p => p.isFlashDeal).length}</p>
              <p className="text-sm text-muted-foreground">Flash Deals</p>
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <Card key={product.id} className="group hover:shadow-lg transition-shadow relative overflow-hidden animate-scale-in hover-lift" style={{ animationDelay: `${index * 0.05}s` }}>
                <CardContent className="p-4">
                  {/* Deal Badge */}
                  <div className="absolute top-2 left-2 z-20">
                    <Badge variant="destructive" className="font-bold">
                      -{product.discount}%
                    </Badge>
                  </div>
                  
                  {/* Flash Deal Badge */}
                  {product.isFlashDeal && (
                    <div className="absolute top-2 right-2 z-20">
                      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black">
                        <Zap className="w-3 h-3 mr-1" />
                        Flash
                      </Badge>
                    </div>
                  )}

                  <div className="relative mb-4 mt-6 overflow-hidden rounded-lg">
                    <Link href={`/product/${product.id}`}>
                      <img
                        src={product.image || "/placeholder.svg"}
                        alt={product.name}
                        className="w-full h-48 object-cover rounded-lg cursor-pointer group-hover:scale-110 transition-transform duration-300"
                      />
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white"
                    >
                      <Heart className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Link href={`/product/${product.id}`}>
                      <h3 className="font-semibold hover:text-primary cursor-pointer line-clamp-2">
                        {product.name}
                      </h3>
                    </Link>
                    <p className="text-sm text-muted-foreground">by {product.vendor}</p>
                    
                    {/* Rating */}
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

                    {/* Price */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">₦{formatCurrency(product.price)}</span>
                        <span className="text-sm text-muted-foreground line-through">
                          ₦{formatCurrency(product.originalPrice)}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-green-600">
                        <span>You save ₦{formatCurrency(product.originalPrice - product.price)}</span>
                      </div>
                    </div>

                    {/* Time Left */}
                    <div className="flex items-center text-sm text-orange-600">
                      <Clock className="w-4 h-4 mr-1" />
                      {formatTimeLeft(product.dealEnds)}
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
              <p className="text-muted-foreground mb-4">No deals available at the moment.</p>
              <p className="text-muted-foreground">Check back soon for amazing offers!</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}