import mongoose, { Schema, Document, models } from 'mongoose'

export interface INegotiationMessage {
  id: string
  senderId: string
  senderName: string
  senderRole: 'customer' | 'provider'
  type: 'offer' | 'counter' | 'accept' | 'reject' | 'note'
  amount: number | null
  text: string
  createdAt: Date
}

export interface IPriceNegotiation extends Document {
  serviceId: string
  providerId: string
  customerId: string
  customerName: string
  customerEmail: string
  providerName: string
  providerEmail: string
  serviceName: string
  basePrice: number
  status: 'open' | 'agreed' | 'rejected' | 'expired'
  agreedPrice: number | null
  messages: INegotiationMessage[]
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

const MessageSchema = new Schema<INegotiationMessage>(
  {
    id: { type: String, required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, enum: ['customer', 'provider'], required: true },
    type: { type: String, enum: ['offer', 'counter', 'accept', 'reject', 'note'], required: true },
    amount: { type: Number, default: null },
    text: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const PriceNegotiationSchema = new Schema<IPriceNegotiation>(
  {
    serviceId: { type: String, required: true, index: true },
    providerId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    providerName: { type: String, required: true },
    providerEmail: { type: String, default: '' },
    serviceName: { type: String, required: true },
    basePrice: { type: Number, required: true },
    status: {
      type: String,
      enum: ['open', 'agreed', 'rejected', 'expired'],
      default: 'open',
      index: true,
    },
    agreedPrice: { type: Number, default: null },
    messages: { type: [MessageSchema], default: [] },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
)

export const PriceNegotiation =
  models.PriceNegotiation ||
  mongoose.model<IPriceNegotiation>('PriceNegotiation', PriceNegotiationSchema)
