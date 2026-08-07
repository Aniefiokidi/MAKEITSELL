import mongoose, { Schema, models, model } from 'mongoose'

const SupportTicketMessageSchema = new Schema({
  senderId: { type: String, required: true },
  senderRole: { type: String, enum: ['customer', 'admin', 'ai', 'system'], required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false })

const SupportTicketSchema = new Schema({
  customerId: { type: String, required: true, index: true },
  customerName: { type: String },
  customerEmail: { type: String },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open', index: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium', index: true },
  // Where the escalation came from — currently always 'ai' (the support chat's only
  // escalation path); 'vendor'/'customer' are reserved for the admin UI's existing
  // (currently unused) distinction, kept so that surface doesn't need reshaping later.
  escalatedFrom: { type: String, enum: ['ai', 'vendor', 'customer'], default: 'ai' },
  messages: { type: [SupportTicketMessageSchema], default: [] },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
})

export const SupportTicket = models.SupportTicket || model('SupportTicket', SupportTicketSchema)
