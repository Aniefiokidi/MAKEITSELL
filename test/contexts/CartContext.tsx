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
  
}

interface CartContextType {
  items: CartItem[]
  totalItems: number
  totalPrice: number
  addItem: (item: Omit<CartItem, "quantity">) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
   addToCart: (item: CartItem) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useAuth()

  const { getUserCart, setUserCart } = require("@/lib/firestore")

  // Load cart from localStorage or Firestore
  useEffect(() => {
    const loadCart = async () => {
      if (user) {
        // User logged in: load from Firestore, merge with localStorage if exists
        try {
          const cart = await getUserCart(user.uid)
          let firestoreItems: CartItem[] = []
          if (cart && Array.isArray(cart.items)) {
            firestoreItems = cart.items
          }

          // Check localStorage for anonymous cart
          const localCart = localStorage.getItem('anonymous_cart')
          let localItems: CartItem[] = []
          if (localCart) {
            try {
              localItems = JSON.parse(localCart)
            } catch (e) {
              console.error("Error parsing local cart:", e)
            }
          }

          // Merge: prefer Firestore, but add any unique items from local
          const mergedItems = [...firestoreItems]
          localItems.forEach(localItem => {
            const existing = mergedItems.find(item => item.productId === localItem.productId)
            if (!existing) {
              mergedItems.push(localItem)
            }
          })

          setItems(mergedItems)

          // Save merged cart to Firestore and clear localStorage
          if (mergedItems.length > 0) {
            await setUserCart(user.uid, mergedItems)
          }
          localStorage.removeItem('anonymous_cart')
        } catch (error) {
          console.error("Error loading cart from Firestore:", error)
          setItems([])
        }
      } else {
        // No user: load from localStorage
        const localCart = localStorage.getItem('anonymous_cart')
        if (localCart) {
          try {
            const localItems = JSON.parse(localCart)
            setItems(localItems)
          } catch (e) {
            console.error("Error parsing local cart:", e)
            setItems([])
          }
        } else {
          setItems([])
        }
      }
    }
    loadCart()
  }, [user])

  // Save cart whenever items change
  useEffect(() => {
    const saveCart = async () => {
      if (user) {
        // Save to Firestore
        try {
          await setUserCart(user.uid, items)
        } catch (error) {
          console.error("Error saving cart to Firestore:", error)
        }
      } else {
        // Save to localStorage
        try {
          localStorage.setItem('anonymous_cart', JSON.stringify(items))
        } catch (error) {
          console.error("Error saving cart to localStorage:", error)
        }
      }
    }
    saveCart()
  }, [items, user])

  const addItem = (newItem: Omit<CartItem, "quantity">) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.productId === newItem.productId)

      if (existingItem) {
        // Update quantity if item already exists
        return prevItems.map((item) =>
          item.productId === newItem.productId
            ? { ...item, quantity: Math.min(item.quantity + 1, item.maxStock) }
            : item,
        )
      } else {
        // Add new item
        return [...prevItems, { ...newItem, quantity: 1 }]
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

  const clearCart = () => {
    setItems([])
    if (user) {
      setUserCart(user.uid, [])
    }
  }

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // Implement addToCart function
  const addToCart = (item: CartItem) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((i) => i.productId === item.productId)
      if (existingItem) {
        return prevItems.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.maxStock) }
            : i,
        )
      } else {
        return [...prevItems, { ...item, quantity: Math.min(item.quantity, item.maxStock) }]
      }
    })
  }

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        totalPrice,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isOpen,
        setIsOpen,
        addToCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}
