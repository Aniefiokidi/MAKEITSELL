// import { ChatMessage } from './models'

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

export const createChatMessage = () => { throw new Error('Chat operations cannot be used in client components. Use API routes or server components only.') }

// Get all chat messages for a conversation
export const getChatMessages = () => { throw new Error('Chat operations cannot be used in client components. Use API routes or server components only.') }
// import connectToDatabase from './mongodb'
// import { Conversation } from './models'

// Get all conversations for a user by role (customer or provider)
export const getConversations = () => { throw new Error('Chat operations cannot be used in client components. Use API routes or server components only.') }

// Create a new conversation
type ConversationInput = {
  customerId: string
  providerId: string
  serviceId: string
  // add more fields as needed
}

export const createConversation = () => { throw new Error('Chat operations cannot be used in client components. Use API routes or server components only.') }
