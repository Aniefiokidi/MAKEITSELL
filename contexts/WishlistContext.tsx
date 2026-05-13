"use client"

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

export interface WishlistItem {
  productId: string
  title: string
  price: number
  image: string
  vendorId: string
  category?: string
}

interface WishlistContextType {
  items: WishlistItem[]
  isInWishlist: (productId: string) => boolean
  toggle: (item: WishlistItem) => Promise<void>
}

const WishlistContext = createContext<WishlistContextType>({
  items: [],
  isInWishlist: () => false,
  toggle: async () => {},
})

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<WishlistItem[]>([])

  // Load wishlist on mount / user change
  useEffect(() => {
    if (!user) {
      try {
        const stored = localStorage.getItem('mis_wishlist')
        if (stored) setItems(JSON.parse(stored))
      } catch {}
      return
    }
    fetch('/api/user/wishlist', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.items)) setItems(data.items) })
      .catch(() => {})
  }, [user?.uid])

  const isInWishlist = useCallback(
    (productId: string) => items.some(i => i.productId === productId),
    [items]
  )

  const toggle = useCallback(async (item: WishlistItem) => {
    const inList = items.some(i => i.productId === item.productId)

    if (!user) {
      const updated = inList
        ? items.filter(i => i.productId !== item.productId)
        : [item, ...items]
      setItems(updated)
      try { localStorage.setItem('mis_wishlist', JSON.stringify(updated)) } catch {}
      return
    }

    // Optimistic update
    setItems(prev =>
      inList ? prev.filter(i => i.productId !== item.productId) : [item, ...prev]
    )

    try {
      if (inList) {
        await fetch(`/api/user/wishlist?productId=${encodeURIComponent(item.productId)}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      } else {
        await fetch('/api/user/wishlist', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        })
      }
    } catch {
      // Revert on error
      setItems(prev =>
        inList ? [item, ...prev] : prev.filter(i => i.productId !== item.productId)
      )
    }
  }, [items, user])

  return (
    <WishlistContext.Provider value={{ items, isInWishlist, toggle }}>
      {children}
    </WishlistContext.Provider>
  )
}

export const useWishlist = () => useContext(WishlistContext)
