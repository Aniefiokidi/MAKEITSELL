"use client"
import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "./AuthContext"

export interface CartItem {
  id: string
  productId: string
  title: string
  price: number
  quantity: number
  image: string
  vendorId: string
  vendorName: string
  maxStock: number
  category?: string
}


interface CartContextType {
  items: CartItem[]
  totalItems: number
  totalPrice: number
  addItem: (item: Omit<CartItem, "quantity"> & { title: string }) => void // Ensure title is present
  addToCart: (item: Omit<CartItem, "quantity"> & { title: string }) => void // Alias for legacy usage
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => Promise<void>
  removeItems: (productIds: string[]) => Promise<void>
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  // Selective checkout — which cart items are checked to buy right now (Shein-style
  // "leave the rest for later"). Pure client state, not persisted server-side: it resets
  // to "everything selected" on a fresh load, which is exactly what totalPrice already
  // means today, so nothing changes for anyone who never touches a checkbox.
  selectedProductIds: Set<string>
  toggleSelected: (productId: string) => void
  selectAll: () => void
  deselectAll: () => void
  selectedItems: CartItem[]
  selectedTotalItems: number
  selectedTotalPrice: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false)
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const { user } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-select any newly-seen item (a fresh cart load, or something just added) without
  // touching ids the user already unchecked earlier in this session.
  useEffect(() => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const item of items) {
        if (!next.has(item.productId)) {
          next.add(item.productId)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [items])

  const { getUserCart, setUserCart } = require("@/lib/database-client")

  useEffect(() => {
    const loadCart = async () => {
      if (user && user.uid) {
        try {
          const cart = await getUserCart(user.uid)
          let dbItems: CartItem[] = []
          if (cart && Array.isArray(cart.items)) {
            dbItems = cart.items
          }
          const localCart = localStorage.getItem('anonymous_cart')
          let localItems: CartItem[] = []
          if (localCart) {
            try {
              localItems = JSON.parse(localCart)
            } catch (e) {
              localItems = []
            }
          }
          const mergedItems = [...dbItems]
          localItems.forEach(localItem => {
            const existing = mergedItems.find(item => item.productId === localItem.productId)
            if (!existing) {
              mergedItems.push(localItem)
            }
          })
          setItems(mergedItems)
          if (mergedItems.length > 0 && user && user.uid) {
            await setUserCart(user.uid, mergedItems)
          }
          localStorage.removeItem('anonymous_cart')
        } catch (error) {
          setItems([])
        }
      } else {
        const localCart = localStorage.getItem('anonymous_cart')
        if (localCart) {
          try {
            const localItems = JSON.parse(localCart)
            setItems(localItems)
          } catch (e) {
            setItems([])
          }
        } else {
          setItems([])
        }
      }
    }
    loadCart()
  }, [user])

  useEffect(() => {
    const saveCart = async () => {
      if (user && user.uid) {
        try {
          const sanitizedItems = items.map(item => ({
            id: item.id || item.productId,
            productId: item.productId,
            title: item.title || '',
            price: typeof item.price === 'number' ? item.price : 0,
            quantity: typeof item.quantity === 'number' ? item.quantity : 1,
            image: item.image || '',
            vendorId: item.vendorId || '',
            vendorName: item.vendorName || '',
            maxStock: typeof item.maxStock === 'number' ? item.maxStock : 100
          })).filter(item => item.productId)
          await setUserCart(user.uid, sanitizedItems)
        } catch (error) {}
      } else {
        try {
          const sanitizedItems = items.filter(item => item.productId)
          localStorage.setItem('anonymous_cart', JSON.stringify(sanitizedItems))
        } catch (error) {}
      }
    }
    saveCart()
  }, [items, user])

  const addItem = (newItem: Omit<CartItem, "quantity"> & { title: string }) => {
    const sanitizedItem = {
      id: newItem.id || newItem.productId,
      productId: newItem.productId,
      title: newItem.title || '',
      price: typeof newItem.price === 'number' ? newItem.price : 0,
      image: newItem.image || '',
      vendorId: newItem.vendorId || '',
      vendorName: newItem.vendorName || '',
      maxStock: typeof newItem.maxStock === 'number' ? newItem.maxStock : 100
    }
    if (!sanitizedItem.productId || !sanitizedItem.title) {
      return
    }
    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.productId === sanitizedItem.productId)
      if (existingItem) {
        return prevItems.map((item) =>
          item.productId === sanitizedItem.productId
            ? { ...item, quantity: Math.min(item.quantity + 1, item.maxStock) }
            : item,
        )
      } else {
        return [...prevItems, { ...sanitizedItem, quantity: 1 }]
      }
    })
  }

  const removeItem = (productId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.productId !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId)
      return
    }
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.productId === productId ? { ...item, quantity: Math.min(quantity, item.maxStock) } : item,
      ),
    )
  }

  const clearCart = async () => {
    console.log('clearCart called, current items:', items)
    setItems([])
    
    // Clear persistent storage as well
    try {
      // Clear localStorage for anonymous users
      localStorage.removeItem('anonymous_cart')
      
      // Clear database cart for logged-in users
      if (user && user.uid) {
        const { setUserCart } = require('@/lib/database-client')
        await setUserCart(user.uid, [])
      }
      console.log('Cart items cleared from all storage')
    } catch (error) {
      console.error('Error clearing persistent cart storage:', error)
      // Still clear local state even if persistent storage fails
      console.log('Local cart state cleared despite storage error')
    }
  }

  // Removes just the given items (e.g. the ones just purchased in a selective checkout)
  // rather than wiping the whole cart — mirrors clearCart's persistence path, just
  // filtered instead of emptied. clearCart itself is untouched, still used wherever a
  // full wipe is actually wanted.
  const removeItems = async (productIds: string[]) => {
    const idsToRemove = new Set(productIds)
    setItems((prevItems) => prevItems.filter((item) => !idsToRemove.has(item.productId)))
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      idsToRemove.forEach((id) => next.delete(id))
      return next
    })
    // No separate persistence call needed here — the items-changed effect above already
    // re-saves to localStorage/the server cart whenever `items` changes.
  }

  const toggleSelected = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedProductIds(new Set(items.map((item) => item.productId)))
  }

  const deselectAll = () => {
    setSelectedProductIds(new Set())
  }

  const selectedItems = items.filter((item) => selectedProductIds.has(item.productId))
  const selectedTotalItems = selectedItems.reduce((sum, item) => sum + item.quantity, 0)
  const selectedTotalPrice = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0)


  return (
    <CartContext.Provider
      value={{
        items: mounted ? items : [],
        totalItems: mounted ? totalItems : 0,
        totalPrice: mounted ? totalPrice : 0,
        addItem: mounted ? addItem : () => {},
        addToCart: mounted ? addItem : () => {},
        removeItem: mounted ? removeItem : () => {},
        updateQuantity: mounted ? updateQuantity : () => {},
        clearCart: mounted ? clearCart : async () => {},
        removeItems: mounted ? removeItems : async () => {},
        isOpen: mounted ? isOpen : false,
        setIsOpen: mounted ? setIsOpen : () => {},
        selectedProductIds: mounted ? selectedProductIds : new Set(),
        toggleSelected: mounted ? toggleSelected : () => {},
        selectAll: mounted ? selectAll : () => {},
        deselectAll: mounted ? deselectAll : () => {},
        selectedItems: mounted ? selectedItems : [],
        selectedTotalItems: mounted ? selectedTotalItems : 0,
        selectedTotalPrice: mounted ? selectedTotalPrice : 0,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export default CartProvider;
