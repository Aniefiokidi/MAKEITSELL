"use client"

import { useCart } from "@/contexts/CartContext"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ShoppingCart, Plus, Minus, Trash2, ArrowLeft, Loader2, ShoppingBag } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import Header from "@/components/Header"
import { useState, useEffect, useCallback } from "react"

export default function CartPage() {
  const { items, totalItems, totalPrice, updateQuantity, removeItem } = useCart()
  const [isLoading, setIsLoading] = useState(true)
  const [storeNames, setStoreNames] = useState<{ [vendorId: string]: string }>({})

  const fetchStoreNames = useCallback(async () => {
    const vendorIds = Array.from(new Set(items.map(item => item.vendorId).filter(Boolean)))
    const names: { [vendorId: string]: string } = {}
    await Promise.all(
      vendorIds.map(async (vendorId) => {
        try {
          const res = await fetch(`/api/database/stores?vendorId=${vendorId}`)
          const json = await res.json()
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            names[vendorId] = json.data[0].storeName || json.data[0].name || "Store"
          } else {
            names[vendorId] = "Store"
          }
        } catch {
          names[vendorId] = "Store"
        }
      })
    )
    setStoreNames(names)
  }, [items])

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (items.length > 0) fetchStoreNames()
  }, [items, fetchStoreNames])

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-10 w-10 text-accent mx-auto animate-spin" />
            <p className="text-muted-foreground text-sm">Loading your cart…</p>
          </div>
        </main>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-5 max-w-sm">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <ShoppingBag className="h-9 w-9 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Your cart is empty</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Add items from your favourite stores to get started.
              </p>
            </div>
            <Button asChild size="lg" className="w-full">
              <Link href="/stores">Browse Stores</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const subtotal = totalPrice
  const tax = subtotal * 0.08
  const total = subtotal + tax

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 sm:py-10">

        {/* Page title */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/stores"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">Shopping Cart</h1>
            <p className="text-xs text-muted-foreground">{totalItems} {totalItems === 1 ? 'item' : 'items'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Cart items ── */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
                <div className="p-4">
                  <div className="flex gap-3">
                    {/* Product image */}
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-muted">
                      <Image
                        src={item.image || "/placeholder.svg"}
                        alt={item.title}
                        fill
                        className="object-cover"
                      />
                    </div>

                    {/* Name + store + price */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <h3 className="font-semibold text-sm sm:text-base leading-snug line-clamp-2">{item.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {storeNames[item.vendorId] || item.vendorName || 'Store'}
                        </p>
                      </div>
                      <p className="text-accent font-bold text-sm sm:text-base mt-1">
                        ₦{item.price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Qty + line total + remove */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
                    {/* Quantity stepper */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:border-accent hover:text-accent transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-7 text-center font-bold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        disabled={item.quantity >= item.maxStock}
                        className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Line total + remove */}
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm sm:text-base">
                        ₦{(item.price * item.quantity).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-destructive hover:bg-destructive hover:text-white transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.quantity >= item.maxStock && (
                    <p className="text-xs text-destructive mt-2">Maximum quantity reached</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Order summary ── */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-5 lg:sticky lg:top-24">
              <h2 className="font-bold text-base mb-4">Order Summary</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'})</span>
                  <span className="font-medium">₦{subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-muted-foreground">TBD</span>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">Rider will confirm delivery cost</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (8%)</span>
                  <span className="font-medium">₦{tax.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between font-bold text-base mb-5">
                <span>Total</span>
                <span className="text-accent">₦{total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
              </div>

              {(items.some(item => (item.vendorName || '').toLowerCase().includes('munch')) ||
                Object.values(storeNames).some((name: any) => String(name || '').toLowerCase().includes('munch'))) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 mb-4">
                  <span className="font-semibold">Note:</span> Munch typically takes <span className="font-semibold">3–4 hours</span> to prepare orders. Please plan your delivery time accordingly.
                </div>
              )}

              <Button asChild className="w-full bg-accent hover:bg-accent/90 text-white" size="lg">
                <Link href="/checkout">Proceed to Checkout</Link>
              </Button>
              <Button variant="outline" asChild className="w-full mt-2 border-accent/40 text-accent hover:bg-accent/10">
                <Link href="/stores">Continue Shopping</Link>
              </Button>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
