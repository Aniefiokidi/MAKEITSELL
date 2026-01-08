// Deprecated: Firestore test logic removed. File retained for legacy reference only.
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
    q = query(q, orderBy("createdAt", "desc"))
    if (filters?.limitCount) {
      q = query(q, limit(filters.limitCount))
    }
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
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
    let q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    )
    if (limitCount) {
      q = query(q, limit(limitCount))
    }
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
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
    let q = query(collection(db, "supportTickets"), orderBy("createdAt", "desc"))

    if (filters?.customerId) {
      q = query(q, where("customerId", "==", filters.customerId))
    }
    if (filters?.vendorId) {
      q = query(q, where("vendorId", "==", filters.vendorId))
    }
    if (filters?.status) {
      q = query(q, where("status", "==", filters.status))
    }
    if (filters?.limitCount) {
      q = query(q, limit(filters.limitCount))
    }

    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
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

    q = query(q, orderBy("createdAt", "desc"))

    if (filters?.limitCount) {
      q = query(q, limit(filters.limitCount))
    }

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[]
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
    const q = query(collection(db, "products"), where("vendorId", "==", vendorId), orderBy("createdAt", "desc"))

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[]
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
