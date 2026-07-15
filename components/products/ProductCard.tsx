"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Heart } from "lucide-react"
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
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop"

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount)

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
      className={`border-0 shadow-md overflow-hidden relative h-[280px] sm:h-[350px] md:h-[380px] lg:h-[450px] hover:shadow-xl transition-all duration-500 hover:-translate-y-2 rounded-2xl sm:rounded-3xl active:scale-95 md:active:scale-100 group card-lift cursor-pointer ${className}`}
      onClick={() => onOpen?.(product)}
    >
      <div className="absolute inset-0 overflow-hidden">
        <ImageCycler product={product} contain={contain} />

        {isOos && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div className="bg-red-600 text-white px-4 sm:px-8 py-1 sm:py-2 transform -rotate-45 font-bold text-xs sm:text-sm shadow-lg">
              OUT OF STOCK
            </div>
          </div>
        )}

        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1 z-10">
          {product.featured && (
            <Badge className="bg-yellow-500 text-black font-semibold text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
              <svg className="inline w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 fill-current animate-pulse mr-0.5 sm:mr-1" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z" />
              </svg>
              Featured
            </Badge>
          )}
          {suggested && (
            <Badge className="bg-blue-500 text-white font-semibold text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
              Suggested
            </Badge>
          )}
          {isLowStock && (
            <Badge variant="destructive" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
              Only {product.stock} left
            </Badge>
          )}
          {isOos && (
            <Badge variant="secondary" className="bg-gray-600 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
              Out of Stock
            </Badge>
          )}
        </div>

        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          <Button
            size="sm"
            variant="outline"
            className="bg-white/90 backdrop-blur-sm hover:bg-white hover:scale-110 active:scale-95 transition-all h-8 w-8 p-0 sm:h-9 sm:w-9"
            onClick={handleWishlistToggle}
          >
            <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${inWishlist ? "fill-red-500 text-red-500" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-2.5 md:p-3 backdrop-blur-xl bg-accent/10 border-t border-white/30 rounded-t-2xl sm:rounded-t-3xl z-30 space-y-1">
        <Badge
          variant="outline"
          className="inline-flex w-full text-[10px] sm:text-xs md:text-sm font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 shadow min-h-5 sm:min-h-6 items-center justify-center text-center leading-tight bg-accent text-white"
          style={{ whiteSpace: "normal", wordBreak: "break-word", hyphens: "auto", lineHeight: "1.2" }}
        >
          <span className="line-clamp-2 sm:line-clamp-1">{title}</span>
        </Badge>

        {showVendor && vendorLabel && (
          <p className="text-[10px] sm:text-xs text-white font-medium drop-shadow line-clamp-1">{vendorLabel}</p>
        )}

        <div className="flex items-center justify-between gap-1 sm:gap-2">
          <Badge
            variant="outline"
            className={`${(product.category || "").length > 12 ? "text-[8px] sm:text-[9px] md:text-[10px]" : "text-[9px] sm:text-[10px] md:text-xs"} backdrop-blur-sm border-white/50 px-1 sm:px-1.5 py-0 max-w-[58%] min-w-0 whitespace-nowrap overflow-hidden text-ellipsis text-white bg-accent`}
          >
            <span className="block max-w-full whitespace-nowrap overflow-hidden text-ellipsis">
              {product.category || "General"}
            </span>
          </Badge>
          <Badge
            variant="outline"
            className="text-[9px] sm:text-[10px] md:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 backdrop-blur-sm bg-white/70 text-accent whitespace-nowrap"
          >
            {formatCurrency(Number(product.price || 0))}
          </Badge>
        </div>

        {product.hasSizeOptions && product.sizes && product.sizes.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {product.sizes.slice(0, 5).map((size, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="text-[8px] sm:text-[9px] md:text-[10px] px-1 sm:px-1.5 py-0 border-white/40 bg-white/60 text-accent"
              >
                {size}
              </Badge>
            ))}
          </div>
        )}

        <Button
          size="sm"
          onClick={handleAddToCart}
          disabled={isOos || justAdded}
          className={`w-full h-6 sm:h-7 md:h-8 text-[10px] sm:text-xs md:text-xs backdrop-blur-sm hover:scale-105 active:scale-95 transition-all hover:shadow-lg flex items-center justify-center gap-0 bg-white/50 hover:bg-white text-black ${justAdded ? "bg-green-100 text-green-800 border-green-300" : ""}`}
        >
          <img src="/images/logo3.png" alt="" className="w-6 sm:w-7 md:w-8 h-6 sm:h-7 md:h-8 -mt-1 sm:-mt-2" />
          <span className="leading-none text-accent">{justAdded ? "Added to cart" : "Add to cart"}</span>
        </Button>
      </div>
    </Card>
  )
}
