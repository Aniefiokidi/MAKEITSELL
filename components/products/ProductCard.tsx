"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Heart, ShoppingCart, Store } from "lucide-react"
import { useCart } from "@/contexts/CartContext"
import { useWishlist } from "@/contexts/WishlistContext"
import { useNotification } from "@/contexts/NotificationContext"
import { optimizedImageUrl } from "@/lib/cloudinary-url"

export interface ProductCardProduct {
  id: string
  name?: string
  title?: string
  price: number
  images?: string[]
  category?: string
  stock?: number
  vendorId?: string
  vendorName?: string
  storeName?: string
  featured?: boolean
  hasSizeOptions?: boolean
  sizes?: string[]
  hasColorOptions?: boolean
  colors?: string[]
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop"

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount)

// Same convention used in the vendor product form (app/vendor/products/new) — colors are
// stored as plain CSS color-name strings, not hex, so swatches resolve the same way here.
const colorToCss = (color: string) => color.toLowerCase().replace(/\s+/g, '')

// Module-level so React never treats it as a new component type on parent re-renders.
const ImageCycler = React.memo(({ product, contain }: { product: ProductCardProduct; contain: boolean }) => {
  const [index, setIndex] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const images = (product.images || []).filter((src): src is string => typeof src === "string" && src.trim().length > 0)
  const isOos = (product.stock ?? 0) === 0 && product.category !== "Food & Beverages"

  const handleEnter = useCallback(() => {
    if (images.length > 1) {
      intervalRef.current = setInterval(() => {
        setIndex((prev) => (prev + 1 >= images.length ? 0 : prev + 1))
      }, 1200)
    }
  }, [images.length])

  const handleLeave = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIndex(0)
  }, [])

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  const src = optimizedImageUrl(images[index] || images[0], { width: 500 }) || FALLBACK_IMAGE

  return (
    <div className="absolute inset-0 w-full h-full" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <img
        key={index}
        src={src}
        alt={(product.title || product.name || "Product") as string}
        loading="lazy"
        decoding="async"
        className={`absolute inset-0 w-full h-full ${contain ? "object-contain bg-white" : "object-cover"} group-hover:scale-110 transition-transform duration-500 ${isOos ? "grayscale" : ""}`}
      />
    </div>
  )
})
ImageCycler.displayName = "ProductCardImageCycler"

export interface ProductCardProps {
  product: ProductCardProduct
  /** Called when the card body is opened (quick view or navigation) — not fired when the cart/wishlist buttons are clicked. */
  onOpen?: (product: ProductCardProduct) => void
  /** Override the default add-to-cart behavior (e.g. to add funnel tracking). Defaults to useCart().addItem + a success toast. */
  onAddToCart?: (product: ProductCardProduct) => void
  /** Show the vendor/store name line. Turn off on single-store pages where it would just repeat the page context. */
  showVendor?: boolean
  suggested?: boolean
  /** Force object-contain (white background) instead of the default cover crop — useful for electronics categories. */
  forceContain?: boolean
  className?: string
}

export function ProductCard({
  product,
  onOpen,
  onAddToCart,
  showVendor = true,
  suggested = false,
  forceContain,
  className = "",
}: ProductCardProps) {
  const { addItem } = useCart()
  const wishlist = useWishlist()
  const notification = useNotification()
  const [justAdded, setJustAdded] = useState(false)

  const title = product.title || product.name || "Product"
  const vendorLabel = product.storeName || product.vendorName
  const isOos = (product.stock ?? 0) === 0 && product.category !== "Food & Beverages"
  const isLowStock = (product.stock ?? 0) > 0 && (product.stock ?? 0) < 10
  const contain = forceContain ?? (product.category || "").toLowerCase().includes("electronics")

  const handleAddToCart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (isOos || justAdded) return

      if (onAddToCart) {
        onAddToCart(product)
      } else {
        addItem({
          productId: product.id,
          id: product.id,
          title,
          price: Number(product.price || 0),
          image: product.images?.[0] || "",
          maxStock: Number(product.stock || 100),
          vendorId: String(product.vendorId || ""),
          vendorName: vendorLabel || "Unknown Vendor",
          category: product.category || "",
        })
        notification.success("Product added to cart", title, 3000)
      }
      setJustAdded(true)
      setTimeout(() => setJustAdded(false), 1700)
    },
    [isOos, justAdded, onAddToCart, product, title, vendorLabel, addItem, notification]
  )

  const handleWishlistToggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      wishlist.toggle({
        productId: String(product.id),
        title,
        price: Number(product.price || 0),
        image: String(product.images?.[0] || ""),
        vendorId: String(product.vendorId || ""),
        category: product.category || "",
      })
    },
    [wishlist, product, title]
  )

  const inWishlist = wishlist.isInWishlist(String(product.id))

  return (
    <Card
      className={`p-0 gap-0 overflow-hidden relative border border-neutral-200/80 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 rounded-2xl active:scale-[0.98] cursor-pointer group card-lift flex flex-col ${className}`}
      onClick={() => onOpen?.(product)}
    >
      {/* Image zone */}
      <div className="relative aspect-[4/5] overflow-hidden bg-muted shrink-0">
        <ImageCycler product={product} contain={contain} />

        {isOos && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div className="bg-red-600 text-white px-4 sm:px-8 py-1 sm:py-2 transform -rotate-45 font-bold text-xs sm:text-sm shadow-lg">
              OUT OF STOCK
            </div>
          </div>
        )}

        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {product.featured && (
            <Badge className="bg-yellow-500 text-black font-semibold text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 shadow">
              <svg className="inline w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-800 fill-current mr-0.5" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z" />
              </svg>
              Featured
            </Badge>
          )}
          {suggested && (
            <Badge className="bg-blue-500 text-white font-semibold text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 shadow">
              Suggested
            </Badge>
          )}
          {isLowStock && (
            <Badge variant="destructive" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 shadow">
              Only {product.stock} left
            </Badge>
          )}
        </div>

        <button
          type="button"
          onClick={handleWishlistToggle}
          className="absolute top-2 right-2 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/95 shadow flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        >
          <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${inWishlist ? "fill-red-500 text-red-500" : "text-neutral-500"}`} />
        </button>
      </div>

      {/* Solid detail panel — deliberately opaque (not overlaid on the image) so text
          contrast never depends on how light or dark the product photo is. */}
      <div className="border-t-[3px] border-accent bg-white px-2.5 sm:px-3 py-2 sm:py-2.5 space-y-1.5 flex-1 flex flex-col">
        <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 line-clamp-2 leading-snug min-h-8 sm:min-h-9">
          {title}
        </h3>

        {showVendor && vendorLabel && (
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
            <Store className="w-3 h-3 shrink-0" />
            <span className="line-clamp-1">{vendorLabel}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-1.5">
          <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1.5 py-0 max-w-[55%] min-w-0 whitespace-nowrap overflow-hidden text-ellipsis text-muted-foreground font-normal">
            {product.category || "General"}
          </Badge>
          <span className="text-sm sm:text-base font-bold text-accent whitespace-nowrap">
            {formatCurrency(Number(product.price || 0))}
          </span>
        </div>

        {(product.hasColorOptions && product.colors && product.colors.length > 0) && (
          <div className="flex items-center gap-1 flex-wrap">
            {product.colors.slice(0, 6).map((color, idx) => (
              <span
                key={idx}
                title={color}
                className="w-3.5 h-3.5 rounded-full border border-neutral-300 shrink-0"
                style={{ backgroundColor: colorToCss(color) }}
              />
            ))}
          </div>
        )}

        {(product.hasSizeOptions && product.sizes && product.sizes.length > 0) && (
          <div className="flex items-center gap-1 flex-wrap">
            {product.sizes.slice(0, 6).map((size, idx) => (
              <span
                key={idx}
                className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded border border-neutral-200 bg-neutral-50 text-neutral-600 font-medium"
              >
                {size}
              </span>
            ))}
          </div>
        )}

        <div className="pt-0.5 mt-auto">
          <Button
            size="sm"
            onClick={handleAddToCart}
            disabled={isOos || justAdded}
            className={`w-full h-7 sm:h-8 text-[11px] sm:text-xs font-semibold gap-1.5 hover:scale-[1.02] active:scale-95 transition-all ${justAdded ? "bg-green-600 hover:bg-green-600" : "bg-accent hover:bg-accent/90"} text-white`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            {isOos ? "Out of stock" : justAdded ? "Added to cart" : "Add to cart"}
          </Button>
        </div>
      </div>
    </Card>
  )
}
