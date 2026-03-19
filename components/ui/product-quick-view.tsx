"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { ShoppingCart, Heart, Copy, Check } from "lucide-react"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { siFacebook, siInstagram, siSnapchat, siWhatsapp, siX } from "simple-icons"

const cursorStyle = `
  .product-quick-view-modal {
    --cursor-color: currentColor;
  }
  
  .product-quick-view-modal button,
  .product-quick-view-modal [role="button"] {
    cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="8" height="12" viewBox="0 0 8 12"><path fill="black" d="M0 0 L0 10 L3 7 L5 12 L8 11 L6 6 L9 6 Z"/></svg>') 4 0, auto;
  }
`

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
  }, [open, product])

  if (!product) return null

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
    if (product.colorImages && product.colorImages[color]) {
      setMainImage(product.colorImages[color])
    }
  }

  const displayImage = mainImage || product.images?.[0] || "/placeholder.svg"
  const productSlug = String(product.id || product._id || "").trim()
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <style>{cursorStyle}</style>
      <DialogContent className={`max-w-6xl w-full product-quick-view-modal bg-white/30 backdrop-blur-xl border border-white/20 shadow-2xl shadow-accent/10 rounded-2xl p-2 sm:p-6 ${className || ""}`}>
        <style>{`
          .product-quick-view-modal {
            min-width: 100vw;
            max-width: 100vw;
            min-height: 100vh;
            max-height: 100vh;
            height: 100vh;
            overflow-y: auto;
            scrollbar-width: none;
          }
          @media (min-width: 640px) {
            .product-quick-view-modal {
              min-width: 700px;
              max-width: 1200px;
              min-height: 700px;
              max-height: 900px;
              height: 90vh;
            }
          }
          .product-quick-view-modal::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <VisuallyHidden>
          <DialogTitle>Product Details</DialogTitle>
        </VisuallyHidden>

        <div className="flex flex-col md:flex-row gap-4 md:gap-8 pt-2 md:pt-6">
          {/* Left: Image Gallery */}
          <div className="w-full md:w-1/2 flex flex-col items-center">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-100 min-h-[220px] sm:min-h-80">
              <Image
                src={displayImage}
                alt={product.title || product.name || 'Product'}
                fill
                className="object-cover"
                priority
              />
              {product.featured && (
                <Badge className="absolute top-3 right-3 bg-yellow-500 text-black font-semibold text-xs md:text-sm">
                  Featured
                </Badge>
              )}
            </div>
            {(product.images || []).length > 1 && (
              <div className="flex gap-2 mt-2 sm:mt-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth w-full">
                {(product.images || []).slice(0, 5).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setMainImage(img)}
                    className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all cursor-pointer snap-center active:scale-95 md:active:scale-100 ${
                      (mainImage || product.images?.[0]) === img 
                        ? "border-accent ring-2 ring-accent/30" 
                        : "border-slate-200 hover:border-accent/50 active:border-accent"
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

          {/* Right: Product Details */}
                  <div className="w-full md:w-1/2 flex flex-col gap-3 md:gap-4 mt-4 md:mt-0">
                    <div className="flex flex-col gap-2 bg-white/80 rounded-xl p-3 sm:p-4 shadow-md">
                      <h2 className="text-lg sm:text-2xl font-bold text-accent mb-1 drop-shadow-sm">{product.title || product.name}</h2>
                      <span className="text-xs font-medium text-gray-700">Brand: <span className="font-semibold">{fallbackStoreName || 'Premium Vendor'}</span></span>
                      <span className="text-lg sm:text-xl font-bold text-accent drop-shadow-sm">₦{product.price?.toLocaleString()}</span>
                      <span className={`text-xs sm:text-sm font-semibold drop-shadow-sm ${
                        (product.stock || 0) > 10 ? 'text-emerald-700' : (product.stock || 0) > 0 ? 'text-amber-700' : 'text-red-700'
                      }`}>
                        {(product.stock || 0) > 10 ? `In Stock (${product.stock}+ available)` : (product.stock || 0) > 0 ? `Only ${product.stock} left!` : 'Out of Stock'}
                      </span>
                    </div>

                    {/* Variation Available */}
                    <div className="bg-slate-50 rounded-lg p-2 sm:p-3 flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-600">Variation Available</span>
                      {product.hasColorOptions && product.colors && product.colors.length > 0 && (
                        <div className="flex gap-1 sm:gap-2 flex-wrap">
                          {product.colors.map((color: string) => (
                            <button
                              key={color}
                              onClick={() => handleColorSelect(color)}
                              className={`px-2 py-1 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                                selectedColor === color ? "bg-accent text-white border-accent" : "bg-white text-slate-700 border-slate-300 hover:border-accent hover:bg-accent/10"
                              }`}
                            >
                              <div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: color.toLowerCase().replace(/ /g, '') }} />
                              {color}
                            </button>
                          ))}
                        </div>
                      )}
                      {product.hasSizeOptions && product.sizes && product.sizes.length > 0 && (
                        <div className="flex gap-1 sm:gap-2 flex-wrap">
                          {product.sizes.map((size: string) => (
                            <button
                              key={size}
                              onClick={() => setSelectedSize(size)}
                              className={`px-2 py-1 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                                selectedSize === size ? "bg-accent text-white border-accent" : "bg-white text-slate-700 border-slate-300 hover:border-accent hover:bg-accent/10"
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div className="bg-slate-50 rounded-lg p-2 sm:p-3">
                      <span className="font-semibold text-xs mb-2 block">Description</span>
                      <span className="text-xs text-slate-700 whitespace-pre-wrap wrap-break-word">{product.description}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 sm:gap-2 flex-col sm:flex-row">
                      <Button
                        className="flex-1 h-10 bg-accent text-white border-2 border-accent font-semibold rounded-lg transition-all hover:shadow-lg cursor-pointer text-xs active:scale-95"
                        onClick={() => {
                          onAddToCart(product)
                          onClose()
                        }}
                        disabled={product.stock === 0}
                      >
                        <ShoppingCart className="w-5 h-5 mr-2" />
                        {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 px-3 rounded-lg border-2 hover:bg-accent/10 hover:border-accent transition-all cursor-pointer active:scale-95"
                        onClick={() => {/* Add to wishlist */}}
                      >
                        <Heart className="w-5 h-5" />
                      </Button>
                    </div>

                    {/* Social Media Share Icons */}
                    <div className="bg-slate-50 rounded-lg p-3 sm:p-4 flex flex-col gap-3 border border-slate-200/80">
                      <span className="text-sm text-slate-700 font-semibold">Share this product</span>
                      <div className="grid grid-cols-6 gap-2 sm:gap-3">
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          aria-label="Copy product link"
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-100"
                        >
                          {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                        </button>
                        <a
                          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Share on Facebook"
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-xs transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50"
                        >
                          <BrandIcon path={siFacebook.path} color="#1877F2" label="Facebook" />
                        </a>
                        <a
                          href={`https://x.com/intent/post?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(product.title || product.name || 'Check this product!')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Share on X"
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-xs transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-100"
                        >
                          <BrandIcon path={siX.path} color="#000000" label="X" />
                        </a>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent((product.title || product.name || 'Check this product!') + ' ' + shareUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Share on WhatsApp"
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-xs transition-all hover:-translate-y-0.5 hover:border-green-300 hover:bg-green-50"
                        >
                          <BrandIcon path={siWhatsapp.path} color="#25D366" label="WhatsApp" />
                        </a>
                        <a
                          href={`https://www.instagram.com/?url=${encodeURIComponent(shareUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Share on Instagram"
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-xs transition-all hover:-translate-y-0.5 hover:border-pink-300 hover:bg-pink-50"
                        >
                          <BrandIcon path={siInstagram.path} color="#E4405F" label="Instagram" />
                        </a>
                        <a
                          href={`https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(shareUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Share on Snapchat"
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-xs transition-all hover:-translate-y-0.5 hover:border-yellow-300 hover:bg-yellow-50"
                        >
                          <BrandIcon path={siSnapchat.path} color="#FFFC00" label="Snapchat" />
                        </a>
                      </div>
                    </div>
                  </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
