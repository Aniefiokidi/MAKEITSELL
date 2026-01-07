import { ChatMessage } from './models'

// Create a new chat message
type ChatMessageInput = {
  conversationId: string
  senderId: string
  senderName: string
  senderRole: 'customer' | 'provider'
  receiverId: string
  message: string
  images?: string[]
  read?: boolean
}

export const createChatMessage = async (data: ChatMessageInput) => {
  await connectToDatabase()
  const chatMessage = new ChatMessage(data)
  const saved = await chatMessage.save()
  return saved._id.toString()
}

// Get all chat messages for a conversation
export const getChatMessages = async (conversationId: string, limitCount?: number) => {
  await connectToDatabase()
  let query = ChatMessage.find({ conversationId }).sort({ createdAt: 1 })
  if (limitCount) query = query.limit(limitCount)
  const messages = await query.lean().exec()
  return messages.map((msg: any) => ({ id: msg._id, ...msg }))
}
import connectToDatabase from './mongodb'
import { Conversation } from './models'

// Get all conversations for a user by role (customer or provider)
export const getConversations = async (userId: string, role: string) => {
  await connectToDatabase()
  let query = {}
  if (role === 'customer') {
    query = { customerId: userId }
  } else if (role === 'provider' || role === 'vendor') {
    query = { providerId: userId }
  } else {
    throw new Error('Invalid role for conversation fetch')
  }
  // Only return conversations where the user is either the customer or provider
  const conversations = await Conversation.find(query).lean().exec()
  return conversations.map((conv: any) => ({ id: conv._id, ...conv }))
}

// Create a new conversation
type ConversationInput = {
  customerId: string
  providerId: string
  serviceId: string
  // add more fields as needed
}

export const createConversation = async (data: ConversationInput) => {
  await connectToDatabase()
  const conversation = new Conversation(data)
  const saved = await conversation.save()
  return { id: saved._id, ...saved.toObject() }
}
