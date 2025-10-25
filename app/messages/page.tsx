"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { getConversations, getMessages, sendMessage, Conversation, ChatMessage, markMessagesAsRead } from "@/lib/firestore"
import { useAuth } from "@/contexts/AuthContext"
import { Send, MessageCircle, CheckCheck, Check } from "lucide-react"
import { format, isToday, isYesterday } from "date-fns"
import { Timestamp } from "firebase/firestore"

export default function MessagesPage() {
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }
    fetchConversations()
    
    // Poll for new messages every 5 seconds
    const interval = setInterval(() => {
      fetchConversations()
      if (selectedConversation) {
        fetchMessages(selectedConversation.id!)
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id!)
      markMessagesAsRead(selectedConversation.id!, user?.uid || "")
      inputRef.current?.focus()
    }
  }, [selectedConversation])

  const fetchConversations = async () => {
    try {
      setLoading(true)
      const role = userProfile?.role === "vendor" ? "provider" : "customer"
      const data = await getConversations(user?.uid || "", role)
      setConversations(data)
    } catch (error) {
      console.error("Error fetching conversations:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (conversationId: string) => {
    try {
      const data = await getMessages(conversationId)
      setMessages(data)
    } catch (error) {
      console.error("Error fetching messages:", error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation || !user || !userProfile) return

    try {
      setSending(true)
      const isProvider = userProfile.role === "vendor"
      
      const messageData = {
        conversationId: selectedConversation.id!,
        senderId: user.uid,
        senderName: userProfile.displayName,
        senderRole: isProvider ? ("provider" as const) : ("customer" as const),
        receiverId: isProvider ? selectedConversation.customerId : selectedConversation.providerId,
        message: newMessage.trim(),
        read: false,
      }

      await sendMessage(messageData)
      setNewMessage("")
      fetchMessages(selectedConversation.id!)
      fetchConversations() // Update conversation list
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setSending(false)
    }
  }

  const formatMessageTime = (timestamp: Timestamp) => {
    const date = timestamp.toDate()
    if (isToday(date)) {
      return format(date, "h:mm a")
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, "h:mm a")}`
    } else {
      return format(date, "MMM d, h:mm a")
    }
  }

  const getUnreadCount = (conv: Conversation) => {
    // This would need to be implemented in Firestore to track unread messages
    return 0
  }

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">Chat with {userProfile?.role === "vendor" ? "customers" : "vendors"}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
          {/* Conversations List */}
          <Card className="lg:col-span-1 flex flex-col">
            <CardHeader className="border-b">
              <CardTitle>Chats</CardTitle>
              <CardDescription>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <ScrollArea className="h-full">
                {loading ? (
                  <div className="p-4 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse flex items-center gap-3 p-3">
                        <div className="h-12 w-12 bg-muted rounded-full" />
                        <div className="flex-1">
                          <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                          <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <MessageCircle className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">No conversations yet</p>
                    <p className="text-sm text-muted-foreground">Start by browsing {userProfile?.role === "vendor" ? "your products" : "the marketplace"}</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {conversations.map((conv) => {
                      const otherPersonName = userProfile?.role === "vendor" 
                        ? conv.customerName 
                        : conv.providerName
                      const unreadCount = getUnreadCount(conv)
                      
                      return (
                        <button
                          key={conv.id}
                          onClick={() => setSelectedConversation(conv)}
                          className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                            selectedConversation?.id === conv.id ? "bg-muted" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={conv.storeImage || undefined} alt={otherPersonName} />
                              <AvatarFallback className="bg-accent text-accent-foreground">
                                {otherPersonName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-semibold truncate">{otherPersonName}</p>
                                <div className="text-xs text-muted-foreground">
                                  {format(conv.lastMessageTime.toDate(), isToday(conv.lastMessageTime.toDate()) ? "h:mm a" : "MMM d")}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground truncate flex-1">
                                  {conv.lastMessage || "No messages yet"}
                                </p>
                                {unreadCount > 0 && (
                                  <Badge variant="default" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                                    {unreadCount}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="lg:col-span-2 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <CardHeader className="border-b">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage 
                        src={selectedConversation.storeImage || undefined} 
                        alt={userProfile?.role === "vendor" 
                          ? selectedConversation.customerName 
                          : selectedConversation.providerName} 
                      />
                      <AvatarFallback className="bg-accent text-accent-foreground">
                        {(userProfile?.role === "vendor" 
                          ? selectedConversation.customerName 
                          : selectedConversation.providerName).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">
                        {userProfile?.role === "vendor" 
                          ? selectedConversation.customerName 
                          : selectedConversation.providerName}
                      </CardTitle>
                      {selectedConversation.storeName && (
                        <p className="text-sm text-muted-foreground">{selectedConversation.storeName}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4 bg-muted/20">
                  <div className="space-y-4 pb-4">
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full py-16">
                        <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      messages.map((msg, index) => {
                        const isOwnMessage = msg.senderId === user.uid
                        const showDate = index === 0 || 
                          !isToday(msg.createdAt.toDate()) && 
                          (index === 0 || !isToday(messages[index - 1].createdAt.toDate()))
                        
                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <div className="flex justify-center my-4">
                                <Badge variant="secondary" className="text-xs">
                                  {format(msg.createdAt.toDate(), "MMMM d, yyyy")}
                                </Badge>
                              </div>
                            )}
                            <div
                              className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                            >
                              <div className="flex flex-col max-w-[70%]">
                                <div
                                  className={`rounded-2xl px-4 py-2 ${
                                    isOwnMessage
                                      ? "bg-accent text-accent-foreground rounded-br-sm"
                                      : "bg-muted rounded-bl-sm"
                                  }`}
                                >
                                  <p className="text-sm whitespace-pre-wrap wrap-break-word">{msg.message}</p>
                                </div>
                                <div className={`flex items-center gap-1 mt-1 px-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                                  <p className="text-xs text-muted-foreground">
                                    {formatMessageTime(msg.createdAt)}
                                  </p>
                                  {isOwnMessage && (
                                    <span className="text-muted-foreground">
                                      {msg.read ? (
                                        <CheckCheck className="h-3 w-3 text-accent" />
                                      ) : (
                                        <Check className="h-3 w-3" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <CardContent className="border-t p-4 bg-background">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      disabled={sending}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage(e)
                        }
                      }}
                    />
                    <Button type="submit" disabled={!newMessage.trim() || sending} size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                  <p className="text-xs text-muted-foreground mt-2">Press Enter to send, Shift+Enter for new line</p>
                </CardContent>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <div className="bg-muted rounded-full h-24 w-24 flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Select a conversation</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Choose a conversation from the list to view messages and start chatting
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
