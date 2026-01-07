"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useAuth } from "@/contexts/AuthContext"
import { useCart } from "@/contexts/CartContext"

interface Product {
  _id?: string
  id?: string
  name?: string
  title?: string
  description: string
  price: number
  category: string
  images: string[]
  vendorId: string
  vendorName?: string
  vendor?: {
    _id: string
    name: string
    email: string
  }
  stock?: number
  rating?: number
  reviews?: any[]
  hasColorOptions?: boolean
  colors?: string[]
  colorImages?: { [color: string]: string[] }
  hasSizeOptions?: boolean
  sizes?: string[]
}

const ProductPage = () => {
    const { id } = useParams() as { id: string }
    const router = useRouter()
    const { user, userProfile } = useAuth()
    const [product, setProduct] = useState<Product | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [mainImage, setMainImage] = useState<string>("")
    const [selectedColor, setSelectedColor] = useState<string>("")
    const [selectedSize, setSelectedSize] = useState<string>("")
    const { addToCart } = useCart()

    // ...messages feature removed for rebuild...

    useEffect(() => {
        const fetchProduct = async () => {
            if (id) {
                try {
                    setLoading(true)
                    setError("")
                    
                    // Fetch product from API
                    const response = await fetch(`/api/database/products/${id}`)
                    let prod: Product | null = null
                    
                    if (response.ok) {
                        const result = await response.json()
                        prod = result.success ? result.data : null
                    }
                    
                    if (!prod) {
                        const mockProducts = [
                            {
                                id: "1",
                                title: "iPhone 15 Pro Max",
                                description: "The latest iPhone with advanced features, exceptional camera system, and powerful A17 Pro chip.",
                                price: 650000,
                                originalPrice: 750000,
                                category: "Electronics",
                                images: ["https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&h=800&fit=crop&crop=center"],
                                vendorName: "Apple Store Nigeria",
                                vendorId: "apple-store",
                                rating: 4.8,
                                reviews: 234,
                                featured: true,
                                tags: ["smartphone", "apple", "premium", "camera"],
                                specifications: {
                                    "Display": "6.7-inch Super Retina XDR",
                                    "Chip": "A17 Pro",
                                    "Storage": "256GB",
                                    "Camera": "48MP Main + 12MP Ultra Wide + 12MP Telephoto",
                                    "Battery": "Up to 29 hours video playback"
                                },
                                colors: ["Natural Titanium", "Blue Titanium", "White Titanium", "Black Titanium"],
                                sizes: ["128GB", "256GB", "512GB", "1TB"]
                            },
                            {
                                id: "2",
                                title: "Samsung Galaxy S24 Ultra",
                                description: "Premium Android smartphone with S Pen, powerful camera system, and all-day battery life.",
                                price: 580000,
                                category: "Electronics",
                                images: ["https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&h=800&fit=crop&crop=center"],
                                vendorName: "Samsung Official",
                                vendorId: "samsung-official",
                                rating: 4.6,
                                reviews: 178,
                                featured: true,
                                tags: ["smartphone", "samsung", "android", "s-pen"],
                                specifications: {
                                    "Display": "6.8-inch Dynamic AMOLED 2X",
                                    "Processor": "Snapdragon 8 Gen 3",
                                    "RAM": "12GB",
                                    "Storage": "512GB",
                                    "Camera": "200MP Main + 50MP Periscope + 50MP Ultra Wide + 12MP Front"
                                },
                                colors: ["Titanium Black", "Titanium Gray", "Titanium Violet", "Titanium Yellow"],
                                sizes: ["256GB", "512GB", "1TB"]
                            },
                            {
                                id: "3",
                                title: "Nike Air Jordan 1 Retro",
                                description: "Classic basketball sneakers with iconic design, premium leather construction, and legendary comfort.",
                                price: 85000,
                                originalPrice: 120000,
                                category: "Fashion",
                                images: ["https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&h=800&fit=crop&crop=center"],
                                vendorName: "Nike Store",
                                vendorId: "nike-store",
                                rating: 4.9,
                                reviews: 456,
                                featured: true,
                                tags: ["sneakers", "nike", "basketball", "retro"],
                                specifications: {
                                    "Material": "Premium Leather and Synthetic",
                                    "Sole": "Rubber Outsole",
                                    "Technology": "Air Cushioning",
                                    "Style": "High-Top Basketball"
                                },
                                colors: ["Chicago Red", "Bred", "Royal Blue", "Shadow Gray"],
                                sizes: ["7", "8", "9", "10", "11", "12", "13"]
                            },
                            {
                                id: "4",
                                title: "MacBook Pro 14\" M3",
                                description: "Professional laptop with M3 chip, Liquid Retina XDR display, and all-day battery life for creative professionals.",
                                price: 1200000,
                                category: "Electronics",
                                images: ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&h=800&fit=crop&crop=center"],
                                vendorName: "Apple Store Nigeria",
                                vendorId: "apple-store",
                                rating: 4.7,
                                reviews: 89,
                                featured: true,
                                tags: ["laptop", "apple", "professional", "m3"],
                                specifications: {
                                    "Chip": "Apple M3",
                                    "Display": "14-inch Liquid Retina XDR",
                                    "Memory": "16GB Unified Memory",
                                    "Storage": "512GB SSD",
                                    "Battery": "Up to 18 hours"
                                },
                                colors: ["Space Gray", "Silver"],
                                sizes: ["512GB", "1TB", "2TB"]
                            },
                            {
                                id: "5",
                                title: "Sony WH-1000XM5",
                                description: "Industry-leading noise canceling headphones with exceptional sound quality and 30-hour battery life.",
                                price: 180000,
                                originalPrice: 220000,
                                category: "Electronics",
                                images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop&crop=center"],
                                vendorName: "Electronics Hub",
                                vendorId: "electronics-hub",
                                rating: 4.5,
                                reviews: 167,
                                featured: true,
                                tags: ["headphones", "sony", "noise-canceling"],
                                specifications: {
                                    "Driver": "30mm Dynamic",
                                    "Noise Canceling": "Industry-leading",
                                    "Battery": "30 hours",
                                    "Connectivity": "Bluetooth 5.2, USB-C"
                                },
                                colors: ["Black", "Silver"],
                                sizes: ["One Size"]
                            },
                            {
                                id: "6",
                                title: "Apple Watch Series 9",
                                description: "Advanced health and fitness tracking with the powerful S9 chip and beautiful Always-On Retina display.",
                                price: 195000,
                                originalPrice: 220000,
                                category: "Electronics",
                                images: ["https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=800&h=800&fit=crop&crop=center"],
                                vendorName: "Apple Store Nigeria",
                                vendorId: "apple-store",
                                rating: 4.8,
                                reviews: 234,
                                featured: true,
                                tags: ["smartwatch", "apple", "fitness", "health"],
                                specifications: {
                                    "Display": "45mm Always-On Retina",
                                    "Chip": "S9 SiP",
                                    "Health": "ECG, Blood Oxygen, Heart Rate",
                                    "Battery": "Up to 18 hours"
                                },
                                colors: ["Midnight", "Starlight", "Silver", "Product Red"],
                                sizes: ["41mm", "45mm"]
                            }
                        ]
                        
                        prod = mockProducts.find(p => p.id === id) || null
                    }
                    
                    if (prod) {
                        setProduct(prod)
                        setMainImage(prod.images?.[0] || "/placeholder.svg")
                    } else {
                        setError("Product not found.")
                    }
                } catch {
                    setError("Error loading product.")
                } finally {
                    setLoading(false)
                }
            }
        }
        fetchProduct()
    }, [id])

    if (loading) return <div className="container py-20 text-center">Loading...</div>
    if (error) return <div className="container py-20 text-red-500">{error}</div>
    if (!product) return null

    return (
        <>
            <Header />
            <main className="min-h-screen bg-white">
                <div className="container mx-auto px-4 lg:px-8 py-12">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">

                        {/* Left: Image Gallery */}
                        <div>
                            <div className="relative w-full max-w-lg aspect-square rounded-2xl overflow-hidden border bg-slate-100 mx-auto">
                                <Image
                                    src={mainImage}
                                    alt={product.title || product.name || 'Product image'}
                                    width={800}
                                    height={800}
                                    className="object-cover transition-transform w-full h-full duration-500 hover:scale-105"
                                    priority
                                />
                            </div>
                            <div className="flex w-full max-w-lg mx-auto mt-4 gap-2">
                                {(product.images || ["/placeholder.svg"]).slice(0, 5).map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setMainImage(img)}
                                        className={`flex-1 aspect-square h-20 sm:h-24 md:h-28 rounded-lg overflow-hidden border-2 transition-all ${mainImage === img ? "border-indigo-600" : "border-slate-200 hover:border-slate-400"}`}
                                        type="button"
                                        style={{ minWidth: 0 }}
                                    >
                                        <Image src={img} alt={`Thumb ${i + 1}`} width={80} height={80} className="object-cover w-full h-full" priority={true} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right: Product Details */}
                        <div className="space-y-8">
                            <div>
                                <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                                    NEW ARRIVAL
                                </span>
                                <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{product.title || product.name || 'Product'}</h1>
                                <div className="mt-2 text-gray-500 text-sm">
                                    <span>by {(product as any).vendorName || 'Vendor'}</span>
                                </div>
                                <div className="mt-4 flex items-center gap-3">
                                    <p className="text-3xl font-bold text-accent">₦{product.price?.toLocaleString()}</p>
                                    {(product as any).originalPrice && (
                                        <p className="text-xl text-gray-500 line-through">₦{(product as any).originalPrice.toLocaleString()}</p>
                                    )}
                                </div>
                            </div>

                            {/* Color Options - Only show if product has colors enabled and is fashion or vendor allows it */}
                            {product.hasColorOptions && product.colors && product.colors.length > 0 && (
                                <div>
                                    <div className="mb-2 text-sm font-medium text-slate-700">Select Color</div>
                                    <div className="flex gap-2 flex-wrap">
                                        {product.colors.map((color: string) => (
                                            <button
                                                key={color}
                                                onClick={() => setSelectedColor(color)}
                                                className={`px-4 py-2 rounded-full border text-sm transition-all 
                            ${selectedColor === color
                                                        ? "bg-indigo-600 text-white border-indigo-600"
                                                        : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"}`}
                                            >
                                                {color}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Size Options - Only show if product has sizes enabled and is fashion or vendor allows it */}
                            {product.hasSizeOptions && product.sizes && product.sizes.length > 0 && (
                                <div>
                                    <div className="mb-2 text-sm font-medium text-slate-700">
                                        Select Size {product.stock <= 5 && (
                                            <span className="text-red-500 ml-2 text-xs">Only {product.stock} left!</span>
                                        )}
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        {product.sizes.map((size: string) => (
                                            <button
                                                key={size}
                                                onClick={() => setSelectedSize(size)}
                                                className={`px-4 py-2 rounded-full border text-sm transition-all 
                            ${selectedSize === size
                                                        ? "bg-indigo-600 text-white border-indigo-600"
                                                        : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"}`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            <div className="bg-slate-50 rounded-xl p-5">
                                <h2 className="font-semibold mb-2">Description</h2>
                                <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>
                            </div>

                            {/* Seller Info */}
                            <div className="bg-slate-50 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                                <div>
                                    <h3 className="font-semibold text-lg text-slate-900">Stylish <span className="text-blue-500">✔</span></h3>
                                    <p className="text-xs text-gray-500">Lagos, Nigeria</p>
                                </div>
                                <div className="flex items-center gap-1 text-yellow-500">
                                    <span>★</span><span>4.8</span>
                                    <span className="text-gray-500 ml-1">17.5k reviews</span>
                                </div>
                                <Button variant="outline" size="sm" className="hover:bg-accent/10 hover:text-accent transition-all">Visit Store</Button>
                                <p className="text-xs text-gray-500">Estimated Shipping <b>₦1,500</b></p>
                            </div>

                            {/* Add to Cart */}
                            <Button
                                className="w-full py-6 text-lg font-bold rounded-xl bg-accent text-white hover:bg-indigo-500 hover:scale-105 transition-all"
                                onClick={() => {
                                    if (!product) {
                                        console.error("Product data not available")
                                        return
                                    }
                                    
                                    const cartItem = {
                                        id: product.id || product._id || '',
                                        productId: product.id || product._id || '',
                                        title: product.title || product.name || '',
                                        vendorId: product.vendorId || '',
                                        vendorName: product.vendorName || (product as any).vendor?.name || 'Unknown Vendor',
                                        price: product.price || 0,
                                        image: mainImage || product.images?.[0] || '',
                                        quantity: 1,
                                        maxStock: product.stock || 100
                                    }
                                    
                                    // Validate required fields
                                    if (!cartItem.productId || !cartItem.title || !cartItem.price) {
                                        console.error("Invalid product data:", product)
                                        alert("Unable to add product to cart. Product data is incomplete.")
                                        return
                                    }
                                    
                                    addToCart(cartItem)
                                }}
                                disabled={product?.stock === 0}
                            >
                                {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
                            </Button>

                            {/* Message Vendor */}
                            <Button
                                className="w-full py-6 text-lg font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 transition-all flex items-center justify-center gap-2"
                                onClick={handleMessageVendor}
                                disabled={messagingVendor}
                                variant="outline"
                            >
                                <MessageCircle className="w-5 h-5" />
                                {messagingVendor ? "Starting conversation..." : "Message Vendor"}
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    )
}

export default ProductPage
