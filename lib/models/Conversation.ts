import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
  customerId: string;
  customerName: string;
  providerId: string;
  providerName: string;
  storeImage?: string;
  storeName?: string;
  lastMessage: string;
  lastMessageTime: Date;
  customerUnreadCount?: number;
  providerUnreadCount?: number;
}

const ConversationSchema = new Schema<IConversation>({
  customerId: { type: String, required: true },
  customerName: { type: String, required: true },
  providerId: { type: String, required: true },
  providerName: { type: String, required: true },
  storeImage: { type: String },
  storeName: { type: String },
  lastMessage: { type: String, default: '' },
  lastMessageTime: { type: Date, default: Date.now },
  customerUnreadCount: { type: Number, default: 0 },
  providerUnreadCount: { type: Number, default: 0 },
});

export default mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);
