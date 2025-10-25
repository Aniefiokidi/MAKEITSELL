"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Star, Clock, Truck, MapPin, Search, Heart, ShoppingCart, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getStoreById, getStores, getVendorProducts, type Store } from "@/lib/firestore"
import { useCart } from "@/contexts/CartContext"

export default function StorePage() {
  const params = useParams()
  const storeId = params.id as string
  const [mounted, setMounted] = useState(false)
  const [store, setStore] = useState<Store | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [filteredProducts, setFilteredProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("featured")
  const { addToCart } = useCart()
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)

  // Get category-specific font styling
  const getCategoryFont = (category: string) => {
    const lowerCategory = category?.toLowerCase() || ''
    
    if (lowerCategory.includes('fashion') || lowerCategory.includes('clothing')) {
      return {
        fontFamily: '"Bebas Neue", "Arial Black", sans-serif',
        letterSpacing: '3px',
        textTransform: 'uppercase' as const,
        fontWeight: '900',
        fontStyle: 'italic' as const
      }
    }
    if (lowerCategory.includes('electronics') || lowerCategory.includes('tech')) {
      return {
        fontFamily: '"Courier New", monospace',
        letterSpacing: '1px',
        fontWeight: 'bold'
      }
    }
    if (lowerCategory.includes('food') || lowerCategory.includes('restaurant')) {
      return {
        fontFamily: '"Brush Script MT", cursive',
        fontWeight: 'normal'
      }
    }
    if (lowerCategory.includes('beauty') || lowerCategory.includes('cosmetics')) {
      return {
        fontFamily: '"Garamond", serif',
        letterSpacing: '3px',
        fontWeight: '300'
      }
    }
    if (lowerCategory.includes('sports') || lowerCategory.includes('fitness')) {
      return {
        fontFamily: '"Arial Black", sans-serif',
        fontWeight: '900',
        fontStyle: 'italic' as const
      }
    }
    // Default
    return {
      fontFamily: 'inherit',
      fontWeight: 'bold'
    }
  }

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Banner slideshow effect
  useEffect(() => {
    if (!store) return
    
    const bannerImages = [
      store.storeBanner,
      store.storeImage,
      ...(store.bannerImages || [])
    ].filter(Boolean)
    
    if (bannerImages.length <= 1) return
    
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % bannerImages.length)
    }, 6000) // Change every 6 seconds
    
    return () => clearInterval(interval)
  }, [store])

  useEffect(() => {
    async function fetchStoreData() {
      if (!storeId) return
      
      setLoading(true)
      try {
        // First try to fetch from Firestore by ID
        try {
          const storeData = await getStoreById(storeId);
          console.log("Found store by ID:", storeData);
          setStore(storeData);
          
          const storeProducts = await getVendorProducts(storeData.vendorId);
          setProducts(storeProducts.map((p: any) => ({
            ...p,
            name: p.title,
            image: Array.isArray(p.images) ? p.images[0] : p.image || "/placeholder.svg",
            vendor: p.vendorName || p.vendor || storeData.storeName,
            inStock: typeof p.stock === "number" ? p.stock > 0 : true,
            rating: p.rating || 5,
            reviews: p.reviews || 0,
            originalPrice: p.originalPrice || null,
            maxStock: p.stock || 99,
          })));
          setLoading(false);
          return; // Exit if we found the store in Firestore
        } catch (firestoreError) {
          console.log("Store not found by ID in Firestore, trying to find by name...");
          
          // Try to find store by name (since the URL might not match the actual document ID)
          try {
            const allStores = await getStores();
            console.log("All stores:", allStores);
            const storeData = allStores.find(store => 
              store.storeName.toLowerCase() === "swagshack" || 
              store.id === storeId ||
              store.storeName.toLowerCase().replace(/\s+/g, '') === storeId.toLowerCase()
            );
            
            if (storeData) {
              console.log("Found store by search:", storeData);
              setStore(storeData);
              
              const storeProducts = await getVendorProducts(storeData.vendorId);
              setProducts(storeProducts.map((p: any) => ({
                ...p,
                name: p.title,
                image: Array.isArray(p.images) ? p.images[0] : p.image || "/placeholder.svg",
                vendor: p.vendorName || p.vendor || storeData.storeName,
                inStock: typeof p.stock === "number" ? p.stock > 0 : true,
                rating: p.rating || 5,
                reviews: p.reviews || 0,
                originalPrice: p.originalPrice || null,
                maxStock: p.stock || 99,
              })));
              setLoading(false);
              return;
            }
          } catch (searchError) {
            console.log("Could not search stores:", searchError);
          }
        }

        // Fallback to mock stores if not found in Firestore
        const mockStores = [
          {
            id: "1",
            vendorId: "vendor1",
            storeName: "TechHub Electronics",
            storeDescription: "Your one-stop shop for the latest electronics and gadgets. We offer cutting-edge technology at competitive prices with excellent customer service.",
            storeImage: "/images/store-electronics.jpg",
            storeBanner: "/images/banner-electronics.jpg",
            category: "electronics",
            rating: 4.8,
            reviewCount: 245,
            isOpen: true,
            deliveryTime: "30-45 min",
            deliveryFee: 500,
            minimumOrder: 2000,
            address: "Victoria Island, Lagos",
            phone: "+234 812 345 6789",
            email: "contact@techhub.com",
            createdAt: null,
            updatedAt: null
          },
          {
            id: "2",
            vendorId: "vendor2",
            storeName: "Fashion Forward",
            storeDescription: "Trendy fashion for the modern individual. Discover the latest styles and timeless classics from top designers around the world.",
            storeImage: "/images/store-fashion.jpg",
            storeBanner: "/images/banner-fashion.jpg",
            category: "fashion",
            rating: 4.6,
            reviewCount: 189,
            isOpen: true,
            deliveryTime: "45-60 min",
            deliveryFee: 800,
            minimumOrder: 3000,
            address: "Lekki Phase 1, Lagos",
            phone: "+234 813 456 7890",
            email: "hello@fashionforward.com",
            createdAt: null,
            updatedAt: null
          },
          {
            id: "3",
            vendorId: "vendor3",
            storeName: "Home Essentials",
            storeDescription: "Beautiful home decor and essential items to make your house a home. Quality furniture, decor, and lifestyle products.",
            storeImage: "/images/store-home.jpg",
            storeBanner: "/images/banner-home.jpg",
            category: "home",
            rating: 4.7,
            reviewCount: 156,
            isOpen: false,
            deliveryTime: "60-90 min",
            deliveryFee: 1000,
            minimumOrder: 5000,
            address: "Ikeja, Lagos",
            phone: "+234 814 567 8901",
            email: "info@homeessentials.com",
            createdAt: null,
            updatedAt: null
          },
          {
            id: "YD3PD8mzl8KzTTpPcJS46",
            vendorId: "vendor4",
            storeName: "swagshack",
            storeDescription: "streetwear clothing",
            storeImage: "/placeholder.svg",
            storeBanner: "/placeholder.svg",
            category: "fashion",
            rating: 5.0,
            reviewCount: 0,
            isOpen: true,
            deliveryTime: "30-60 min",
            deliveryFee: 500,
            minimumOrder: 2000,
            address: "16 Olu Akerete Street",
            phone: "+234 815 678 9012",
            email: "info@swagshack.com",
            createdAt: null,
            updatedAt: null
          }
        ];

        const mockStore = mockStores.find(s => s.id === storeId);
        if (mockStore) {
          setStore(mockStore);
          
          // Mock products for this store
          const mockProducts = [
            {
              id: `${storeId}-1`,
              title: mockStore.category === "electronics" ? "Wireless Headphones" : 
                    mockStore.category === "fashion" ? "Designer T-Shirt" : "Decorative Vase",
              description: mockStore.category === "electronics" ? "High-quality wireless headphones with noise cancellation" : 
                          mockStore.category === "fashion" ? "Premium cotton t-shirt with modern design" : "Beautiful ceramic vase for home decoration",
              price: mockStore.category === "electronics" ? 15000 : 
                     mockStore.category === "fashion" ? 8500 : 12000,
              images: ["/placeholder.svg"],
              category: mockStore.category,
              stock: 10,
              vendorId: mockStore.vendorId,
              vendorName: mockStore.storeName,
              rating: 4.5,
              reviews: 23,
              originalPrice: null,
              maxStock: 10
            },
            {
              id: `${storeId}-2`,
              title: mockStore.category === "electronics" ? "Smartphone Case" : 
                    mockStore.category === "fashion" ? "Skinny Jeans" : "Table Lamp",
              description: mockStore.category === "electronics" ? "Protective case for your smartphone" : 
                          mockStore.category === "fashion" ? "Comfortable skinny jeans in multiple colors" : "Modern LED table lamp",
              price: mockStore.category === "electronics" ? 3500 : 
                     mockStore.category === "fashion" ? 12000 : 8500,
              images: ["/placeholder.svg"],
              category: mockStore.category,
              stock: 15,
              vendorId: mockStore.vendorId,
              vendorName: mockStore.storeName,
              rating: 4.7,
              reviews: 15,
              originalPrice: null,
              maxStock: 15
            }
          ];
          
          setProducts(mockProducts.map(p => ({
            ...p,
            name: p.title,
            image: p.images[0],
            vendor: p.vendorName,
            inStock: p.stock > 0
          })));
        }
      } catch (error) {
        console.error("Error fetching store data:", error);
      }
      setLoading(false);
    }

    fetchStoreData();
  }, [storeId]);

  useEffect(() => {
    let filtered = products;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort products
    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        filtered.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case "newest":
        filtered.reverse();
        break;
      default:
        // Featured - keep original order
        break;
    }

    setFilteredProducts(filtered);
  }, [searchQuery, sortBy, products]);

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
    });
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="container mx-auto px-4 py-8 flex-1">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-64 w-full mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="w-full h-48 mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="container mx-auto px-4 py-8 flex-1">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-64 w-full mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="w-full h-48 mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="container mx-auto px-4 py-8 flex-1 text-center">
          <h1 className="text-2xl font-bold mb-4">Store Not Found</h1>
          <p className="text-muted-foreground mb-4">The store you're looking for doesn't exist.</p>
          <Link href="/shop">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Stores
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      {/* Full Width Banner Section */}
      <div className="relative w-full h-[500px] overflow-hidden">
        {/* Banner images with fade transition */}
        {[store.storeBanner, store.storeImage, ...(store.bannerImages || [])].filter(Boolean).map((image, index) => (
          <img
            key={index}
            src={image || "/placeholder.svg"}
            alt={store.storeName}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{
              opacity: currentBannerIndex === index ? 1 : 0,
              zIndex: currentBannerIndex === index ? 1 : 0
            }}
          />
        ))}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" style={{ zIndex: 2 }} />
        
        {/* Bottom Fade to White */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" style={{ zIndex: 3 }} />
        
        {/* Back Button - Top Left */}
        <div className="absolute top-6 left-6 z-10">
          <Link href="/shop">
            <Button variant="outline" className="bg-white/90 hover:bg-white border-2 backdrop-blur-sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Stores
            </Button>
          </Link>
        </div>

        {/* Store Badge - Top Right */}
        {!store.isOpen ? (
          <Badge variant="secondary" className="absolute top-6 right-6 z-10 text-lg px-4 py-2">
            Closed
          </Badge>
        ) : (
          <Badge variant="default" className="absolute top-6 right-6 z-10 bg-green-600 text-lg px-4 py-2">
            Open
          </Badge>
        )}
        
        {/* Store Info - Bottom */}
        <div className="absolute bottom-8 left-8 right-8 text-white z-10">
          <h1 className="text-5xl font-bold mb-3 animate-fade-in" style={{
            ...getCategoryFont(store.category),
            WebkitTextStroke: '4px #8b2e0b',
            paintOrder: 'stroke fill',
            textShadow: '0 0 8px #8b2e0b'
          }}>{store.storeName}</h1>
          <p className="text-2xl animate-fade-in-delay mb-4" style={{
            WebkitTextStroke: '3px #8b2e0b',
            paintOrder: 'stroke fill',
            textShadow: '0 0 6px #8b2e0b'
          }}>{store.storeDescription}</p>
        </div>
      </div>

      {/* Store Content Section */}
      <div className="container mx-auto px-4 py-8 flex-1">
        {/* Store Info */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      i < Math.floor(store.rating) ? "text-yellow-400 fill-current" : "text-gray-300"
                    }`}
                  />
                ))}
              </div>
              <span className="font-medium">{store.rating}</span>
              <span className="text-muted-foreground">({store.reviewCount} reviews)</span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-5 h-5" />
              <span>{store.deliveryTime}</span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="w-5 h-5" />
              <span>₦{store.deliveryFee} delivery</span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-5 h-5" />
              <span>{store.address}</span>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm">
              <strong>Minimum order:</strong> ₦{store.minimumOrder.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Search and Sort */}
        <div className="mb-8 flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search products in this store..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">No products found in this store.</p>
            {searchQuery && (
              <Button onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <Card key={product.id} className="group hover:shadow-lg transition-shadow animate-scale-in hover-lift" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardContent className="p-4">
                  <div className="relative mb-4 overflow-hidden rounded-lg">
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
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white"
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
                      <h3 className="font-semibold hover:text-primary cursor-pointer line-clamp-2">
                        {product.name}
                      </h3>
                    </Link>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(product.rating) ? "text-yellow-400 fill-current" : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">({product.reviews})</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">₦{product.price.toLocaleString()}</span>
                        {product.originalPrice && (
                          <span className="text-sm text-muted-foreground line-through">
                            ₦{product.originalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => handleAddToCart(product)} 
                        disabled={!product.inStock}
                      >
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
      
      <Footer />
    </div>
  );
}