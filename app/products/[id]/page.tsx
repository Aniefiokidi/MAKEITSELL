"use client"

import React, { useState, useEffect } from "react"
import { notFound, useParams, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Heart, Bell, X, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { trackFunnelEvent } from "@/lib/funnel-tracker"
import { trackProductQuickView } from "@/lib/personalization"
import { setPendingReferralVendor, trackReferralClick } from "@/lib/referral-attribution"
import { useWishlist } from "@/contexts/WishlistContext"
import { useCart } from "@/contexts/CartContext"
import { useNotification } from "@/contexts/NotificationContext"
import Header from "@/components/Header"
import { ReviewsSection } from "@/components/reviews/ReviewsSection"
import { normalizeProductVariants, groupVariantsByLabel } from "@/lib/product-variants"

async function getProduct(id: string) {
  if (!id) return null
  const res = await fetch(`/api/database/products?id=${id}`)
  const data = await res.json()
  if (!data.success || !data.data || !data.data.length) return null
  return data.data[0]
}

export default function ProductPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const productId = String(params.id || "")

  const wishlist = useWishlist()
  const { addItem } = useCart()
  const notification = useNotification()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // label -> selected value. A product needs one selection per variant label it has
  // before Add to Cart enables (independent per-label requirement, not a combination).
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [mainImage, setMainImage] = useState<string>("")
  const [viewTracked, setViewTracked] = useState(false)
  const [justAddedToCart, setJustAddedToCart] = useState(false)
  const [isZoomOpen, setIsZoomOpen] = useState(false)

  const isElectronicsCategory = (product?.category || "").toLowerCase().includes("electronics")
  const variantGroups = groupVariantsByLabel(normalizeProductVariants(product))
  const allVariantsSelected = variantGroups.every((g) => !!selectedVariants[g.label])
  // Independent stock pools, not a combination matrix (see lib/models/Product.ts) —
  // the true bound on quantity for a multi-label selection is the smallest of the
  // selected values' own pools, a conservative cap given the two pools don't know about
  // each other.
  const selectedVariantStocks = variantGroups.map(
    (g) => g.values.find((v) => v.value === selectedVariants[g.label])?.stock ?? 0
  )
  const maxSelectableStock = variantGroups.length > 0 ? Math.min(...selectedVariantStocks, Infinity) : Number(product?.stock || 100)

  const handleAddToCart = () => {
    if (!product || isOutOfStock) return
    if (variantGroups.length > 0 && (!allVariantsSelected || maxSelectableStock <= 0)) return
    addItem({
      productId: String(product.id || productId),
      id: String(product.id || productId),
      title: product.title || product.name || "Product",
      price: Number(product.price || 0),
      image: product.images?.[0] || "",
      maxStock: maxSelectableStock,
      vendorId: String(product.vendorId || ""),
      vendorName: product.vendorName || "Unknown Vendor",
      category: product.category || "",
      selectedVariants:
        variantGroups.length > 0
          ? variantGroups.map((g) => ({ label: g.label, value: selectedVariants[g.label] }))
          : undefined,
    })
    notification.success("Product added to cart", product.title || product.name, 3000)
    setJustAddedToCart(true)
    setTimeout(() => setJustAddedToCart(false), 1700)
  }

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
    // Referral attribution — same "any listing is a referral link" model as store
    // pages, previously missing here entirely (only store visits set this)
    setPendingReferralVendor(product.vendorId)
    trackReferralClick(searchParams.get('ref'))
  }, [product, productId, viewTracked, searchParams])

  useEffect(() => {
    if (!isZoomOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsZoomOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isZoomOpen])

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

  const selectVariantValue = (label: string, value: string) => {
    setSelectedVariants((prev) => {
      const next = { ...prev }
      if (next[label] === value) {
        delete next[label]
      } else {
        next[label] = value
      }
      return next
    })
    if (label === "Color" && product.colorImages && product.colorImages[value]) {
      setMainImage(product.colorImages[value])
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
              <button
                type="button"
                onClick={() => setIsZoomOpen(true)}
                className="relative w-full max-w-sm aspect-square rounded-xl border border-border overflow-hidden cursor-zoom-in group"
                aria-label="View full image"
              >
                <Image
                  src={displayImage}
                  alt={product.title || product.name || "Product"}
                  fill
                  sizes="(max-width: 768px) 90vw, 420px"
                  className={isElectronicsCategory ? "object-contain bg-white" : "object-cover"}
                />
                <span className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-4 h-4" />
                </span>
              </button>
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
                        <Image
                          src={img}
                          alt={`Thumbnail ${i + 1}`}
                          fill
                          sizes="64px"
                          className={isElectronicsCategory ? "object-contain bg-white" : "object-cover"}
                        />
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

              {/* Variant pickers — one section per label (Color, Size, a compatible
                  device model, or a vendor's own custom dimension). Each label needs a
                  selection before Add to Cart is enabled, since the selected value's own
                  stock is what actually gets validated/decremented at order time. */}
              {variantGroups.map(({ label, values }) => (
                <div key={label} className="mb-4">
                  <h3 className="font-semibold text-sm mb-2">
                    {label}{selectedVariants[label] ? ` — ${selectedVariants[label]}` : ""}
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {values.map(({ value, stock }) => {
                      const valueOutOfStock = stock <= 0
                      const isSelected = selectedVariants[label] === value
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={valueOutOfStock}
                          onClick={() => selectVariantValue(label, value)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all flex items-center gap-2 ${
                            valueOutOfStock
                              ? "bg-muted text-muted-foreground border-border opacity-50 cursor-not-allowed"
                              : isSelected
                                ? "bg-accent text-white border-accent"
                                : "bg-background text-foreground border-border hover:border-accent hover:bg-accent/10"
                          }`}
                        >
                          {label === "Color" && (
                            <span
                              className="inline-block w-3.5 h-3.5 rounded-full border border-border"
                              style={{ backgroundColor: value.toLowerCase().replace(/\s+/g, "") }}
                            />
                          )}
                          {value}
                          {valueOutOfStock && " (Out of stock)"}
                        </button>
                      )
                    })}
                  </div>
                  {!selectedVariants[label] && (
                    <p className="text-xs text-muted-foreground mt-2">Select a {label.toLowerCase()} to add to cart.</p>
                  )}
                </div>
              ))}

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

              {isOutOfStock ? (
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
                  className={`w-full font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 ${
                    isInWishlist
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                      : "bg-accent text-white hover:bg-accent/90"
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  {isInWishlist ? "We'll notify you when it's back" : "Notify Me When Back In Stock"}
                </button>
              ) : (
                <button
                  onClick={handleAddToCart}
                  className="w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-accent/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={
                    product.status !== "active" ||
                    justAddedToCart ||
                    (variantGroups.length > 0 && (!allVariantsSelected || maxSelectableStock <= 0))
                  }
                >
                  {justAddedToCart ? "Added!" : "Add to Cart"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-6 mt-6">
          <ReviewsSection targetType="product" targetId={String(product.id || productId)} />
        </div>
      </main>

      {/* Full-image zoom overlay, Shein-style: tap the image to see it full-screen, tap
          anywhere (or the close button) to dismiss. Reuses the same gallery images/
          mainImage state as the thumbnail strip above, so arrow navigation here stays in
          sync with whichever thumbnail was last selected. */}
      {isZoomOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center cursor-zoom-out"
          onClick={() => setIsZoomOpen(false)}
        >
          <button
            onClick={() => setIsZoomOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {(product.images || []).length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const images = product.images || []
                  const idx = images.indexOf(displayImage)
                  setMainImage(images[(idx - 1 + images.length) % images.length])
                }}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const images = product.images || []
                  const idx = images.indexOf(displayImage)
                  setMainImage(images[(idx + 1) % images.length])
                }}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div className="relative w-[90vw] h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={displayImage}
              alt={product.title || product.name || "Product"}
              fill
              sizes="90vw"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
