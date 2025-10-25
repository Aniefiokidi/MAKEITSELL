// Create product in Firestore
// Get orders with filters
export const getOrders = async (filters?: {
  vendorId?: string
  customerId?: string
  status?: string
  limitCount?: number
}) => {
  try {
    const db = getDbInstance()
    let q = query(collection(db, "orders"))

    if (filters?.vendorId) {
      q = query(q, where("vendorId", "==", filters.vendorId))
    }
    if (filters?.customerId) {
      q = query(q, where("customerId", "==", filters.customerId))
    }
    if (filters?.status) {
      q = query(q, where("status", "==", filters.status))
    }
    
    const snapshot = await getDocs(q)
    let orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[]
    
    // Sort in memory by createdAt
    orders.sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0
      const timeB = b.createdAt?.toMillis() || 0
      return timeB - timeA // Descending order (newest first)
    })
    
    // Apply limit if specified
    if (filters?.limitCount) {
      orders = orders.slice(0, filters.limitCount)
    }
    
    return orders
  } catch (error) {
    console.error("Error getting orders:", error)
    throw error
  }
}

export const createOrder = async (orderData: Omit<Order, "id" | "createdAt" | "updatedAt">) => {
  try {
    const db = getDbInstance()
    const docRef = await addDoc(collection(db, "orders"), {
      ...orderData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating order:", error)
    throw error
  }
}

export const updateOrder = async (orderId: string, orderData: Partial<Order>) => {
  try {
    const db = getDbInstance()
    const docRef = doc(db, "orders", orderId)
    await updateDoc(docRef, {
      ...orderData,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error("Error updating order:", error)
    throw error
  }
}

export const createNotification = async (notificationData: Omit<Notification, "id" | "createdAt">) => {
  try {
    const db = getDbInstance()
    const docRef = await addDoc(collection(db, "notifications"), {
      ...notificationData,
      createdAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating notification:", error)
    throw error
  }
}

export const getNotifications = async (userId: string, limitCount?: number) => {
  try {
    const db = getDbInstance()
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId)
    )
    
    const snapshot = await getDocs(q)
    let notifications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[]
    
    // Sort in memory by createdAt
    notifications.sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0
      const timeB = b.createdAt?.toMillis() || 0
      return timeB - timeA // Descending order (newest first)
    })
    
    // Apply limit if specified
    if (limitCount) {
      notifications = notifications.slice(0, limitCount)
    }
    
    return notifications
  } catch (error) {
    console.error("Error getting notifications:", error)
    throw error
  }
}

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const db = getDbInstance()
    const docRef = doc(db, "notifications", notificationId)
    await updateDoc(docRef, { read: true })
  } catch (error) {
    console.error("Error marking notification as read:", error)
    throw error
  }
}

export const createSupportTicket = async (ticketData: Omit<SupportTicket, "id" | "createdAt" | "updatedAt">) => {
  try {
    const db = getDbInstance()
    const docRef = await addDoc(collection(db, "supportTickets"), {
      ...ticketData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating support ticket:", error)
    throw error
  }
}

export const getSupportTickets = async (filters?: {
  customerId?: string
  vendorId?: string
  status?: string
  limitCount?: number
}) => {
  try {
    const db = getDbInstance()
    let q = query(collection(db, "supportTickets"))

    if (filters?.customerId) {
      q = query(q, where("customerId", "==", filters.customerId))
    }
    if (filters?.vendorId) {
      q = query(q, where("vendorId", "==", filters.vendorId))
    }
    if (filters?.status) {
      q = query(q, where("status", "==", filters.status))
    }

    const snapshot = await getDocs(q)
    let tickets = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[]
    
    // Sort in memory by createdAt
    tickets.sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0
      const timeB = b.createdAt?.toMillis() || 0
      return timeB - timeA // Descending order (newest first)
    })
    
    // Apply limit if specified
    if (filters?.limitCount) {
      tickets = tickets.slice(0, filters.limitCount)
    }
    
    return tickets
  } catch (error) {
    console.error("Error getting support tickets:", error)
    throw error
  }
}

export const updateSupportTicket = async (ticketId: string, ticketData: Partial<SupportTicket>) => {
  try {
    const db = getDbInstance()
    const docRef = doc(db, "supportTickets", ticketId)
    await updateDoc(docRef, {
      ...ticketData,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error("Error updating support ticket:", error)
    throw error
  }
}
import { getDbInstance } from "./firebase"
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore"

// Product interface
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
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Order interface
export interface Order {
  id?: string
  customerId: string
  vendorId: string
  products: {
    productId: string
    quantity: number
    price: number
  }[]
  totalAmount: number
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  shippingAddress: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Support Ticket interface
export interface SupportTicket {
  id?: string
  customerId: string
  orderId?: string
  vendorId?: string
  subject: string
  description: string
  status: "open" | "in-progress" | "resolved" | "closed"
  priority: "low" | "medium" | "high" | "urgent"
  assignedTo?: string
  messages: {
    senderId: string
    senderRole: "customer" | "vendor" | "csa" | "admin" | "ai"
    message: string
    timestamp: Timestamp
  }[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Notification interface
export interface Notification {
  id?: string
  userId: string
  type: "order" | "ticket" | "system"
  title: string
  message: string
  read: boolean
  relatedId?: string // orderId or ticketId
  createdAt: Timestamp
}
  export interface UserCart {
    userId: string
    items: any[]
    updatedAt: Timestamp
  }

  export const getUserCart = async (userId: string): Promise<UserCart | null> => {
    try {
      const db = getDbInstance()
      const docRef = doc(db, "carts", userId)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        return { userId, ...docSnap.data() } as UserCart
      } else {
        return null
      }
    } catch (error) {
      console.error("Error getting user cart:", error)
      throw error
    }
  }

  export const setUserCart = async (userId: string, items: any[]) => {
    try {
      const db = getDbInstance()
      const docRef = doc(db, "carts", userId)
      await updateDoc(docRef, {
        items,
        updatedAt: Timestamp.now(),
      })
    } catch (error) {
      // If cart doesn't exist, create it
      try {
        const db = getDbInstance()
        await setDoc(doc(db, "carts", userId), {
          items,
          updatedAt: Timestamp.now(),
        })
      } catch (err) {
        console.error("Error setting user cart:", err)
        throw err
      }
    }
  }

// Generic CRUD operations
export const createDocument = async (collectionName: string, data: any) => {
  try {
    const db = getDbInstance()
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating document:", error)
    throw error
  }
}

export const getDocument = async (collectionName: string, docId: string) => {
  try {
    const db = getDbInstance()
    const docRef = doc(db, collectionName, docId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() }
    } else {
      return null
    }
  } catch (error) {
    console.error("Error getting document:", error)
    throw error
  }
}

export const updateDocument = async (collectionName: string, docId: string, data: any) => {
  try {
    const db = getDbInstance()
    const docRef = doc(db, collectionName, docId)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error("Error updating document:", error)
    throw error
  }
}

export const deleteDocument = async (collectionName: string, docId: string) => {
  try {
    const db = getDbInstance()
    await deleteDoc(doc(db, collectionName, docId))
  } catch (error) {
    console.error("Error deleting document:", error)
    throw error
  }
}

// Get products with filters
export const getProducts = async (filters?: {
  category?: string
  vendorId?: string
  featured?: boolean
  limitCount?: number
}) => {
  try {
    const db = getDbInstance()
    let q = query(collection(db, "products"))

    if (filters?.category) {
      q = query(q, where("category", "==", filters.category))
    }

    if (filters?.vendorId) {
      q = query(q, where("vendorId", "==", filters.vendorId))
    }

    if (filters?.featured !== undefined) {
      q = query(q, where("featured", "==", filters.featured))
    }

    const querySnapshot = await getDocs(q)
    let products = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[]
    
    // Sort in memory by createdAt
    products.sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0
      const timeB = b.createdAt?.toMillis() || 0
      return timeB - timeA // Descending order (newest first)
    })
    
    // Apply limit if specified
    if (filters?.limitCount) {
      products = products.slice(0, filters.limitCount)
    }
    
    return products
  } catch (error) {
    console.error("Error getting products:", error)
    throw error
  }
}

export const createProduct = async (productData: Omit<Product, "id" | "createdAt" | "updatedAt">) => {
  try {
    const db = getDbInstance()
    const docRef = await addDoc(collection(db, "products"), {
      ...productData,
      status: productData.stock > 0 ? "active" : "out_of_stock",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating product:", error)
    throw error
  }
}

export const updateProduct = async (productId: string, productData: Partial<Product>) => {
  try {
    const db = getDbInstance()
    const docRef = doc(db, "products", productId)

    // Auto-update status based on stock
    if (productData.stock !== undefined) {
      productData.status = productData.stock > 0 ? "active" : "out_of_stock"
    }

    await updateDoc(docRef, {
      ...productData,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error("Error updating product:", error)
    throw error
  }
}

export const deleteProduct = async (productId: string) => {
  try {
    const db = getDbInstance()
    await deleteDoc(doc(db, "products", productId))
  } catch (error) {
    console.error("Error deleting product:", error)
    throw error
  }
}

export const getVendorProducts = async (vendorId: string) => {
  try {
    const db = getDbInstance()
    const q = query(collection(db, "products"), where("vendorId", "==", vendorId))

    const querySnapshot = await getDocs(q)
    const products = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[]
    
    // Sort in memory by createdAt
    return products.sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0
      const timeB = b.createdAt?.toMillis() || 0
      return timeB - timeA // Descending order (newest first)
    })
  } catch (error) {
    console.error("Error getting vendor products:", error)
    throw error
  }
}

export const getProductById = async (id: string) => {
  try {
    const db = getDbInstance();
    const docRef = doc(db, "products", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      throw new Error("Product not found");
    }
  } catch (error) {
    console.error("Error getting product by id:", error);
    throw error;
  }
}

// Store/Vendor related functions
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

export const getStores = async (filters?: {
  category?: string
  isOpen?: boolean
  limitCount?: number
}) => {
  try {
    const db = getDbInstance()
    let q = query(collection(db, "stores"))

    if (filters?.category && filters.category !== "all") {
      q = query(q, where("category", "==", filters.category))
    }
    if (filters?.isOpen !== undefined) {
      q = query(q, where("isOpen", "==", filters.isOpen))
    }

    const snapshot = await getDocs(q)
    let stores = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Store[]
    
    // Sort in memory by rating
    stores.sort((a, b) => {
      return (b.rating || 0) - (a.rating || 0) // Descending order (highest rating first)
    })
    
    // Apply limit if specified
    if (filters?.limitCount) {
      stores = stores.slice(0, filters.limitCount)
    }
    
    return stores
  } catch (error) {
    console.error("Error getting stores:", error)
    throw error
  }
}

export const getStoreById = async (storeId: string) => {
  try {
    const db = getDbInstance()
    const docRef = doc(db, "stores", storeId)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Store
    } else {
      throw new Error("Store not found")
    }
  } catch (error) {
    console.error("Error getting store by id:", error)
    throw error
  }
}

export const createStore = async (storeData: Omit<Store, "id" | "createdAt" | "updatedAt">) => {
  console.log("Creating store for vendor:", storeData.vendorId)
  try {
    const db = getDbInstance()
    const docRef = await addDoc(collection(db, "stores"), {
      ...storeData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    console.log("Store created successfully:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("Error creating store:", error)
    throw error
  }
}

export const updateStore = async (storeId: string, storeData: Partial<Store>) => {
  try {
    const db = getDbInstance()
    const docRef = doc(db, "stores", storeId)
    await updateDoc(docRef, {
      ...storeData,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error("Error updating store:", error)
    throw error
  }
}

// Service interface
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
  duration?: number // in minutes
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
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Booking interface
export interface Booking {
  id?: string
  serviceId: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  providerId: string
  providerName: string
  serviceTitle: string
  bookingDate: Timestamp
  startTime: string
  endTime: string
  duration: number
  totalPrice: number
  status: "pending" | "confirmed" | "cancelled" | "completed" | "rescheduled"
  locationType: "online" | "in-person"
  location?: string
  notes?: string
  cancellationReason?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Chat Message interface
export interface ChatMessage {
  id?: string
  conversationId: string
  senderId: string
  senderName: string
  senderRole: "customer" | "provider"
  receiverId: string
  message: string
  images?: string[]
  read: boolean
  createdAt: Timestamp
}

// Conversation interface
export interface Conversation {
  id?: string
  customerId: string
  customerName: string
  providerId: string
  providerName: string
  storeId?: string
  storeName?: string
  storeImage?: string
  serviceId?: string
  lastMessage: string
  lastMessageTime: Timestamp
  unreadCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Service CRUD operations
export const getServices = async (filters?: {
  category?: string
  providerId?: string
  featured?: boolean
  locationType?: string
  limitCount?: number
}) => {
  try {
    const db = getDbInstance()
    let q = query(collection(db, "services"))

    if (filters?.category && filters.category !== "all") {
      q = query(q, where("category", "==", filters.category))
    }
    if (filters?.providerId) {
      q = query(q, where("providerId", "==", filters.providerId))
    }
    if (filters?.featured !== undefined) {
      q = query(q, where("featured", "==", filters.featured))
    }
    if (filters?.locationType) {
      q = query(q, where("locationType", "==", filters.locationType))
    }

    // Removed orderBy to avoid composite index requirement
    const snapshot = await getDocs(q)
    let services = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Service[]
    
    // Sort in memory by createdAt
    services.sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0
      const timeB = b.createdAt?.toMillis() || 0
      return timeB - timeA // Descending order (newest first)
    })
    
    // Apply limit if specified
    if (filters?.limitCount) {
      services = services.slice(0, filters.limitCount)
    }

    return services
  } catch (error) {
    console.error("Error getting services:", error)
    throw error
  }
}

export const getServiceById = async (id: string) => {
  try {
    const db = getDbInstance()
    const docRef = doc(db, "services", id)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Service
    } else {
      throw new Error("Service not found")
    }
  } catch (error) {
    console.error("Error getting service by id:", error)
    throw error
  }
}

export const createService = async (serviceData: Omit<Service, "id" | "createdAt" | "updatedAt">) => {
  try {
    const db = getDbInstance()
    const docRef = await addDoc(collection(db, "services"), {
      ...serviceData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating service:", error)
    throw error
  }
}

export const updateService = async (serviceId: string, serviceData: Partial<Service>) => {
  try {
    const db = getDbInstance()
    const docRef = doc(db, "services", serviceId)
    await updateDoc(docRef, {
      ...serviceData,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error("Error updating service:", error)
    throw error
  }
}

export const deleteService = async (serviceId: string) => {
  try {
    const db = getDbInstance()
    await deleteDoc(doc(db, "services", serviceId))
  } catch (error) {
    console.error("Error deleting service:", error)
    throw error
  }
}

// Booking CRUD operations
export const getBookings = async (filters?: {
  customerId?: string
  providerId?: string
  serviceId?: string
  status?: string
  limitCount?: number
}) => {
  try {
    const db = getDbInstance()
    let q = query(collection(db, "bookings"))

    if (filters?.customerId) {
      q = query(q, where("customerId", "==", filters.customerId))
    }
    if (filters?.providerId) {
      q = query(q, where("providerId", "==", filters.providerId))
    }
    if (filters?.serviceId) {
      q = query(q, where("serviceId", "==", filters.serviceId))
    }
    if (filters?.status) {
      q = query(q, where("status", "==", filters.status))
    }

    const snapshot = await getDocs(q)
    let bookings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Booking[]
    
    // Sort in memory by bookingDate
    bookings.sort((a, b) => {
      const timeA = a.bookingDate?.toMillis() || 0
      const timeB = b.bookingDate?.toMillis() || 0
      return timeB - timeA // Descending order (newest first)
    })
    
    // Apply limit if specified
    if (filters?.limitCount) {
      bookings = bookings.slice(0, filters.limitCount)
    }
    
    return bookings
  } catch (error) {
    console.error("Error getting bookings:", error)
    throw error
  }
}

export const createBooking = async (bookingData: Omit<Booking, "id" | "createdAt" | "updatedAt">) => {
  try {
    const db = getDbInstance()
    const docRef = await addDoc(collection(db, "bookings"), {
      ...bookingData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating booking:", error)
    throw error
  }
}

export const updateBooking = async (bookingId: string, bookingData: Partial<Booking>) => {
  try {
    const db = getDbInstance()
    const docRef = doc(db, "bookings", bookingId)
    await updateDoc(docRef, {
      ...bookingData,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error("Error updating booking:", error)
    throw error
  }
}

// Chat & Messaging operations
export const getConversations = async (userId: string, role: "customer" | "provider") => {
  try {
    const db = getDbInstance()
    const fieldName = role === "customer" ? "customerId" : "providerId"
    
    // Query without orderBy to avoid composite index requirement
    const q = query(
      collection(db, "conversations"),
      where(fieldName, "==", userId)
    )
    
    const snapshot = await getDocs(q)
    const conversations = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Conversation[]
    
    // Sort in memory instead of in query
    return conversations.sort((a, b) => {
      const timeA = a.lastMessageTime?.toMillis() || 0
      const timeB = b.lastMessageTime?.toMillis() || 0
      return timeB - timeA // Descending order (newest first)
    })
  } catch (error) {
    console.error("Error getting conversations:", error)
    throw error
  }
}

export const getMessages = async (conversationId: string, limitCount?: number) => {
  try {
    const db = getDbInstance()
    // Query without orderBy to avoid composite index requirement
    const q = query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId)
    )

    const snapshot = await getDocs(q)
    let messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ChatMessage[]
    
    // Sort in memory by createdAt
    messages.sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0
      const timeB = b.createdAt?.toMillis() || 0
      return timeA - timeB // Ascending order (oldest first)
    })
    
    // Apply limit if specified
    if (limitCount) {
      messages = messages.slice(0, limitCount)
    }
    
    return messages
  } catch (error) {
    console.error("Error getting messages:", error)
    throw error
  }
}

export const sendMessage = async (messageData: Omit<ChatMessage, "id" | "createdAt">) => {
  try {
    const db = getDbInstance()
    
    // Add message
    const docRef = await addDoc(collection(db, "messages"), {
      ...messageData,
      createdAt: Timestamp.now(),
    })
    
    // Update conversation
    const conversationRef = doc(db, "conversations", messageData.conversationId)
    await updateDoc(conversationRef, {
      lastMessage: messageData.message,
      lastMessageTime: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    
    return docRef.id
  } catch (error) {
    console.error("Error sending message:", error)
    throw error
  }
}

export const createConversation = async (conversationData: Omit<Conversation, "id" | "createdAt" | "updatedAt">) => {
  try {
    const db = getDbInstance()
    const docRef = await addDoc(collection(db, "conversations"), {
      ...conversationData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating conversation:", error)
    throw error
  }
}

export const markMessagesAsRead = async (conversationId: string, userId: string) => {
  try {
    const db = getDbInstance()
    const q = query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId),
      where("receiverId", "==", userId),
      where("read", "==", false)
    )
    
    const snapshot = await getDocs(q)
    const batch = snapshot.docs.map((document) =>
      updateDoc(doc(db, "messages", document.id), { read: true })
    )
    
    await Promise.all(batch)
  } catch (error) {
    console.error("Error marking messages as read:", error)
    throw error
  }
}
