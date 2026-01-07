// Client-side database operations - API wrapper for MongoDB
// This file provides the same interface as firestore.ts but uses API routes

// Store operations
export const getStores = async (filters?: {
  category?: string
  isOpen?: boolean
  limitCount?: number
}) => {
  try {
    const params = new URLSearchParams()
    if (filters?.category) params.append('category', filters.category)
    if (filters?.isOpen !== undefined) params.append('isOpen', filters.isOpen.toString())
    if (filters?.limitCount) params.append('limit', filters.limitCount.toString())

    const response = await fetch(`/api/database/stores?${params}`)
    const result = await response.json()
    
    if (result.success) {
      return result.data
    } else {
      console.error('API error:', result.error)
      return []
    }
  } catch (error) {
    console.error('Network error:', error)
    return []
  }
}

// Service operations
export const getServices = async (filters?: {
  category?: string
  providerId?: string
  featured?: boolean
  locationType?: string
  limitCount?: number
}) => {
  try {
    const params = new URLSearchParams()
    if (filters?.category) params.append('category', filters.category)
    if (filters?.providerId) params.append('providerId', filters.providerId)
    if (filters?.featured !== undefined) params.append('featured', filters.featured.toString())
    if (filters?.locationType) params.append('locationType', filters.locationType)
    if (filters?.limitCount) params.append('limit', filters.limitCount.toString())

    const response = await fetch(`/api/database/services?${params}`)
    const result = await response.json()
    
    if (result.success) {
      return result.data
    } else {
      console.error('API error:', result.error)
      return []
    }
  } catch (error) {
    console.error('Network error:', error)
    return []
  }
}

// Product operations
export const getProducts = async (filters?: {
  category?: string
  vendorId?: string
  featured?: boolean
  limitCount?: number
}) => {
  try {
    const params = new URLSearchParams()
    
    if (filters?.category) params.append('category', filters.category)
    if (filters?.vendorId) params.append('vendorId', filters.vendorId)
    if (filters?.featured !== undefined) params.append('featured', filters.featured.toString())
    if (filters?.limitCount) params.append('limit', filters.limitCount.toString())

    const response = await fetch(`/api/database/products?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch products')
    }

    const result = await response.json()
    return result.success ? result.data : []
  } catch (error) {
    console.error('Error fetching products:', error)
    return []
  }
}

// Create operations (would need authentication)
export const createStore = async (storeData: any) => {
  try {
    const response = await fetch('/api/database/stores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(storeData),
    })
    
    const result = await response.json()
    
    if (result.success) {
      return result.id
    } else {
      throw new Error(result.error || 'Failed to create store')
    }
  } catch (error) {
    console.error('Create store error:', error)
    throw error
  }
}

export const createService = async (serviceData: any) => {
  try {
    const response = await fetch('/api/database/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serviceData),
    })
    
    const result = await response.json()
    
    if (result.success) {
      return result.id
    } else {
      throw new Error(result.error || 'Failed to create service')
    }
  } catch (error) {
    console.error('Create service error:', error)
    throw error
  }
}

export const createProduct = async (productData: any) => {
  // Placeholder for product creation
  console.log('createProduct called with:', productData)
  return 'temp-id'
}

// Type definitions for backward compatibility
export interface Store {
  id: string
  vendorId: string
  storeName: string
  storeDescription: string
  storeImage: string
  storeBanner?: string
  bannerImages?: string[]
  category: string
  rating: number
  reviewCount: number
  isOpen: boolean
  deliveryTime: string
  deliveryFee: number
  minimumOrder: number
  address: string
  phone?: string
  email?: string
  createdAt: any
  updatedAt: any
}

export interface Service {
  id?: string
  providerId: string
  providerName: string
  providerImage?: string
  title: string
  description: string
  category: string
  subcategory?: string
  price: number
  pricingType: "fixed" | "hourly" | "per-session" | "custom"
  duration?: number
  images: string[]
  location: string
  locationType: "online" | "in-person" | "both"
  availability: {
    monday?: { start: string; end: string; available: boolean }
    tuesday?: { start: string; end: string; available: boolean }
    wednesday?: { start: string; end: string; available: boolean }
    thursday?: { start: string; end: string; available: boolean }
    friday?: { start: string; end: string; available: boolean }
    saturday?: { start: string; end: string; available: boolean }
    sunday?: { start: string; end: string; available: boolean }
  }
  rating: number
  reviewCount: number
  featured: boolean
  status: "active" | "inactive" | "paused"
  tags: string[]
  createdAt: any
  updatedAt: any
}

export interface Product {
  id?: string
  title: string
  description: string
  price: number
  category: string
  images: string[]
  vendorId: string
  vendorName: string
  stock: number
  sku?: string
  featured: boolean
  status: "active" | "inactive" | "out_of_stock"
  createdAt: any
  updatedAt: any
}

// Order operations
export const getOrders = async (vendorId?: string) => {
  try {
    const params = new URLSearchParams()
    if (vendorId) params.append('vendorId', vendorId)

    const response = await fetch(`/api/database/orders?${params}`)
    const result = await response.json()
    
    if (result.success) {
      return result.data
    } else {
      console.error('API error:', result.error)
      return []
    }
  } catch (error) {
    console.error('Network error:', error)
    return []
  }
}
export const createOrder = async () => 'temp-id'
export const updateOrder = async () => {}
export const getSupportTickets = async () => []
export const createSupportTicket = async () => 'temp-id'
export const updateSupportTicket = async () => {}
export const createNotification = async () => 'temp-id'
export const getNotifications = async () => []
export const markNotificationAsRead = async () => {}
export const getUserCart = async (userId: string) => {
  try {
    const response = await fetch(`/api/database/carts/${userId}`)
    const result = await response.json()
    
    if (result.success) {
      return result.data
    } else {
      console.error('API error:', result.error)
      return null
    }
  } catch (error) {
    console.error('Network error:', error)
    return null
  }
}

export const setUserCart = async (userId: string, items: any[]) => {
  try {
    const response = await fetch(`/api/database/carts/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items })
    })
    
    const result = await response.json()
    
    if (!result.success) {
      console.error('API error:', result.error)
    }
    
    return result.success
  } catch (error) {
    console.error('Network error:', error)
    return false
  }
}
export const getConversations = async () => []
export const createConversation = async () => 'temp-id'
export const updateConversation = async () => {}
export const getChatMessages = async () => []
export const createChatMessage = async () => 'temp-id'
export const markMessagesAsRead = async () => {}
export const getBookings = async (providerId?: string) => {
  try {
    const params = new URLSearchParams()
    if (providerId) params.append('providerId', providerId)

    const response = await fetch(`/api/database/bookings?${params}`)
    const result = await response.json()
    
    if (result.success) {
      return result.data
    } else {
      console.error('API error:', result.error)
      return []
    }
  } catch (error) {
    console.error('Network error:', error)
    return []
  }
}
export const createBooking = async () => 'temp-id'
export const updateBooking = async () => {}
export const getVendorProducts = async (vendorId: string) => {
  try {
    const response = await fetch(`/api/database/products?vendorId=${vendorId}`)
    const result = await response.json()
    
    if (result.success) {
      return result.data
    } else {
      console.error('API error:', result.error)
      return []
    }
  } catch (error) {
    console.error('Network error:', error)
    return []
  }
}
export const getProductById = async () => null
export const updateProduct = async () => {}
export const deleteProduct = async () => {}
export const getStoreById = async () => null
export const updateStore = async () => {}
export const getServiceById = async () => null
export const updateService = async () => {}
export const deleteService = async () => {}
export const createDocument = async () => 'temp-id'
export const getDocument = async () => null
export const updateDocument = async () => {}
export const deleteDocument = async () => {}