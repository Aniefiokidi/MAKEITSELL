// MongoDB Database Operations - Drop-in replacement for Firestore
// This file provides the same interface as firestore.ts but uses MongoDB

import * as mongoOperations from './mongodb-operations'
import { Conversation, ChatMessage } from './models'
import * as mongoAuth from './mongodb-auth'
import { withMongoDBRetry } from './mongodb'
import { IProduct, IOrder, IStore, IService, IBooking, ISupportTicket, INotification, IUserCart, IConversation, IChatMessage } from './models'

// Re-export all MongoDB operations with the same interface as Firestore
export const getProducts = mongoOperations.getProducts
export const createProduct = mongoOperations.createProduct
export const updateProduct = mongoOperations.updateProduct
export const deleteProduct = mongoOperations.deleteProduct
export const getVendorProducts = mongoOperations.getVendorProducts
export const getProductById = mongoOperations.getProductById

export const getOrders = mongoOperations.getOrders
export const createOrder = mongoOperations.createOrder
export const getOrderById = mongoOperations.getOrderById
export const updateOrder = mongoOperations.updateOrder

export const getStores = mongoOperations.getStores
export const getStoreById = mongoOperations.getStoreById
export const createStore = mongoOperations.createStore
export const updateStore = mongoOperations.updateStore

export const getServices = mongoOperations.getServices
export const createService = mongoOperations.createService
export const updateService = mongoOperations.updateService
export const deleteService = mongoOperations.deleteService
export const getServiceById = mongoOperations.getServiceById

export const getBookings = mongoOperations.getBookings
export const createBooking = mongoOperations.createBooking
export const updateBooking = mongoOperations.updateBooking

export const createSupportTicket = mongoOperations.createSupportTicket
export const getSupportTickets = mongoOperations.getSupportTickets
export const updateSupportTicket = mongoOperations.updateSupportTicket

export const createNotification = mongoOperations.createNotification
export const getNotifications = mongoOperations.getNotifications
export const markNotificationAsRead = mongoOperations.markNotificationAsRead

export const getUserCart = mongoOperations.getUserCart
export const setUserCart = mongoOperations.setUserCart

export const getUserById = mongoOperations.getUserById

export const getConversations = mongoOperations.getConversations
export const createConversation = mongoOperations.createConversation

export const getChatMessages = mongoOperations.getChatMessages
export const createChatMessage = mongoOperations.createChatMessage

export const createDocument = mongoOperations.createDocument
export const getDocument = mongoOperations.getDocument
export const updateDocument = mongoOperations.updateDocument
export const deleteDocument = mongoOperations.deleteDocument

// Re-export types with different names to avoid conflicts
export type {
  Product as ProductType,
  Order as OrderType,
  Store as StoreType,
  Service as ServiceType,
  Booking as BookingType,
  SupportTicket as SupportTicketType,
  Notification as NotificationType,
  UserCart as UserCartType
} from './mongodb-operations'

export type ConversationType = typeof Conversation;
export type ChatMessageType = typeof ChatMessage;

// For backward compatibility, create interface definitions that match Firestore
export interface Product extends IProduct {}
export interface Order extends IOrder {}
export interface Store extends IStore {}
export interface Service extends IService {}
export interface Booking extends IBooking {}
export interface SupportTicket extends ISupportTicket {}
export interface Notification extends INotification {}
export interface UserCart extends IUserCart {}
export interface Conversation extends IConversation {}
export interface ChatMessage extends IChatMessage {}

// Database utility functions
export const isDbAvailable = async () => {
  try {
    const mongoAvailable = await withMongoDBRetry(
      async () => true,
      () => false
    )
    return mongoAvailable
  } catch {
    return false
  }
}