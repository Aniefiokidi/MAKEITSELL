"use client"

import { useEffect, useState, useCallback } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { Heart, Copy, Check, X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import {
  siFacebook,
  siX,
  siWhatsapp,
  siInstagram,
  siSnapchat,
} from "simple-icons"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name?: string
  title?: string
  description?: string
  price?: number
  images?: string[]
  category?: string
  stock?: number
  vendorId?: string
  vendorName?: string
  featured?: boolean
  status?: string
  sales?: number
  colors?: string[]
  sizes?: string[]
  colorImages?: { [key: string]: string }
  createdAt?: string
  updatedAt?: string
}

interface ProductQuickViewProps {
  product: Product | null
  open: boolean
  onClose: () => void
  onAddToCart: (product: Product) => void
  storeName?: string
  className?: string
}

// ─── BrandIcon helper ─────────────────────────────────────────────────────────

function BrandIcon({ path, color, label }: { path: string; color: string; label: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      aria-label={label}
      className="w-4 h-4"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={path} />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductQuickView({
  product,
  open,
  onClose,
  onAddToCart,
  storeName,
  className,
}: ProductQuickViewProps) {
  const [mainImage, setMainImage] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isMainImageLight, setIsMainImageLight] = useState(true)
  const [imageZoomed, setImageZoomed] = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)
  const [wishlist, setWishlist] = useState(false)

  // Reset state when product or open changes
  useEffect(() => {
    setMainImage(null)
    setSelectedColor(null)
    setSelectedSize(null)
    setCopied(false)
    setImageZoomed(false)
    setAddedToCart(false)
  }, [product?.id, open])

  // Auto-select first color/size if available
  useEffect(() => {
    if (!product) return
    if (product.colors?.length && !selectedColor) setSelectedColor(product.colors[0])
    if (product.sizes?.length && !selectedSize) setSelectedSize(product.sizes[0])
  }, [product])

  // Keyboard navigation for image gallery
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open || !product?.images?.length) return
      const images = product.images
      const currentIndex = images.indexOf(mainImage || images[0])
      if (e.key === "ArrowLeft") {
        setMainImage(images[Math.max(0, currentIndex - 1)])
      } else if (e.key === "ArrowRight") {
        setMainImage(images[Math.min(images.length - 1, currentIndex + 1)])
      } else if (e.key === "Escape") {
        if (imageZoomed) setImageZoomed(false)
        else onClose()
      }
    },
    [open, product, mainImage, imageZoomed, onClose]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  if (!product) return null

  // ── Derived values ───────────────────────────────────────────────────────────

  const displayName = product.name || product.title || "Unnamed Product"
  const fallbackStoreName = storeName || product.vendorName || ""
  const images = product.images || []

  // Resolve display image: color image override → mainImage → first image → placeholder
  const colorImageSrc =
    selectedColor && product.colorImages?.[selectedColor]
      ? product.colorImages[selectedColor]
      : null
  const displayImage = colorImageSrc || mainImage || images[0] || "/placeholder.svg"

  const hasColorOptions = Array.isArray(product.colors) && product.colors.length > 0
  const hasSizeOptions = Array.isArray(product.sizes) && product.sizes.length > 0

  const stockCount = product.stock ?? 0
  const isOutOfStock = stockCount === 0
  const isLowStock = stockCount > 0 && stockCount <= 10

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/products/${product.id}`
      : `https://makeitsell.com/products/${product.id}`

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
    if (product.colorImages?.[color]) {
      setMainImage(product.colorImages[color])
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea")
      el.value = shareUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleAddToCart = () => {
    onAddToCart(product)
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  const handlePrevImage = () => {
    if (!images.length) return
    const idx = images.indexOf(displayImage)
    setMainImage(images[Math.max(0, idx - 1)])
  }

  const handleNextImage = () => {
    if (!images.length) return
    const idx = images.indexOf(displayImage)
    setMainImage(images[Math.min(images.length - 1, idx + 1)])
  }

  const currentImageIndex = images.indexOf(displayImage)

  // ── Stock badge ───────────────────────────────────────────────────────────────

  const stockBadgeClass = isOutOfStock
    ? "bg-rose-100 text-rose-800 border border-rose-200"
    : isLowStock
    ? "bg-amber-100 text-amber-800 border border-amber-200"
    : "bg-emerald-100 text-emerald-800 border border-emerald-200"

  const stockLabel = isOutOfStock
    ? "Out of stock"
    : isLowStock
    ? `Only ${stockCount} left`
    : `In stock (${stockCount}+ available)`

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Zoom overlay */}
      {imageZoomed && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center cursor-zoom-out"
          onClick={() => setImageZoomed(false)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all"
            onClick={() => setImageZoomed(false)}
            aria-label="Close zoom"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative w-[90vw] h-[90vh]">
            <Image
              src={displayImage}
              alt={displayName}
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className={`
                w-full max-w-full sm:!w-[98vw] sm:!max-w-[98vw] lg:!w-[70vw] lg:!max-w-[70vw] p-0 gap-0
                overflow-hidden rounded-3xl border-0
                shadow-[0_40px_100px_-15px_rgba(0,0,0,0.3),0_0_0_1px_rgba(0,0,0,0.05)]
                hide-scrollbar-desktop
                ${className ?? ""}
              `}
          style={{ maxHeight: "92vh" }}
        >
          <style>{`
            @media (min-width: 1024px) {
              .hide-scrollbar-desktop::-webkit-scrollbar {
                display: none !important;
              }
              .hide-scrollbar-desktop {
                -ms-overflow-style: none !important;
                scrollbar-width: none !important;
              }
            }
          `}</style>
          <VisuallyHidden>
            <DialogTitle>{displayName}</DialogTitle>
          </VisuallyHidden>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 shadow-md hover:bg-white transition-all hover:scale-110 active:scale-95"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 max-h-[92vh] overflow-y-auto lg:overflow-hidden">

            {/* ── Image Section ───────────────────────────────────────────────── */}
            <div className="lg:col-span-7 xl:col-span-7 p-3 sm:p-5 lg:p-6 bg-slate-50/60 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col items-center justify-start lg:overflow-y-auto">

              {/* Main image */}
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-100 shadow-inner group">
                <Image
                  src={displayImage}
                  alt={displayName}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 98vw, 70vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  priority
                />

                {/* Top badges */}
                <div className="absolute inset-x-0 top-0 p-3 sm:p-4 flex items-center justify-between">
                  <Badge variant="secondary" className="bg-white/90 text-slate-700 border border-slate-200 shadow-sm">
                    {product.category || "General"}
                  </Badge>
                  <div className="flex gap-1.5">
                    {/* Only show featured badge on large screens */}
                    {product.featured && (
                      <Badge className="hidden lg:inline-flex bg-amber-500 text-slate-900 font-semibold text-xs shadow-sm">
                        ⭐ Featured
                      </Badge>
                    )}
                    {isLowStock && !isOutOfStock && (
                      <Badge className="bg-rose-500 text-white text-xs shadow-sm">
                        Low stock
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Zoom button */}
                <button
                  onClick={() => setImageZoomed(true)}
                  className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 shadow hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                  aria-label="Zoom image"
                >
                  <ZoomIn className="w-4 h-4 text-slate-600" />
                </button>

                {/* Arrow navigation (only if multiple images) */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      disabled={currentImageIndex <= 0}
                      className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 shadow hover:bg-white transition-all disabled:opacity-30 opacity-0 group-hover:opacity-100"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                      onClick={handleNextImage}
                      disabled={currentImageIndex >= images.length - 1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 shadow hover:bg-white transition-all disabled:opacity-30 opacity-0 group-hover:opacity-100"
                      aria-label="Next image"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </>
                )}

                {/* Dot indicators */}
                {images.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setMainImage(images[i])}
                        className={`rounded-full transition-all ${
                          currentImageIndex === i
                            ? "bg-white w-4 h-2"
                            : "bg-white/50 w-2 h-2 hover:bg-white/80"
                        }`}
                        aria-label={`Image ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="flex gap-2 mt-3 sm:mt-4 overflow-x-auto pb-1 snap-x snap-mandatory scroll-smooth w-full">
                  {images.slice(0, 6).map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setMainImage(img)}
                      className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all snap-center active:scale-95 ${
                        displayImage === img
                          ? "border-accent ring-2 ring-accent/30 shadow-md"
                          : "border-slate-200 hover:border-accent/40"
                      }`}
                      aria-label={`View image ${i + 1}`}
                    >
                      <Image
                        src={img}
                        alt={`Thumbnail ${i + 1}`}
                        width={64}
                        height={64}
                        className="object-cover w-full h-full"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Details Section ─────────────────────────────────────────────── */}
            <div className="lg:col-span-5 xl:col-span-5 flex flex-col lg:overflow-y-auto">
              <div className="p-4 sm:p-5 lg:p-6 space-y-4">

                {/* Title & store */}
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-medium">Product details</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{displayName}</h2>
                  <p className="text-sm text-slate-500">
                    Sold by{" "}
                    <span className="font-semibold text-slate-700">{fallbackStoreName || "Premium Vendor"}</span>
                  </p>
                </div>

                {/* Price & stock */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Price</p>
                    <p className="text-2xl font-bold text-accent">
                      ₦{product.price?.toLocaleString() ?? "—"}
                    </p>
                  </div>
                  <Badge className={stockBadgeClass}>{stockLabel}</Badge>
                </div>

                {/* Description */}
                {product.description && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Description</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-4">
                      {product.description}
                    </p>
                  </div>
                )}

                {/* Options */}
                {(hasColorOptions || hasSizeOptions) && (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Options</p>

                    {hasColorOptions && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500">
                          Color{selectedColor ? <span className="font-semibold text-slate-700 ml-1">— {selectedColor}</span> : ""}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {product.colors!.map((color) => (
                            <button
                              key={color}
                              onClick={() => handleColorSelect(color)}
                              className={`px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
                                selectedColor === color
                                  ? "bg-accent text-white border-accent shadow-sm"
                                  : "bg-white text-slate-700 border-slate-300 hover:border-accent hover:bg-accent/5"
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                                style={{ backgroundColor: color.toLowerCase().replace(/ /g, "") }}
                              />
                              {color}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasSizeOptions && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500">
                          Size{selectedSize ? <span className="font-semibold text-slate-700 ml-1">— {selectedSize}</span> : ""}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {product.sizes!.map((size) => (
                            <button
                              key={size}
                              onClick={() => setSelectedSize(size)}
                              className={`px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
                                selectedSize === size
                                  ? "bg-accent text-white border-accent shadow-sm"
                                  : "bg-white text-slate-700 border-slate-300 hover:border-accent hover:bg-accent/5"
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* CTA buttons */}
                <div className="flex gap-2">
                  <Button
                    size="lg"
                    className={`flex-1 flex items-center gap-2 justify-center rounded-xl h-12 text-base font-semibold transition-all duration-200 ${
                      addedToCart
                        ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
                        : "border border-accent bg-white text-accent   shadow-none hover:scale-[1.02] active:scale-95"
                    }`}
                    disabled={isOutOfStock}
                    onClick={handleAddToCart}
                  >
                    {addedToCart ? (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Added!</span>
                      </>
                    ) : (
                      <>
                        <img src="/images/logo3.png" alt="" className="w-6 h-6 -mt-0.5" />
                        <span>{isOutOfStock ? "Out of stock" : "Add to cart"}</span>
                      </>
                    )}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setWishlist((w) => !w)}
                    className={`rounded-xl h-12 w-12 flex items-center justify-center transition-all ${
                      wishlist
                        ? "border-rose-300 bg-rose-50 text-rose-500 hover:bg-rose-100"
                        : "border-slate-300 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500"
                    }`}
                    aria-label={wishlist ? "Remove from wishlist" : "Add to wishlist"}
                  >
                    <Heart className={`w-5 h-5 transition-all ${wishlist ? "fill-rose-400 text-rose-400" : ""}`} />
                  </Button>
                </div>


                {/* Share */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2.5">Share</p>
                  <div className="flex gap-2 flex-wrap">

                    {/* Copy link */}
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      aria-label="Copy product link"
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
                        copied
                          ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>

                    {/* Facebook */}
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on Facebook"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white transition-all hover:border-blue-300 hover:bg-blue-50"
                    >
                      <BrandIcon path={siFacebook.path} color="#1877F2" label="Facebook" />
                    </a>

                    {/* X / Twitter */}
                    <a
                      href={`https://x.com/intent/post?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(displayName + " " + shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on X"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white transition-all hover:border-slate-400 hover:bg-slate-100"
                    >
                      <BrandIcon path={siX.path} color="#000000" label="X" />
                    </a>

                    {/* WhatsApp */}
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(displayName + " — " + shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on WhatsApp"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white transition-all hover:border-green-300 hover:bg-green-50"
                    >
                      <BrandIcon path={siWhatsapp.path} color="#25D366" label="WhatsApp" />
                    </a>

                    {/* Instagram */}
                    <a
                      href={`https://www.instagram.com/?url=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on Instagram"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white transition-all hover:border-pink-300 hover:bg-pink-50"
                    >
                      <BrandIcon path={siInstagram.path} color="#E4405F" label="Instagram" />
                    </a>

                    {/* Snapchat */}
                    <a
                      href={`https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on Snapchat"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white transition-all hover:border-yellow-300 hover:bg-yellow-50"
                    >
                      <BrandIcon path={siSnapchat.path} color="#FFFC00" label="Snapchat" />
                    </a>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
