"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { X, ShoppingCart, Heart, Copy, Check } from "lucide-react"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

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
        <button
          onClick={onClose}
          className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded-sm opacity-80 ring-offset-background transition-opacity hover:opacity-100  disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-50"
          style={{
            padding: 0,
            width: '2.5rem',
            height: '2.5rem',
            minWidth: '2.5rem',
            minHeight: '2.5rem',
          }}
        >
          <span className="block sm:hidden text-accent">
            <X className="h-8 w-8" />
          </span>
          
          <span className="sr-only">Close</span>
        </button>

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
            {(product.hasColorOptions || product.hasSizeOptions) && (
              <div className="flex flex-col gap-2">
                <span className="font-semibold text-xs">Variation Available</span>
                {product.hasColorOptions && product.colors && product.colors.length > 0 && (
                  <div className="flex gap-1 sm:gap-2 flex-wrap">
                    {product.colors.map((color: string) => (
                      <button
                        key={color}
                        onClick={() => handleColorSelect(color)}
                        className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium border-2 transition-all cursor-pointer flex items-center gap-1 sm:gap-2 ${
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
                        className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium border-2 transition-all cursor-pointer ${
                          selectedSize === size ? "bg-accent text-white border-accent" : "bg-white text-slate-700 border-slate-300 hover:border-accent hover:bg-accent/10"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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
            <div className="bg-slate-50 rounded-lg p-2 sm:p-3 flex flex-col gap-2">
              <span className="text-xs text-slate-600 font-semibold mb-1">Share this product</span>
              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  aria-label="Copy product link"
                  className="text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-all"
                >
                  {copied ? <Check className="h-7 w-7" /> : <Copy className="h-7 w-7" />}
                </button>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on Facebook"
                  className="text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-all"
                >
                  <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M22.675 0h-21.35C.595 0 0 .592 0 1.326v21.348C0 23.408.595 24 1.325 24h11.495v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.797.143v3.24l-1.918.001c-1.504 0-1.797.715-1.797 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116C23.406 24 24 23.408 24 22.674V1.326C24 .592 23.406 0 22.675 0"/></svg>
                </a>
                <a
                  href={`https://x.com/intent/post?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(product.title || product.name || 'Check this product!')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on X"
                  className="text-black p-2 rounded-full hover:bg-slate-100 transition-all"
                >
                  <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2H21l-6.56 7.496L22.5 22h-6.3l-4.934-6.458L5.53 22H2.77l7.014-8.014L1.5 2h6.46l4.46 5.893L18.244 2zm-2.208 18h1.64L7.067 3.896H5.31L16.036 20z"/></svg>
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent((product.title || product.name || 'Check this product!') + ' ' + shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on WhatsApp"
                  className="text-green-600 p-2 rounded-full hover:bg-green-50 transition-all"
                >
                  <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.151-.174.2-.298.3-.497.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.372-.01-.571-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.363.709.306 1.262.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.617h-.001a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.987c-.003 5.451-4.437 9.885-9.888 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .06 5.435.057 12.086c0 2.13.557 4.21 1.615 6.032L0 24l6.064-1.594a11.888 11.888 0 0 0 5.983 1.528h.005c6.554 0 11.89-5.435 11.893-12.086a11.82 11.82 0 0 0-3.48-8.465"/></svg>
                </a>
                <a
                  href={`https://www.instagram.com/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on Instagram"
                  className="text-pink-500 p-2 rounded-full hover:bg-pink-50 transition-all"
                >
                  <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.974.974 1.246 2.241 1.308 3.608.058 1.266.069 1.646.069 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.974.974-2.241 1.246-3.608 1.308-1.266.058-1.646.069-4.85.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.974-.974-1.246-2.241-1.308-3.608C2.175 15.647 2.163 15.267 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608C4.515 2.567 5.782 2.295 7.148 2.233 8.414 2.175 8.794 2.163 12 2.163zm0-2.163C8.741 0 8.332.013 7.052.072 5.771.131 4.659.363 3.678 1.344c-.98.98-1.213 2.092-1.272 3.373C2.013 5.668 2 6.077 2 12c0 5.923.013 6.332.072 7.613.059 1.281.292 2.393 1.272 3.373.98.98 2.092 1.213 3.373 1.272C8.332 23.987 8.741 24 12 24s3.668-.013 4.948-.072c1.281-.059 2.393-.292 3.373-1.272.98-.98 1.213-2.092 1.272-3.373.059-1.281.072-1.69.072-7.613 0-5.923-.013-6.332-.072-7.613-.059-1.281-.292-2.393-1.272-3.373-.98-.98-2.092-1.213-3.373-1.272C15.668.013 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a3.999 3.999 0 1 1 0-7.998 3.999 3.999 0 0 1 0 7.998zm6.406-11.845a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/></svg>
                </a>
                <a
                  href={`https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on Snapchat"
                  className="text-yellow-400 p-2 rounded-full hover:bg-yellow-50 transition-all"
                >
                  <svg width="28" height="28" fill="currentColor" viewBox="0 0 48 48"><path d="M24 4C13.1 4 4 13.1 4 24c0 10.9 9.1 20 20 20s20-9.1 20-20C44 13.1 34.9 4 24 4zm0 36c-8.8 0-16-7.2-16-16S15.2 8 24 8s16 7.2 16 16-7.2 16-16 16zm7.7-8.2c-.2-.2-.5-.3-.8-.2-1.2.3-2.5.6-3.8.8-.3.1-.6-.1-.7-.4-.2-.4-.4-.8-.6-1.2-.1-.2-.3-.3-.5-.3-.2 0-.4.1-.5.3-.2.4-.4.8-.6 1.2-.1.3-.4.5-.7.4-1.3-.2-2.6-.5-3.8-.8-.3-.1-.6 0-.8.2-.2.2-.3.5-.2.8.2.7.4 1.4.7 2.1.1.2 0 .5-.2.6-.7.5-1.4 1-2.1 1.5-.2.1-.3.4-.2.6.1.2.4.3.6.2.8-.3 1.6-.7 2.4-1.1.2-.1.5 0 .6.2.3.5.7 1 .9 1.5.1.2.4.3.6.2.2-.1.3-.4.2-.6-.2-.5-.5-1-.8-1.5-.1-.2 0-.5.2-.6.7-.5 1.4-1 2.1-1.5.2-.1.5 0 .6.2.3.5.7 1 .9 1.5.1.2.4.3.6.2.2-.1.3-.4.2-.6-.2-.5-.5-1-.8-1.5-.1-.2 0-.5.2-.6.7-.5 1.4-1 2.1-1.5.2-.1.5 0 .6.2.3.5.7 1 .9 1.5.1.2.4.3.6.2.2-.1.3-.4.2-.6-.2-.5-.5-1-.8-1.5-.1-.2 0-.5.2-.6.7-.5 1.4-1 2.1-1.5.2-.1.5 0 .6.2.3.5.7 1 .9 1.5.1.2.4.3.6.2.2-.1.3-.4.2-.6-.2-.5-.5-1-.8-1.5-.1-.2 0-.5.2-.6.7-.5 1.4-1 2.1-1.5.2-.1.5 0 .6.2.3.5.7 1 .9 1.5.1.2.4.3.6.2.2-.1.3-.4.2-.6-.2-.5-.5-1-.8-1.5-.1-.2 0-.5.2-.6.7-.5 1.4-1 2.1-1.5.2-.1.5 0 .6.2.3.5.7 1 .9 1.5.1.2.4.3.6.2.2-.1.3-.4.2-.6-.2-.5-.5-1-.8-1.5-.1-.2 0-.5.2-.6.7-.5 1.4-1 2.1-1.5.2-.1.5 0 .6.2.3.5.7 1 .9 1.5.1.2.4.3.6.2.2-.1.3-.4.2-.6-.2-.5-.5-1-.8-1.5-.1-.2 0-.5.2-.6.7-.5 1.4-1 2.1-1.5.2-.1.5 0 .6.2.3.5.7 1 .9 1.5.1.2.4.3.6.2.2-.1.3-.4.2-.6-.2-.5-.5-1-.8-1.5-.1-.2 0-.5.2-.6.7-.5 1.4-1 2.1-1.5.2-.1.5 0 .6.2.3.5.7 1 .9 1.5.1.2.4.3.6.2.2-.1.3-.4.2-.6-.2-.5-.5-1-.8-1.5-.1-.2 0-.5.2-.6.7-.5 1.4-1 2.1-1.5.2-.1.5 0 .6.2.3.5.7 1 .9 1.5.1.2.4.3.6.2.2-.1.3-.4.2-.6-.2-.5-.5-1-.8-1.5-.1-.2 0-.5.2-.6z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
