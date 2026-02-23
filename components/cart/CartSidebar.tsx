"use client"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCart } from "@/contexts/CartContext"
import React, { useEffect, useState } from "react"
import { ShoppingCart, Plus, Minus, Trash2, ShoppingBag } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function CartSidebar() {
  const { items, totalItems, totalPrice, updateQuantity, removeItem, isOpen, setIsOpen } = useCart()
  const [storeNames, setStoreNames] = useState<{ [vendorId: string]: string }>({})
  // Debug: Log cart items and storeNames mapping
  useEffect(() => {
    if (items.length > 0) {
      console.log('[CartSidebar] Cart items:', items);
      console.log('[CartSidebar] Store names mapping:', storeNames);
    }
  }, [items, storeNames]);

  useEffect(() => {
    const fetchStoreNames = async () => {
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
    }
    if (items.length > 0) fetchStoreNames()
  }, [items])

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ShoppingCart className="h-5 w-5" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent text-xs text-accent-foreground flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Shopping Cart ({totalItems})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
            <p className="text-muted-foreground mb-4">Add some products to get started</p>
            <Button asChild onClick={() => setIsOpen(false)}>
              <Link href="/stores">Continue Shopping</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 -mx-6 px-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4 py-4">
                {items.map((item, index) => (
                  <div key={item.productId} className="flex items-center space-x-4 animate-slide-in-left" style={{ animationDelay: `${index * 0.05}s` }}>
                    <div className="relative h-16 w-16 rounded-md overflow-hidden bg-muted">
                      <Image src={item.image || "/placeholder.svg"} alt={item.title} fill className="object-cover hover:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <h4 className="text-sm font-medium line-clamp-2">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">by {storeNames[item.vendorId] || item.vendorName}</p>
                      <p className="text-sm font-semibold">₦{item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 bg-transparent"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 bg-transparent"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          disabled={item.quantity >= item.maxStock}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeItem(item.productId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Total</span>
                <span>₦{totalPrice.toFixed(2)}</span>
              </div>
              <div className="space-y-2">
                <Button asChild className="w-full" onClick={() => setIsOpen(false)}>
                  <Link href="/checkout">Proceed to Checkout</Link>
                </Button>
                <Button variant="outline" asChild className="w-full bg-transparent" onClick={() => setIsOpen(false)}>
                  <Link href="/cart">View Cart</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
