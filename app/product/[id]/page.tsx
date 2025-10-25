"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getDocument, createConversation, getConversations } from "@/lib/firestore"
import type { Product } from "@/lib/firestore"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { MessageCircle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Timestamp } from "firebase/firestore"

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
    const [messagingVendor, setMessagingVendor] = useState(false)
    const { addToCart } = require("@/contexts/CartContext").useCart();

    const handleMessageVendor = async () => {
        if (!user || !userProfile) {
            router.push("/login")
            return
        }

        if (!product?.vendorId) {
            alert("Vendor information is not available.")
            return
        }

        try {
            setMessagingVendor(true)
            
            // Check if conversation exists
            const existingConversations = await getConversations(user.uid, "customer")
            const existingConversation = existingConversations.find(
                conv => conv.providerId === product.vendorId
            )

            if (existingConversation) {
                router.push("/messages")
                return
            }

            // Create new conversation
            await createConversation({
                customerId: user.uid,
                customerName: userProfile.displayName,
                providerId: product.vendorId,
                providerName: product.vendorName || "Vendor",
                storeName: product.vendorName || "Vendor Store",
                storeImage: "",
                lastMessage: "Interested in: " + product.title,
                lastMessageTime: Timestamp.now(),
                unreadCount: 0
            })

            router.push("/messages")
        } catch (error) {
            console.error("Error creating conversation:", error)
            alert("Failed to start conversation. Please try again.")
        } finally {
            setMessagingVendor(false)
        }
    }

    useEffect(() => {
        const fetchProduct = async () => {
            if (id) {
                try {
                    setLoading(true)
                    setError("")
                    const prod = await getDocument("products", id) as Product | null
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

    const colorOptions = ["Black", "Cream", "Green", "Blue", "Red"]
    const sizeOptions = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]

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
                                    alt={product.title}
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
                                <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{product.title}</h1>
                                <div className="flex items-center gap-2 mt-2 text-yellow-500">
                                    <span>★</span>
                                    <span className="font-semibold">4.5</span>
                                    <span className="text-gray-500 text-sm">623 reviews</span>
                                    <span className="text-gray-500 text-sm ml-2">1,919 Sold</span>
                                </div>
                                <p className="text-3xl font-bold text-accent mt-4">₦{product.price}</p>
                            </div>

                            {/* Color */}
                            <div>
                                <div className="mb-2 text-sm font-medium text-slate-700">Select Color</div>
                                <div className="flex gap-2 flex-wrap">
                                    {colorOptions.map(color => (
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

                            {/* Size */}
                            <div>
                                <div className="mb-2 text-sm font-medium text-slate-700">
                                    Select Size {product.stock <= 5 && (
                                        <span className="text-red-500 ml-2 text-xs">Only {product.stock} left!</span>
                                    )}
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {sizeOptions.map(size => (
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
                                <Button variant="outline" size="sm">Visit Store</Button>
                                <p className="text-xs text-gray-500">Estimated Shipping <b>₦1,500</b></p>
                            </div>

                            {/* Add to Cart */}
                            <Button
                                className="w-full py-6 text-lg font-bold rounded-xl bg-accent text-white hover:bg-indigo-500 transition"
                                onClick={() => addToCart({
                                    id: product.id,
                                    productId: product.id,
                                    title: product.title,
                                    vendorId: product.vendorId,
                                    vendorName: product.vendorName,
                                    price: product.price,
                                    image: mainImage,
                                    quantity: 1,
                                    maxStock: product.stock,
                                    color: selectedColor,
                                    size: selectedSize
                                })}
                                disabled={product.stock === 0}
                            >
                                {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
                            </Button>

                            {/* Message Vendor */}
                            <Button
                                className="w-full py-6 text-lg font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center gap-2"
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
