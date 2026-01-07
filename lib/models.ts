// import mongoose, { Schema, Document, Model } from 'mongoose'

// Product Schema
export interface IProduct extends Document {
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
  sales: number
  hasColorOptions?: boolean
  hasSizeOptions?: boolean
  colors?: string[]
  sizes?: string[]
  colorImages?: { [key: string]: string[] }
  createdAt: Date
  updatedAt: Date
}

const ProductSchema = new Schema<IProduct>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  images: [{ type: String }],
  vendorId: { type: String, required: true, index: true },
  vendorName: { type: String, required: true },
  stock: { type: Number, required: true, default: 0 },
  sku: { type: String },
  featured: { type: Boolean, default: false },
  sales: { type: Number, default: 0 },
  hasColorOptions: { type: Boolean, default: false },
  hasSizeOptions: { type: Boolean, default: false },
  colors: [{ type: String }],
  sizes: [{ type: String }],
  colorImages: { type: Map, of: [String] },
  status: { 
    type: String, 
    enum: ["active", "inactive", "out_of_stock"], 
    default: "active" 
  }
}, {
  timestamps: true,
  collection: 'products'
})

// Create indexes for better query performance
ProductSchema.index({ vendorId: 1, createdAt: -1 })
ProductSchema.index({ category: 1, createdAt: -1 })
ProductSchema.index({ featured: 1, createdAt: -1 })

// Order Schema
export interface IOrder extends Document {
  orderId: string
  customerId: string
  vendorId?: string // For backward compatibility
  vendors: {
    vendorId: string
    vendorName: string
    vendorEmail?: string
    items: any[]
    total: number
  }[]
  items: any[]
  products: {
    productId: string
    quantity: number
    price: number
  }[]
  totalAmount: number
  status: "pending" | "pending_payment" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"
  paymentStatus: "pending" | "completed" | "failed" | "refunded"
  paymentMethod?: string
  paymentReference?: string
  paymentData?: any
  disputeStatus?: "none" | "active" | "resolved"
  disputeData?: any
  shippingInfo: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    address: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  shippingAddress: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  paidAt?: Date
  shippedAt?: Date
  deliveredAt?: Date
  cancelledAt?: Date
  disputeAt?: Date
  createdAt: Date
  updatedAt: Date
}

const OrderSchema = new Schema<IOrder>({
  orderId: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, required: true, index: true },
  vendorId: { type: String, index: true }, // For backward compatibility
  vendors: [{
    vendorId: { type: String, required: true },
    vendorName: { type: String, required: true },
    vendorEmail: { type: String },
    items: [{ type: Schema.Types.Mixed }],
    total: { type: Number, required: true }
  }],
  items: [{ type: Schema.Types.Mixed }],
  products: [{
    productId: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  totalAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ["pending", "pending_payment", "confirmed", "processing", "shipped", "delivered", "cancelled"],
    default: "pending"
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "pending"
  },
  paymentMethod: { type: String },
  paymentReference: { type: String },
  paymentData: { type: Schema.Types.Mixed },
  disputeStatus: {
    type: String,
    enum: ["none", "active", "resolved"],
    default: "none"
  },
  disputeData: { type: Schema.Types.Mixed },
  shippingInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  shippingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  paidAt: { type: Date },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  disputeAt: { type: Date }
}, {
  timestamps: true,
  collection: 'orders'
})

OrderSchema.index({ vendorId: 1, createdAt: -1 })
OrderSchema.index({ customerId: 1, createdAt: -1 })
// orderId index already created by unique: true
OrderSchema.index({ paymentReference: 1 })
OrderSchema.index({ paymentStatus: 1 })
OrderSchema.index({ status: 1 })

// Store Schema
export interface IStore extends Document {
  vendorId: string
  storeName: string
  storeDescription: string
  storeImage: string
  profileImage?: string
  storeBanner?: string
  bannerImages?: string[]
  category: string
  reviewCount: number
  isOpen: boolean
  deliveryTime: string
  deliveryFee: number
  minimumOrder: number
  address: string
  phone?: string
  email?: string
  // Subscription management fields
  subscriptionStatus: 'active' | 'suspended' | 'expired'
  subscriptionExpiry: Date
  isActive: boolean
  accountStatus: 'active' | 'suspended' | 'deleted'
  suspendedAt?: Date
  lastWarningEmail?: string
  warningEmailSent?: boolean
  createdAt: Date
  updatedAt: Date
}

const StoreSchema = new Schema<IStore>({
  vendorId: { type: String, required: true, unique: true, index: true },
  storeName: { type: String, required: true },
  storeDescription: { type: String, required: true },
  storeImage: { type: String, required: true },
  profileImage: { type: String },
  storeBanner: { type: String },
  bannerImages: [{ type: String }],
  category: { type: String, required: true },
  reviewCount: { type: Number, default: 0 },
  isOpen: { type: Boolean, default: true },
  deliveryTime: { type: String, required: true },
  deliveryFee: { type: Number, required: true },
  minimumOrder: { type: Number, required: true },
  address: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  // Subscription management fields
  subscriptionStatus: { 
    type: String, 
    enum: ['active', 'suspended', 'expired'], 
    default: 'active' 
  },
  subscriptionExpiry: { 
    type: Date, 
    required: true,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  },
  isActive: { type: Boolean, default: true },
  accountStatus: { 
    type: String, 
    enum: ['active', 'suspended', 'deleted'], 
    default: 'active' 
  },
  suspendedAt: { type: Date },
  lastWarningEmail: { type: String },
  warningEmailSent: { type: Boolean, default: false }
}, {
  timestamps: true,
  collection: 'stores'
})

StoreSchema.index({ category: 1, isOpen: 1 })

// Service Schema
export interface IService extends Document {
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
  locationType: "online" | "home-service" | "store"
  availability: {
    monday?: { start: string; end: string; available: boolean }
    tuesday?: { start: string; end: string; available: boolean }
    wednesday?: { start: string; end: string; available: boolean }
    thursday?: { start: string; end: string; available: boolean }
    friday?: { start: string; end: string; available: boolean }
    saturday?: { start: string; end: string; available: boolean }
    sunday?: { start: string; end: string; available: boolean }
  }
  reviewCount: number
  featured: boolean
  status: "active" | "inactive" | "paused"
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

const ServiceSchema = new Schema<IService>({
  providerId: { type: String, required: true, index: true },
  providerName: { type: String, required: true },
  providerImage: { type: String },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String },
  price: { type: Number, required: true },
  pricingType: { 
    type: String, 
    enum: ["fixed", "hourly", "per-session", "custom"],
    required: true 
  },
  duration: { type: Number },
  images: [{ type: String }],
  location: { type: String, required: true },
  locationType: { 
    type: String, 
    enum: ["online", "home-service", "store"],
    required: true 
  },
  availability: {
    monday: { start: String, end: String, available: { type: Boolean, default: false } },
    tuesday: { start: String, end: String, available: { type: Boolean, default: false } },
    wednesday: { start: String, end: String, available: { type: Boolean, default: false } },
    thursday: { start: String, end: String, available: { type: Boolean, default: false } },
    friday: { start: String, end: String, available: { type: Boolean, default: false } },
    saturday: { start: String, end: String, available: { type: Boolean, default: false } },
    sunday: { start: String, end: String, available: { type: Boolean, default: false } }
  },
  reviewCount: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ["active", "inactive", "paused"],
    default: "active" 
  },
  tags: [{ type: String }]
}, {
  timestamps: true,
  collection: 'services'
})

ServiceSchema.index({ providerId: 1, createdAt: -1 })
ServiceSchema.index({ category: 1, createdAt: -1 })
ServiceSchema.index({ featured: 1, createdAt: -1 })
ServiceSchema.index({ locationType: 1, createdAt: -1 })

// Booking Schema
export interface IBooking extends Document {
  serviceId: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  providerId: string
  providerName: string
  serviceTitle: string
  bookingDate: Date
  startTime: string
  endTime: string
  duration: number
  totalPrice: number
  status: "pending" | "confirmed" | "cancelled" | "completed" | "rescheduled"
  locationType: "online" | "home-service" | "store"
  location?: string
  notes?: string
  cancellationReason?: string
  createdAt: Date
  updatedAt: Date
}

const BookingSchema = new Schema<IBooking>({
  serviceId: { type: String, required: true },
  customerId: { type: String, required: true, index: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String },
  providerId: { type: String, required: true, index: true },
  providerName: { type: String, required: true },
  serviceTitle: { type: String, required: true },
  bookingDate: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  duration: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ["pending", "confirmed", "cancelled", "completed", "rescheduled"],
    default: "pending"
  },
  locationType: { 
    type: String, 
    enum: ["online", "home-service", "store"],
    required: true 
  },
  location: { type: String },
  notes: { type: String },
  cancellationReason: { type: String }
}, {
  timestamps: true,
  collection: 'bookings'
})

BookingSchema.index({ providerId: 1, bookingDate: 1 })
BookingSchema.index({ customerId: 1, bookingDate: 1 })
BookingSchema.index({ providerId: 1, status: 1, bookingDate: 1 })

// Support Ticket Schema
export interface ISupportTicket extends Document {
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
    timestamp: Date
  }[]
  createdAt: Date
  updatedAt: Date
}

const SupportTicketSchema = new Schema<ISupportTicket>({
  customerId: { type: String, required: true, index: true },
  orderId: { type: String },
  vendorId: { type: String },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  status: { 
    type: String, 
    enum: ["open", "in-progress", "resolved", "closed"],
    default: "open"
  },
  priority: { 
    type: String, 
    enum: ["low", "medium", "high", "urgent"],
    default: "medium"
  },
  assignedTo: { type: String },
  messages: [{
    senderId: { type: String, required: true },
    senderRole: { 
      type: String, 
      enum: ["customer", "vendor", "csa", "admin", "ai"],
      required: true 
    },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true,
  collection: 'support_tickets'
})

// Notification Schema
export interface INotification extends Document {
  userId: string
  type: "order" | "ticket" | "system"
  title: string
  message: string
  read: boolean
  relatedId?: string
  createdAt: Date
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: String, required: true, index: true },
  type: { 
    type: String, 
    enum: ["order", "ticket", "system"],
    required: true 
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  relatedId: { type: String }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'notifications'
})

NotificationSchema.index({ userId: 1, createdAt: -1 })

// User Cart Schema
export interface IUserCart extends Document {
  userId: string
  items: any[]
  updatedAt: Date
}

const UserCartSchema = new Schema<IUserCart>({
  userId: { type: String, required: true, unique: true, index: true },
  items: [{ type: Schema.Types.Mixed }]
}, {
  timestamps: { createdAt: false, updatedAt: true },
  collection: 'user_carts'
})

// Conversation Schema
export interface IConversation extends Document {
  customerId: string
  customerName: string
  providerId: string
  providerName: string
  storeId?: string
  storeName?: string
  storeImage?: string
  serviceId?: string
  lastMessage: string
  lastMessageTime: Date
  unreadCount: number
  createdAt: Date
  updatedAt: Date
}

const ConversationSchema = new Schema<IConversation>({
  customerId: { type: String, required: true, index: true },
  customerName: { type: String, required: true },
  providerId: { type: String, required: true, index: true },
  providerName: { type: String, required: true },
  storeId: { type: String },
  storeName: { type: String },
  storeImage: { type: String },
  serviceId: { type: String },
  lastMessage: { type: String, required: true },
  lastMessageTime: { type: Date, required: true },
  unreadCount: { type: Number, default: 0 }
}, {
  timestamps: true,
  collection: 'conversations'
})

ConversationSchema.index({ customerId: 1, lastMessageTime: -1 })
ConversationSchema.index({ providerId: 1, lastMessageTime: -1 })

// Chat Message Schema
export interface IChatMessage extends Document {
  conversationId: string
  senderId: string
  senderName: string
  senderRole: "customer" | "provider"
  receiverId: string
  message: string
  images?: string[]
  read: boolean
  createdAt: Date
}

const ChatMessageSchema = new Schema<IChatMessage>({
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderRole: { 
    type: String, 
    enum: ["customer", "provider"],
    required: true 
  },
  receiverId: { type: String, required: true },
  message: { type: String, required: true },
  images: [{ type: String }],
  read: { type: Boolean, default: false }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'chat_messages'
})

ChatMessageSchema.index({ conversationId: 1, createdAt: 1 })

// Export models

// STUB: Prevent client-side usage of mongoose models
const notServerError = () => { throw new Error('Mongoose models cannot be used in client components. Use API routes or server components only.') }
export const Product = notServerError as any
export const Order = notServerError as any
export const Store = notServerError as any
export const Service = notServerError as any
export const Booking = notServerError as any
export const SupportTicket = notServerError as any
export const Notification = notServerError as any
export const UserCart = notServerError as any
export const Conversation = notServerError as any
export const ChatMessage = notServerError as any