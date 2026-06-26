"use client"

import React, { useState, useEffect } from "react"
import { notFound, useParams } from "next/navigation"
import Image from "next/image"
import { Heart } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { trackFunnelEvent } from "@/lib/funnel-tracker"
import { trackProductQuickView } from "@/lib/personalization"
import { useWishlist } from "@/contexts/WishlistContext"
import Header from "@/components/Header"

async function getProduct(id: string) {
  if (!id) return null
  const res = await fetch(`/api/database/products?id=${id}`)
  const data = await res.json()
  if (!data.success || !data.data || !data.data.length) return null
  return data.data[0]
}

export default function ProductPage() {
  const params = useParams()
  const productId = String(params.id || "")

  const wishlist = useWishlist()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedColor, setSelectedColor] = useState<string>("")
  const [selectedSize, setSelectedSize] = useState<string>("")
  const [mainImage, setMainImage] = useState<string>("")
  const [viewTracked, setViewTracked] = useState(false)

  useEffect(() => {
    async function fetchProduct() {
      const prod = await getProduct(productId)
      if (prod) {
        setProduct(prod)
        setMainImage(prod.images?.[0] || "/placeholder.png")
      }
      setLoading(false)
    }
    fetchProduct()
  }, [productId])

  useEffect(() => {
    if (!product?.vendorId || viewTracked) return
    trackProductQuickView({
      id: product.id || productId,
      category: product.category,
      title: product.title || product.name,
      vendorName: product.vendorName,
      storeName: product.storeName,
      price: Number(product.price || 0),
      image: product.images?.[0] || "",
    })
    setViewTracked(true)
    void trackFunnelEvent(product.vendorId, "product_view", { productId: product.id || productId })
  }, [product, productId, viewTracked])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-6">
            <div className="flex flex-col md:grid md:grid-cols-2 gap-6">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <div className="space-y-4 pt-2">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-7 w-1/3" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!product) return notFound()

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
    if (product.colorImages && product.colorImages[color]) {
      setMainImage(product.colorImages[color])
    }
  }

  const displayImage = mainImage || product.images?.[0] || "/placeholder.png"
  const isInWishlist = wishlist.isInWishlist(String(product.id || productId))
  const isOutOfStock = product.stock === 0 && product.category !== "Food & Beverages"

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-6">
          <div className="flex flex-col md:grid md:grid-cols-2 gap-6">
            {/* Image gallery */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-full max-w-sm aspect-square rounded-xl border border-border overflow-hidden">
                <Image
                  src={displayImage}
                  alt={product.title || product.name || "Product"}
                  fill
                  sizes="(max-width: 768px) 90vw, 420px"
                  className="object-cover"
                />
              </div>
              {(product.images || []).length > 1 && (
                <div className="flex gap-2 flex-wrap justify-center">
                  {(product.images || []).map((img: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setMainImage(img)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        mainImage === img
                          ? "border-accent ring-2 ring-accent/30"
                          : "border-border hover:border-accent/50"
                      }`}
                    >
                      <div className="relative w-full h-full">
                        <Image src={img} alt={`Thumbnail ${i + 1}`} fill sizes="64px" className="object-cover" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {product.title || product.name}
                </h1>
                <button
                  onClick={() =>
                    wishlist.toggle({
                      productId: String(product.id || productId),
                      title: product.title || product.name,
                      price: Number(product.price || 0),
                      image: product.images?.[0] || "",
                      vendorId: String(product.vendorId || ""),
                      category: product.category || "",
                    })
                  }
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center border border-border hover:border-red-300 hover:bg-red-50 transition-all"
                  title={isInWishlist ? "Remove from wishlist" : "Save to wishlist"}
                >
                  <Heart
                    className={`w-5 h-5 transition-colors ${
                      isInWishlist ? "fill-red-500 text-red-500" : "text-muted-foreground"
                    }`}
                  />
                </button>
              </div>

              <div className="mb-4 text-accent font-bold text-2xl">
                ₦{product.price?.toLocaleString?.() || product.price}
              </div>

              {/* Stock status */}
              {product.category === "Food & Beverages" ? (
                <div className="mb-4 rounded-lg p-3 flex items-center gap-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold">Made to order</span>
                </div>
              ) : (
                <div
                  className={`mb-4 rounded-lg p-3 flex items-center gap-2 text-sm ${
                    (product.stock || 0) > 10
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : (product.stock || 0) > 0
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      (product.stock || 0) > 10
                        ? "bg-emerald-500"
                        : (product.stock || 0) > 0
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="font-semibold">
                    {(product.stock || 0) > 10
                      ? `In Stock (${product.stock}+ available)`
                      : (product.stock || 0) > 0
                      ? `Only ${product.stock} left!`
                      : "Out of Stock"}
                  </span>
                </div>
              )}

              {/* Color options */}
              {product.hasColorOptions && product.colors && product.colors.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-sm mb-2">Select Color</h3>
                  <div className="flex gap-2 flex-wrap">
                    {product.colors.map((color: string) => (
                      <button
                        key={color}
                        onClick={() => handleColorSelect(color)}
                        className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all flex items-center gap-2 ${
                          selectedColor === color
                            ? "bg-accent text-white border-accent"
                            : "bg-background text-foreground border-border hover:border-accent hover:bg-accent/10"
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: color.toLowerCase().replace(/ /g, "") }}
                        />
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size options */}
              {product.hasSizeOptions && product.sizes && product.sizes.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-sm mb-2">Select Size</h3>
                  <div className="flex gap-2 flex-wrap">
                    {product.sizes.map((size: string) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                          selectedSize === size
                            ? "bg-accent text-white border-accent"
                            : "bg-background text-foreground border-border hover:border-accent hover:bg-accent/10"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="mb-4 bg-muted/50 rounded-lg p-3">
                <h3 className="font-semibold text-sm mb-2">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap wrap-break-word">
                  {product.description}
                </p>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <span className="bg-accent/10 text-accent px-2 py-1 rounded text-xs">
                  {product.category}
                </span>
                {product.featured && (
                  <span className="bg-accent/15 text-accent px-2 py-1 rounded text-xs font-semibold">
                    Featured
                  </span>
                )}
              </div>

              <div className="mb-4 text-xs text-muted-foreground">
                Sold by:{" "}
                <span className="font-medium text-foreground">
                  {product.vendorName || "Unknown Vendor"}
                </span>
              </div>

              <button
                className="w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-accent/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isOutOfStock || product.status !== "active"}
              >
                {isOutOfStock ? "Out of Stock" : "Add to Cart"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
