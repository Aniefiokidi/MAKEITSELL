"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { X, ShoppingCart, Heart } from "lucide-react"
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
  description: string
  price: number
  category: string
  images: string[]
  vendorId: string
  vendorName: string
  stock?: number
  rating?: number
  hasColorOptions?: boolean
  colors?: string[]
  hasSizeOptions?: boolean
  sizes?: string[]
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
}

export function ProductQuickView({ product, open, onClose, onAddToCart, storeName }: ProductQuickViewProps) {
  const [mainImage, setMainImage] = useState<string>("")
  const [selectedColor, setSelectedColor] = useState<string>("")
  const [selectedSize, setSelectedSize] = useState<string>("")

  if (!product) return null

  const displayImage = mainImage || product.images?.[0] || "/placeholder.svg"

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <style>{cursorStyle}</style>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto product-quick-view-modal">
        <VisuallyHidden>
          <DialogTitle>Product Details</DialogTitle>
        </VisuallyHidden>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-50"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
          {/* Left: Image Gallery */}
          <div className="space-y-4">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-100">
              <Image
                src={displayImage}
                alt={product.title || product.name || 'Product'}
                fill
                className="object-cover"
                priority
              />
              {product.featured && (
                <Badge className="absolute top-3 right-3 bg-yellow-500 text-black font-semibold">
                  Featured
                </Badge>
              )}
            </div>
            
            {/* Thumbnails */}
            <div className="flex gap-2 overflow-x-auto">
              {(product.images || []).slice(0, 4).map((img, i) => (
                <button
                  key={i}
                  onClick={() => setMainImage(img)}
                  className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                    (mainImage || product.images?.[0]) === img 
                      ? "border-accent ring-2 ring-accent/30" 
                      : "border-slate-200 hover:border-accent/50"
                  }`}
                >
                  <Image 
                    src={img} 
                    alt={`Thumbnail ${i + 1}`} 
                    width={80} 
                    height={80} 
                    className="object-cover w-full h-full" 
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right: Product Details */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {product.title || product.name}
              </h2>
              <p className="text-sm text-slate-600">
                by <span className="font-semibold">{storeName || product.vendorName || 'Premium Vendor'}</span>
              </p>
            </div>

            {/* Price and Stock */}
            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-bold text-accent">₦{product.price?.toLocaleString()}</p>
              </div>

              <div className={`rounded-xl p-3 flex items-center gap-2 text-sm ${
                (product.stock || 0) > 10 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : (product.stock || 0) > 0
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  (product.stock || 0) > 10 
                    ? 'bg-emerald-500' 
                    : (product.stock || 0) > 0
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}></div>
                <span className="font-semibold">
                  {(product.stock || 0) > 10 
                    ? `In Stock (${product.stock}+ available)` 
                    : (product.stock || 0) > 0
                    ? `Only ${product.stock} left!`
                    : 'Out of Stock'}
                </span>
              </div>
            </div>

            {/* Color Options */}
            {product.hasColorOptions && product.colors && product.colors.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Select Color</h3>
                <div className="flex gap-2 flex-wrap">
                  {product.colors.map((color: string) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all cursor-pointer ${
                        selectedColor === color
                          ? "bg-accent text-white border-accent"
                          : "bg-white text-slate-700 border-slate-300 hover:border-accent hover:bg-accent/10"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Options */}
            {product.hasSizeOptions && product.sizes && product.sizes.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Select Size</h3>
                <div className="flex gap-2 flex-wrap">
                  {product.sizes.map((size: string) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all cursor-pointer ${
                        selectedSize === size
                          ? "bg-accent text-white border-accent"
                          : "bg-white text-slate-700 border-slate-300 hover:border-accent hover:bg-accent/10"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-2">Description</h3>
              <p className="text-sm text-slate-700 leading-relaxed">{product.description}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                className="flex-1 h-12 bg-white hover:bg-accent/10 text-accent border-2 border-accent font-semibold rounded-xl transition-all hover:shadow-lg cursor-pointer"
                onClick={() => {
                  onAddToCart(product)
                  onClose()
                }}
                disabled={product.stock === 0}
              >
                <img src="/images/logo3.png" alt="Cart" className="w-8 h-8 -mr-2 -mt-3" />
                {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
              </Button>
              <Button
                variant="outline"
                className="h-12 px-4 rounded-xl border-2 hover:bg-accent/10 hover:border-accent transition-all cursor-pointer"
                onClick={() => {/* Add to wishlist */}}
              >
                <Heart className="w-5 h-5" />
              </Button>
            </div>

            {/* Vendor Info */}
            <div className="bg-slate-50 rounded-xl p-4 text-sm">
              <p className="text-slate-600">
                Sold by <span className="font-semibold text-slate-900">{storeName || product.vendorName || 'Premium Vendor'}</span>
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
