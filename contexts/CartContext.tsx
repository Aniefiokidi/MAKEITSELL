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
  const [mounted, setMounted] = useState(false)
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useAuth()

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  const { getUserCart, setUserCart } = require("@/lib/database-client")

  // Load cart from localStorage or MongoDB
  useEffect(() => {
    const loadCart = async () => {
      if (user) {
        // User logged in: load from MongoDB, merge with localStorage if exists
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

          // Merge: prefer MongoDB data, but add any unique items from local
          const mergedItems = [...firestoreItems]
          localItems.forEach(localItem => {
            const existing = mergedItems.find(item => item.productId === localItem.productId)
            if (!existing) {
              mergedItems.push(localItem)
            }
          })

          setItems(mergedItems)

          // Save merged cart to MongoDB and clear localStorage
          if (mergedItems.length > 0) {
            await setUserCart(user.uid, mergedItems)
          }
          localStorage.removeItem('anonymous_cart')
        } catch (error) {
          console.error("Error loading cart from MongoDB:", error)
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
        // Save to Firestore - sanitize data to remove undefined values
        try {
          const sanitizedItems = items.map(item => {
            // Remove any undefined values
            const sanitized: CartItem = {
              id: item.id || item.productId,
              productId: item.productId,
              title: item.title || '',
              price: typeof item.price === 'number' ? item.price : 0,
              quantity: typeof item.quantity === 'number' ? item.quantity : 1,
              image: item.image || '',
              vendorId: item.vendorId || '',
              vendorName: item.vendorName || '',
              maxStock: typeof item.maxStock === 'number' ? item.maxStock : 100
            }
            return sanitized
          }).filter(item => item.productId) // Remove items without productId
          
          await setUserCart(user.uid, sanitizedItems)
        } catch (error) {
          console.error("Error saving cart to MongoDB:", error)
        }
      } else {
        // Save to localStorage
        try {
          const sanitizedItems = items.filter(item => item.productId) // Remove invalid items
          localStorage.setItem('anonymous_cart', JSON.stringify(sanitizedItems))
        } catch (error) {
          console.error("Error saving cart to localStorage:", error)
        }
      }
    }
    saveCart()
  }, [items, user])

  const addItem = (newItem: Omit<CartItem, "quantity">) => {
    // Sanitize the new item
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
    
    // Don't add if essential fields are missing
    if (!sanitizedItem.productId || !sanitizedItem.title) {
      console.error("Invalid cart item - missing required fields:", newItem)
      return
    }
    
    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.productId === sanitizedItem.productId)

      if (existingItem) {
        // Update quantity if item already exists
        return prevItems.map((item) =>
          item.productId === sanitizedItem.productId
            ? { ...item, quantity: Math.min(item.quantity + 1, item.maxStock) }
            : item,
        )
      } else {
        // Add new item
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

  const clearCart = () => {
    setItems([])
    if (user) {
      // Ensure we pass an empty array, not undefined
      setUserCart(user.uid, []).catch(error => {
        console.error("Error clearing cart in MongoDB:", error)
      })
    }
  }

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // Implement addToCart function
  const addToCart = (item: CartItem) => {
    // Check if item is valid object
    if (!item || typeof item !== 'object' || Object.keys(item).length === 0) {
      console.error("Invalid cart item - empty or null object:", item)
      return
    }
    
    // Sanitize item before adding to cart
    const sanitizedItem: CartItem = {
      id: item.id || item.productId,
      productId: item.productId,
      title: item.title || '',
      price: typeof item.price === 'number' ? item.price : 0,
      quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
      image: item.image || '',
      vendorId: item.vendorId || '',
      vendorName: item.vendorName || '',
      maxStock: typeof item.maxStock === 'number' ? item.maxStock : 100
    }
    
    // Don't add if essential fields are missing
    if (!sanitizedItem.productId || !sanitizedItem.title) {
      console.error("Invalid cart item - missing required fields. Original item:", item, "Sanitized item:", sanitizedItem)
      return
    }
    
    setItems((prevItems) => {
      const existingItem = prevItems.find((i) => i.productId === sanitizedItem.productId)
      if (existingItem) {
        return prevItems.map((i) =>
          i.productId === sanitizedItem.productId
            ? { ...i, quantity: Math.min(i.quantity + sanitizedItem.quantity, i.maxStock) }
            : i,
        )
      } else {
        return [...prevItems, { ...sanitizedItem, quantity: Math.min(sanitizedItem.quantity, sanitizedItem.maxStock) }]
      }
    })
  }

  // Handle hydration mismatch  
  if (!mounted) {
    return (
      <CartContext.Provider
        value={{
          items: [],
          totalItems: 0,
          totalPrice: 0,
          addItem: () => {},
          removeItem: () => {},
          updateQuantity: () => {},
          clearCart: () => {},
          isOpen: false,
          setIsOpen: () => {},
          addToCart: () => {},
        }}
      >
        {children}
      </CartContext.Provider>
    )
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
