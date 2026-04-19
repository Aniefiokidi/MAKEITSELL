"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { ShoppingCart, Heart, Copy, Check } from "lucide-react"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { siFacebook, siInstagram, siSnapchat, siWhatsapp, siX } from "simple-icons"

interface Product {
  _id?: string
  id: string
  name?: string
  title?: string
  storeName?: string
  description: string
  price: number
  category: string
  images: string[]
  vendorId: string
  vendorName: string
  vendor?: {
    name?: string
  }
  stock?: number
  rating?: number
  hasColorOptions?: boolean
  colors?: string[]
  hasSizeOptions?: boolean
  sizes?: string[]
  colorImages?: { [key: string]: string }
  featured: boolean
  status: string
  sales: number
  createdAt: string
  updatedAt: string
}

interface ProductQuickViewProps {
  product: Product | null
  open: boolean
  onClose: () => void
  onAddToCart: (product: Product) => void
  storeName?: string
  className?: string
}

export function ProductQuickView({ product, open, onClose, onAddToCart, storeName, className }: ProductQuickViewProps) {
  const [mainImage, setMainImage] = useState<string>("")
  const [selectedColor, setSelectedColor] = useState<string>("")
  const [selectedSize, setSelectedSize] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [isMainImageLight, setIsMainImageLight] = useState(false)

  // Compute the best store name fallback
  const fallbackStoreName = storeName
    || product?.storeName
    || product?.vendorName
    || product?.vendor?.name
    || ''

  useEffect(() => {
    setSelectedColor("")
    setSelectedSize("")
    setMainImage("")
    setCopied(false)
    setIsMainImageLight(false)
  }, [open, product])

  const displayImage = mainImage || product?.images?.[0] || "/placeholder.svg"
  const productSlug = String(product?.id || product?._id || "").trim()
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/products/${encodeURIComponent(productSlug)}`
    : ""

  const BrandIcon = ({
    path,
    color,
    label,
  }: {
    path: string
    color: string
    label: string
  }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <title>{label}</title>
      <path fill={color} d={path} />
    </svg>
  )

  const handleCopyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  useEffect(() => {
    if (!open || !displayImage) return

    const probe = new window.Image()
    probe.crossOrigin = "anonymous"

    probe.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const w = 16
        const h = 16
        canvas.width = w
        canvas.height = h
        ctx.drawImage(probe, 0, 0, w, h)

        const { data } = ctx.getImageData(0, 0, w, h)
        let luminanceTotal = 0
        const pixels = data.length / 4

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          luminanceTotal += 0.2126 * r + 0.7152 * g + 0.0722 * b
        }

        const averageLuminance = luminanceTotal / pixels
        setIsMainImageLight(averageLuminance >= 165)
      } catch {
        setIsMainImageLight(false)
      }
    }

    probe.onerror = () => setIsMainImageLight(false)
    probe.src = displayImage
  }, [displayImage, open])

  if (!product) return null

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
    if (product.colorImages && product.colorImages[color]) {
      setMainImage(product.colorImages[color])
    }
  }

  const displayName = product.title || product.name || "Product"
  const hasColorOptions = Boolean(product.hasColorOptions && product.colors && product.colors.length > 0)
  const hasSizeOptions = Boolean(product.hasSizeOptions && product.sizes && product.sizes.length > 0)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`max-w-[1520px] w-[98vw] sm:w-[95vw] lg:w-[96vw] p-0 overflow-y-auto overscroll-contain border border-slate-200 bg-white rounded-2xl shadow-2xl product-quick-view-modal ${className || ""}`}>
        <style>{`
          .product-quick-view-modal {
            max-height: 94dvh;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          @media (max-width: 640px) {
            .product-quick-view-modal {
              max-height: calc(100dvh - 0.5rem);
              height: calc(100dvh - 0.5rem);
              border-radius: 0;
            }
          }
          .product-quick-view-modal::-webkit-scrollbar {
            display: none;
          }
          .product-quick-view-modal [data-slot="dialog-close"] {
            top: 0.85rem;
            right: 0.85rem;
            border-radius: 9999px;
            background: rgba(15, 23, 42, 0.9);
            color: #ffffff;
            opacity: 1;
            border: 1px solid rgba(255, 255, 255, 0.35);
            box-shadow: 0 8px 24px rgba(2, 6, 23, 0.35);
            backdrop-filter: blur(10px);
          }
          .product-quick-view-modal [data-slot="dialog-close"]:hover {
            background: rgba(255, 255, 255, 0.95);
            color: #111827;
          }
          .product-quick-view-modal [data-slot="dialog-close"] svg {
            width: 1.15rem;
            height: 1.15rem;
          }
        `}</style>
        <VisuallyHidden>
          <DialogTitle>Product Details</DialogTitle>
        </VisuallyHidden>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
          <div className="lg:col-span-8 p-3 sm:p-5 lg:p-6 bg-slate-50/60 border-b lg:border-b-0 lg:border-r border-slate-200">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-100 shadow-inner">
              <Image
                src={displayImage}
                alt={displayName}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-x-0 top-0 p-3 sm:p-4 flex items-center justify-between">
                <Badge variant="secondary" className="bg-white/90 text-slate-700 border border-slate-200">
                  {product.category || "General"}
                </Badge>
                {product.featured && (
                  <Badge className="bg-amber-500 text-slate-900 font-semibold text-xs">Featured</Badge>
                )}
              </div>
            </div>
            {(product.images || []).length > 1 && (
              <div className="flex gap-2 mt-3 sm:mt-4 overflow-x-auto pb-1 snap-x snap-mandatory scroll-smooth w-full">
                {(product.images || []).slice(0, 5).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setMainImage(img)}
                    className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 transition-all snap-center active:scale-95 md:active:scale-100 ${
                      (mainImage || product.images?.[0]) === img 
                        ? "border-accent ring-2 ring-accent/30 shadow-md" 
                        : "border-slate-200 hover:border-accent/40 active:border-accent"
                    }`}
                  >
                    <Image 
                      src={img} 
                      alt={`Thumbnail ${i + 1}`} 
                      width={56} 
                      height={56} 
                      className="object-cover w-full h-full" 
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col">
            <div className="p-3 sm:p-5 lg:p-6 space-y-5">
              <div className="space-y-1.5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Product details</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-900 leading-tight">{displayName}</h2>
                <p className="text-sm text-slate-600">
                  Sold by <span className="font-semibold text-slate-800">{fallbackStoreName || "Premium Vendor"}</span>
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">Price</p>
                  <p className="text-2xl font-bold text-accent">₦{product.price?.toLocaleString()}</p>
                </div>
                <Badge className={`${
                  (product.stock || 0) > 10
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : (product.stock || 0) > 0
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-rose-100 text-rose-800 border border-rose-200"
                }`}>
                  {(product.stock || 0) > 10 ? `In stock (${product.stock}+ available)` : (product.stock || 0) > 0 ? `Only ${product.stock} left` : "Out of stock"}
                </Badge>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Options</p>
                {hasColorOptions && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Color</p>
                    <div className="flex gap-2 flex-wrap">
                      {(product.colors || []).map((color: string) => (
                        <button
                          key={color}
                          onClick={() => handleColorSelect(color)}
                          className={`px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
                            selectedColor === color
                              ? "bg-accent text-white border-accent"
                              : "bg-white text-slate-700 border-slate-300 hover:border-accent hover:bg-accent/5"
                          }`}
                        >
                          <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: color.toLowerCase().replace(/ /g, "") }} />
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {hasSizeOptions && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Size</p>
                    <div className="flex gap-2 flex-wrap">
                      {(product.sizes || []).map((size: string) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
                            selectedSize === size
                              ? "bg-accent text-white border-accent"
                              : "bg-white text-slate-700 border-slate-300 hover:border-accent hover:bg-accent/5"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!hasColorOptions && !hasSizeOptions && (
                  <p className="text-xs text-slate-500">No configurable options for this product.</p>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Description</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap wrap-break-word leading-relaxed">
                  {product.description || "No description provided for this product yet."}
                </p>
              </div>

              <div className="flex gap-2 flex-col sm:flex-row">
                <Button
                  className="flex-1 h-11 bg-accent text-white border border-accent font-semibold rounded-lg transition-all hover:shadow-md text-sm"
                  onClick={() => {
                    onAddToCart(product)
                    onClose()
                  }}
                  disabled={product.stock === 0}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {product.stock === 0 ? "Out of stock" : "Add to cart"}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 px-4 rounded-lg border border-slate-300 hover:bg-slate-50 transition-all"
                  onClick={() => {
                    /* Add to wishlist */
                  }}
                  aria-label="Add to wishlist"
                >
                  <Heart className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Share</p>
                <div className="grid grid-cols-6 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    aria-label="Copy product link"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-100"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on Facebook"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white transition-all hover:border-blue-300 hover:bg-blue-50"
                  >
                    <BrandIcon path={siFacebook.path} color="#1877F2" label="Facebook" />
                  </a>
                  <a
                    href={`https://x.com/intent/post?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(displayName + " " + shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on X"
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-all ${
                      isMainImageLight
                        ? "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-100"
                        : "border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800"
                    }`}
                  >
                    <BrandIcon path={siX.path} color={isMainImageLight ? "#000000" : "#FFFFFF"} label="X" />
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(displayName + " " + shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on WhatsApp"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white transition-all hover:border-green-300 hover:bg-green-50"
                  >
                    <BrandIcon path={siWhatsapp.path} color="#25D366" label="WhatsApp" />
                  </a>
                  <a
                    href={`https://www.instagram.com/?url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on Instagram"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white transition-all hover:border-pink-300 hover:bg-pink-50"
                  >
                    <BrandIcon path={siInstagram.path} color="#E4405F" label="Instagram" />
                  </a>
                  <a
                    href={`https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on Snapchat"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white transition-all hover:border-yellow-300 hover:bg-yellow-50"
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
  )
}
