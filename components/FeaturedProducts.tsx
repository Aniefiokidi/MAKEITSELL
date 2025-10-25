"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Star, ShoppingCart } from "lucide-react"
import { useCart } from "@/contexts/CartContext"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

// Mock data for featured products
const mockProducts = [
  {
    id: "1",
    title: "Wireless Bluetooth Headphones",
    description: "Premium quality sound with noise cancellation",
    price: 89.99,
    originalPrice: 129.99,
    category: "Electronics",
    images: ["/wireless-headphones.png"],
    vendorName: "TechStore Pro",
    rating: 4.8,
    reviews: 124,
    featured: true,
  },
  {
    id: "2",
    title: "Organic Cotton T-Shirt",
    description: "Comfortable and sustainable everyday wear",
    price: 24.99,
    originalPrice: 34.99,
    category: "Fashion",
    images: ["/cotton-tshirt.png"],
    vendorName: "EcoFashion",
    rating: 4.6,
    reviews: 89,
    featured: true,
  },
  {
    id: "3",
    title: "Smart Home Security Camera",
    description: "1080p HD with night vision and mobile app",
    price: 149.99,
    originalPrice: 199.99,
    category: "Electronics",
    images: ["/outdoor-security-camera.png"],
    vendorName: "SecureHome",
    rating: 4.9,
    reviews: 203,
    featured: true,
  },
  {
    id: "4",
    title: "Ceramic Plant Pot Set",
    description: "Set of 3 modern planters for indoor plants",
    price: 39.99,
    originalPrice: 59.99,
    category: "Home & Garden",
    images: ["/ceramic-plant-pots.png"],
    vendorName: "GreenThumb",
    rating: 4.7,
    reviews: 67,
    featured: true,
  },
  {
    id: "5",
    title: "Fitness Resistance Bands",
    description: "Complete workout set with multiple resistance levels",
    price: 19.99,
    originalPrice: 29.99,
    category: "Sports",
    images: ["/resistance-bands-exercise.png"],
    vendorName: "FitGear",
    rating: 4.5,
    reviews: 156,
    featured: true,
  },
  {
    id: "6",
    title: "Artisan Coffee Beans",
    description: "Single origin premium roasted coffee beans",
    price: 16.99,
    originalPrice: 22.99,
    category: "Food",
    images: ["/pile-of-coffee-beans.png"],
    vendorName: "RoastMaster",
    rating: 4.8,
    reviews: 92,
    featured: true,
  },
    {
    id: "7",
    title: "alert open shop",
    description: "Single origin premium roasted coffee beans",
    price: 16.99,
    originalPrice: 25.99,
    category: "Food",
    images: ["/heroimg8.jpg"],
    vendorName: "RoastMaster",
    rating: 4.8,
    reviews: 92,
    featured: true,
  },
      {
    id: "8",
    title: "Spayce rental view",
    description: "Single origin premium roasted coffee beans",
    price: 36.99,
    originalPrice: 25.99,
    category: "Food",
    images: ["/heroimg9.jpg"],
    vendorName: "RoastMaster",
    rating: 4.8,
    reviews: 92,
    featured: true,
  },
]

export default function FeaturedProducts() {
  const [products, setProducts] = useState(mockProducts)
  const { addItem } = useCart()
  const { user } = useAuth()
  const router = useRouter()

  const addToCart = (product: any) => {
    if (!user) {
      router.push("/login")
      return
    }

    addItem({
      id: `cart_${product.id}`,
      productId: product.id,
      title: product.title,
      price: product.price,
      image: product.images[0],
      vendorId: "vendor_1", // Mock vendor ID
      vendorName: product.vendorName,
      maxStock: 50, // Mock stock
    })
  }

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-3xl font-bold text-balance mb-4" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>Featured This Week</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-pretty">
            Discover our handpicked selection of trending products from trusted vendors
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6  sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product, index) => (
            <Card key={product.id} className="group overflow-hidden  transition-all duration-300 animate-scale-in hover-lift" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="relative h-60 w-full aspect-square overflow-hidden">
                <Image
                  src={product.images[0] || "/placeholder.svg"}
                  alt={product.title}
                  fill
                  className="object-cover group-hover:scale-110   transition-transform duration-300"
                />
                {product.originalPrice > product.price && (
                  <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground">
                    Save ₦{(product.originalPrice - product.price).toFixed(2)}
                  </Badge>
                )}
              </div>

              <CardContent className="px-4">
                <div className="flex items-center gap-2 mb-0">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium ml-1">{product.rating}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">({product.reviews})</span>
                </div>

                <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-pretty">{product.title}</h3>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{product.description}</p>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">₦{product.price}</span>
                    {product.originalPrice > product.price && (
                      <span className="text-sm text-muted-foreground line-through">₦{product.originalPrice}</span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">Sold by {product.vendorName}</p>
              </CardContent>

              <CardFooter className="px-4 pt-0">
                <Button className="w-full" onClick={() => addToCart(product)}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button variant="outline" size="lg" asChild>
            <Link href="/shop">View All Products</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
