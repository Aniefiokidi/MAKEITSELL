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
import { Menu, ArrowLeft } from "lucide-react"

import { useAuth } from "@/contexts/AuthContext"
import { Send, MessageCircle, CheckCheck, Check } from "lucide-react"
import { format, isToday, isYesterday } from "date-fns"

// --- Added interfaces at the top level ---
interface Conversation {
  id: string
  customerId: string
  customerName: string
  providerId: string
  providerName: string
  storeImage?: string
  storeName?: string
  lastMessage: string
  lastMessageTime: string
  customerUnreadCount?: number
  providerUnreadCount?: number
}

interface Message {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  senderRole: "provider" | "customer"
  receiverId: string
  message: string
  read: boolean
  createdAt: string
}

export default function MessagesPage() {
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [backgroundLoading, setBackgroundLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  // Mobile: show chat overlay
  const [showMobileChat, setShowMobileChat] = useState(false)

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login")
      return
    }
    fetchConversations()
    // Poll for new messages every 30 seconds
    const interval = setInterval(() => {
      fetchConversations()
      // Only poll messages without resetting unread count
      if (selectedConversation) {
        fetchMessages(selectedConversation.id!, false)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [user, selectedConversation, authLoading])

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id!, true)
        .then(() => fetchConversations(true)); // Refresh conversations in background
      inputRef.current?.focus()
    }
  }, [selectedConversation])

  const fetchConversations = async (background = false) => {
    try {
      if (background) {
        setBackgroundLoading(true)
      } else {
        setLoading(true)
      }
      const role = userProfile?.role === "vendor" ? "provider" : "customer"
      const res = await fetch(`/api/messages?userId=${user?.uid || ""}&role=${role}`)
      const result = await res.json()
      // Sort conversations by lastMessageTime descending
      const sorted = (result.conversations || []).sort(
        (a: Conversation, b: Conversation) =>
          new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      )
      setConversations(sorted)
    } catch (error) {
      console.error("Error fetching conversations:", error)
    } finally {
      if (background) {
        setBackgroundLoading(false)
      } else {
        setLoading(false)
      }
    }
  }

  const fetchMessages = async (conversationId: string, resetUnread = false) => {
    try {
      let url = `/api/messages/messages?conversationId=${conversationId}`;
      if (resetUnread && user && userProfile) {
        const role = userProfile.role === "vendor" ? "provider" : "customer";
        url += `&userId=${user.uid}&userRole=${role}`;
      }
      const res = await fetch(url);
      const result = await res.json();
      setMessages(result.messages || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
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
        senderRole: isProvider ? "provider" : "customer",
        receiverId: isProvider ? selectedConversation.customerId : selectedConversation.providerId,
        receiverName: isProvider ? selectedConversation.customerName : selectedConversation.providerName,
        message: newMessage.trim(),
        read: false,
      }
      await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messageData),
      })
      setNewMessage("")
      await fetchConversations() // Refetch conversations after sending
      if (selectedConversation) {
        await fetchMessages(selectedConversation.id!)
      }
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setSending(false)
    }
  }

  const formatMessageTime = (timestamp: string | number | Date) => {
    const date = new Date(timestamp)
    if (isToday(date)) {
      return format(date, "h:mm a")
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, "h:mm a")}`
    }
    return format(date, "MMM d, yyyy h:mm a")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 w-full mx-auto py-0 md:py-8 px-0 md:px-4 lg:px-8">
        {/* MOBILE: Conversation List */}
        <div className="block md:hidden">
          {!showMobileChat && (
            <div className="w-full max-w-md mx-auto">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-xl font-bold">Messages</h2>
                {/* Optionally add icons here */}
              </div>
              <div className="px-4 pb-2">
                <input className="w-full rounded-full px-4 py-2 bg-muted text-sm focus:outline-none" placeholder="Search" />
              </div>
              <div className="divide-y bg-background rounded-2xl shadow-md mx-2">
                {conversations.map((conv) => {
                  const otherPersonName = userProfile?.role === "vendor" 
                    ? conv.customerName 
                    : conv.providerName
                  const unreadCount = userProfile?.role === "vendor"
                    ? conv.providerUnreadCount || 0
                    : conv.customerUnreadCount || 0
                  const isUnread = unreadCount > 0
                  return (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setSelectedConversation(conv)
                        setShowMobileChat(true)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-background hover:bg-muted/30 transition group"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={conv.storeImage || undefined} alt={otherPersonName} />
                        <AvatarFallback className="bg-accent text-accent-foreground">
                          {otherPersonName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-base truncate">{otherPersonName}</span>
                          <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">{format(new Date(conv.lastMessageTime), isToday(new Date(conv.lastMessageTime)) ? "h:mm a" : "MMM d")}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground truncate flex-1">{conv.lastMessage || "No messages yet"}</span>
                          {isUnread && <span className="ml-2 h-2 w-2 rounded-full bg-accent inline-block" />}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {/* MOBILE: Chat Overlay */}
          {showMobileChat && selectedConversation && (
            <div className="fixed inset-0 z-50 bg-background flex flex-col">
              <div className="flex items-center gap-2 px-2 py-3 border-b bg-background/95">
                <Button variant="ghost" size="icon" onClick={() => setShowMobileChat(false)}>
                  <ArrowLeft className="h-6 w-6" />
                </Button>
                <Avatar className="h-9 w-9">
                  <AvatarImage src={selectedConversation.storeImage || undefined} alt={userProfile?.role === "vendor" ? selectedConversation.customerName : selectedConversation.providerName} />
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    {(userProfile?.role === "vendor" ? selectedConversation.customerName : selectedConversation.providerName).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold text-base">{userProfile?.role === "vendor" ? selectedConversation.customerName : selectedConversation.providerName}</span>
              </div>
              <div className="flex-1 flex flex-col overflow-y-auto bg-muted/20">
                <ScrollArea className="flex-1 p-2">
                  <div className="space-y-4 pb-4">
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full py-16">
                        <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      messages.map((msg, index) => {
                        const isOwnMessage = msg.senderId === user?.uid
                        const showDate = index === 0 || 
                          !isToday(new Date(msg.createdAt)) && 
                          (index === 0 || !isToday(new Date(messages[index - 1].createdAt)))
                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <div className="flex justify-center my-4">
                                <Badge variant="secondary" className="text-xs">
                                  {format(new Date(msg.createdAt), "MMMM d, yyyy")}
                                </Badge>
                              </div>
                            )}
                            <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                              <div className={`flex flex-col max-w-[80vw] items-end md:max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"}`}>
                                <div className={`rounded-2xl px-4 py-2 text-sm shadow-md ${
                                  isOwnMessage
                                    ? "bg-accent text-accent-foreground rounded-br-sm"
                                    : "bg-muted rounded-bl-sm"
                                }`}>
                                  <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                                </div>
                                <div className={`flex items-center gap-1 mt-1 px-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                                  <p className="text-xs text-muted-foreground">
                                    {formatMessageTime(msg.createdAt)}
                                  </p>
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
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-2 border-t bg-background">
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    disabled={sending}
                    className="flex-1 rounded-full"
                    autoComplete="off"
                  />
                  <Button type="submit" disabled={!newMessage.trim() || sending} className="rounded-full">
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>
        {/* DESKTOP: Conversation List + Chat Area */}
        <div className="hidden md:grid grid-cols-3 gap-8 h-[80vh]">
          {/* Mobile: Drawer toggle button */}
          <div className="md:hidden mb-4 flex justify-between items-center">
            <CardTitle>Conversations</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowDrawer(true)}>
              <Menu className="h-6 w-6" />
            </Button>
          </div>
          {/* Conversations List */}
          <div className={`fixed inset-0 z-40 bg-black/70 md:bg-transparent md:static md:col-span-1 transition-transform duration-300 ${showDrawer ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`} style={{ maxWidth: '100vw' }}>
            <Card className="h-full md:h-auto md:rounded-none md:shadow-none">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Conversations</CardTitle>
                  <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowDrawer(false)}>
                    <Menu className="h-6 w-6" />
                  </Button>
                </div>
                <CardDescription>Your recent chats</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[70vh] md:h-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-16 px-4 text-center">
                      <p className="text-muted-foreground">Loading conversations...</p>
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
                        const unreadCount = userProfile?.role === "vendor"
                          ? conv.providerUnreadCount || 0
                          : conv.customerUnreadCount || 0
                        const isUnread = unreadCount > 0
                        return (
                          <button
                            key={conv.id}
                            onClick={() => {
                              setSelectedConversation(conv)
                              setShowDrawer(false)
                            }}
                            className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                              selectedConversation?.id === conv.id ? "bg-muted" : ""
                            } ${isUnread ? "border-l-4 border-accent bg-accent/10" : "border-l-4 border-transparent"}`}
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
                                  <p className={`truncate ${isUnread ? "font-bold" : "font-semibold"}`}>{otherPersonName}</p>
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(conv.lastMessageTime), isToday(new Date(conv.lastMessageTime)) ? "h:mm a" : "MMM d")}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <p className={`text-sm truncate flex-1 ${isUnread ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                                    {conv.lastMessage || "No messages yet"}
                                  </p>
                                  {isUnread && (
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
          </div>
          {/* Chat Area */}
          <div className="md:col-span-2 flex flex-col h-[80vh] md:h-auto">
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
                {/* Chat Area: messages + input */}
                <div className="flex flex-col flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 64px - 56px)' }}>
                  <ScrollArea className="flex-1 p-2 md:p-4 bg-muted/20">
                    <div className="space-y-4 pb-4">
                      {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full py-16">
                          <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                        </div>
                      ) : (
                        messages.map((msg, index) => {
                          const isOwnMessage = msg.senderId === user?.uid
                          const showDate = index === 0 || 
                            !isToday(new Date(msg.createdAt)) && 
                            (index === 0 || !isToday(new Date(messages[index - 1].createdAt)))
                          return (
                            <div key={msg.id}>
                              {showDate && (
                                <div className="flex justify-center my-4">
                                  <Badge variant="secondary" className="text-xs">
                                    {format(new Date(msg.createdAt), "MMMM d, yyyy")}
                                  </Badge>
                                </div>
                              )}
                              <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                                <div className={`flex flex-col max-w-[80vw] items-end md:max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"}`}>
                                  <div className={`rounded-2xl px-4 py-2 text-sm shadow-md ${
                                    isOwnMessage
                                      ? "bg-accent text-accent-foreground rounded-br-sm"
                                      : "bg-muted rounded-bl-sm"
                                  }`}>
                                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                                  </div>
                                  <div className={`flex items-center gap-1 mt-1 px-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                                    <p className="text-xs text-muted-foreground">
                                      {formatMessageTime(msg.createdAt)}
                                    </p>
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
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-2 border-t bg-background">
                    <Input
                      ref={inputRef}
                      type="text"
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      disabled={sending}
                      className="flex-1 rounded-full"
                      autoComplete="off"
                    />
                    <Button type="submit" disabled={!newMessage.trim() || sending} className="rounded-full">
                      <Send className="h-5 w-5" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16">
                <MessageCircle className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">Select a conversation</p>
                <p className="text-sm text-muted-foreground">Choose a conversation from the list to view messages and start chatting</p>
              </div>
            )}
          </div>
        </div>
      </main>
      
    </div>
  )
}