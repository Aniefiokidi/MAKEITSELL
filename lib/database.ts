// MongoDB Database Operations - Drop-in replacement for Firestore
// This file provides the same interface as firestore.ts but uses MongoDB

// STUB: This file should not be imported in client components!
// All database logic must be accessed via API routes or server components only.

const notServerError = () => {
  throw new Error('Database functions cannot be used in client components. Use API routes instead.')
}

// Export all database functions as stubs to prevent client-side/server boundary issues
export const getProducts = notServerError;
export const createProduct = notServerError;
export const updateProduct = notServerError;
export const deleteProduct = notServerError;
export const getVendorProducts = notServerError;
export const getProductById = notServerError;
export const getOrders = notServerError;
export const createOrder = notServerError;
export const getOrderById = notServerError;
export const updateOrder = notServerError;
export const getStores = notServerError;
export const getStoreById = notServerError;
export const createStore = notServerError;
export const updateStore = notServerError;
export const getServices = notServerError;
export const createService = notServerError;
export const updateService = notServerError;
export const deleteService = notServerError;
export const getServiceById = notServerError;
export const getBookings = notServerError;
export const createBooking = notServerError;
export const updateBooking = notServerError;
export const createSupportTicket = notServerError;
export const getSupportTickets = notServerError;
export const updateSupportTicket = notServerError;
export const createNotification = notServerError;
export const getNotifications = notServerError;
export const markNotificationAsRead = notServerError;
export const getUserCart = notServerError;
export const setUserCart = notServerError;
export const getUserById = notServerError;
export const getConversations = notServerError;
export const createConversation = notServerError;
export const getChatMessages = notServerError;
export const createChatMessage = notServerError;
export const createDocument = notServerError;
export const getDocument = notServerError;
export const updateDocument = notServerError;
export const deleteDocument = notServerError;

// All type/interface exports and duplicate isDbAvailable removed to fix errors