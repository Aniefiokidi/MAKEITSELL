"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/AuthContext"
import { analyzeQueryWithGemini } from "@/lib/gemini-ai"
import { Send, Bot, User, Loader2, MessageCircle } from "lucide-react"

interface Message {
  id: string
  senderId: string
  senderRole: "customer" | "vendor" | "csa" | "admin" | "ai"
  message: string
  timestamp: Date
  isTyping?: boolean
}

interface SupportChatProps {
  ticketId?: string
  onEscalate?: (reason: string) => void
}

export default function SupportChat({ ticketId, onEscalate }: SupportChatProps) {
  const { user, userProfile } = useAuth()
  const { getUserCart, setUserCart, createDocument, getDocument } = require("@/lib/firestore")
  const [messages, setMessages] = useState<Message[]>([])
  const [initialized, setInitialized] = useState(false)
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isEscalated, setIsEscalated] = useState(false)
  const [messageCounter, setMessageCounter] = useState(0)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
        // For Radix ScrollArea, we need to target the viewport
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight
        } else {
          // Fallback for regular scroll container
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
        }
      }
    }

    // Use setTimeout to ensure DOM is updated before scrolling
    const timer = setTimeout(scrollToBottom, 50)
    return () => clearTimeout(timer)
  }, [messages])

  // Fetch messages from Firestore if ticketId is provided
  useEffect(() => {
    const fetchMessages = async () => {
      if (ticketId) {
        try {
          const ticket = await getDocument("supportTickets", ticketId)
          if (ticket && Array.isArray(ticket.messages) && ticket.messages.length > 0) {
            setMessages(ticket.messages.map((msg: any) => ({ ...msg, timestamp: msg.timestamp?.toDate?.() || new Date() })))
          } else {
            setMessages([])
          }
        } catch (error) {
          setMessages([])
        }
      } else if (!initialized) {
        const userName = user?.displayName || userProfile?.name || user?.email?.split('@')[0] || 'there'
        setMessages([
          {
            id: "welcome",
            senderId: "ai",
            senderRole: "ai",
            message:
              `Hi ${userName}! 👋 I'm your AI assistant and I'm here to help you with anything you need. What specific issue can I help you solve today?`,
            timestamp: new Date(),
          },
        ])
        setInitialized(true)
      }
    }
    fetchMessages()
  }, [ticketId, initialized])

  const addMessage = async (message: Omit<Message, "id" | "timestamp">) => {
    setMessageCounter(prev => prev + 1)
    const newMessage: Message = {
      ...message,
      id: `${Date.now()}-${messageCounter}`,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, newMessage])
    
    // Save to Firestore if ticketId exists
    if (ticketId) {
      try {
        const ticket = await getDocument("supportTickets", ticketId)
        const updatedMessages = ticket && Array.isArray(ticket.messages) ? [...ticket.messages, newMessage] : [newMessage]
        await createDocument("supportTickets", { ...ticket, messages: updatedMessages })
      } catch (error) {
        // handle error
      }
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage = inputMessage.trim()
    setInputMessage("")

    // Add user message
    addMessage({
      senderId: user?.uid || "anonymous",
      senderRole: "customer",
      message: userMessage,
    })

    if (!isEscalated) {
      setIsLoading(true)

      // Add typing indicator
      addMessage({
        senderId: "ai",
        senderRole: "ai",
        message: "AI is typing...",
        isTyping: true,
      })

      try {
        // Get AI response with context
        const userName = user?.displayName || userProfile?.name || user?.email?.split('@')[0] || null
        const aiResponse = await analyzeQueryWithGemini(userMessage, {
          userId: user?.uid,
          userName: userName,
          userRole: userProfile?.role || 'customer',
          userEmail: user?.email,
          conversationHistory: messages.slice(-5) // Last 5 messages for context
        })

        // Remove typing indicator
        setMessages((prev) => prev.filter((msg) => !msg.isTyping))

        // Add AI response
        addMessage({
          senderId: "ai",
          senderRole: "ai",
          message: aiResponse.response,
        })

        // Only add follow-up if there are suggested actions and we can resolve the issue
        if (aiResponse.canResolve && aiResponse.suggestedActions && aiResponse.suggestedActions.length > 0) {
          setTimeout(() => {
            addMessage({
              senderId: "ai",
              senderRole: "ai",
              message: `Here are some specific steps you can try:\n${aiResponse.suggestedActions.map((action: string) => `• ${action}`).join("\n")}\n\nTry these steps and let me know if you need more help!`,
            })
          }, 1500)
        } else if (!aiResponse.canResolve) {
          // Only escalate after trying to help
          setTimeout(() => {
            addMessage({
              senderId: "ai",
              senderRole: "ai",
              message: "I understand this might be a complex issue. Let me try a different approach - can you tell me more details about what exactly happened? This will help me provide better assistance.",
            })
          }, 1500)
          
          // If still can't help after follow-up, then escalate
          setTimeout(() => {
            addMessage({
              senderId: "ai",
              senderRole: "ai",
              message: "I want to make sure you get the best help possible. Let me connect you with one of our customer service specialists who can provide personalized support for your specific situation.",
            })
            setIsEscalated(true)
            if (user) {
              (async () => {
                const ticketData = {
                  customerId: user.uid,
                  subject: aiResponse.escalationReason || "Complex issue requiring specialist",
                  description: userMessage,
                  status: "open",
                  priority: aiResponse.priority || "medium",
                  messages: [
                    {
                      senderId: user.uid,
                      senderRole: "customer",
                      message: userMessage,
                      timestamp: new Date(),
                    },
                  ],
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }
                await createDocument("supportTickets", ticketData)
              })()
            }
            onEscalate?.(aiResponse.escalationReason || "Complex issue requiring specialist")
          }, 8000) // Give more time before escalating
        }
      } catch (error) {
        console.error('AI Support Error:', error)
        setMessages((prev) => prev.filter((msg) => !msg.isTyping))
        
        // Provide helpful fallback instead of immediate escalation
        addMessage({
          senderId: "ai",
          senderRole: "ai",
          message: "I'm experiencing some technical difficulties right now, but I'd still like to help! Here are some common solutions while I get back online:\n\n• Check your order status in 'My Orders' section\n• Visit our FAQ for quick answers\n• Try refreshing the page if something isn't working\n• Contact the vendor directly for product-specific questions\n\nWhat specific issue are you facing? I'll do my best to assist you!",
        })
        
        // Only escalate after trying to help
        setTimeout(() => {
          addMessage({
            senderId: "ai",
            senderRole: "ai",
            message: "If the issue persists, I can connect you with one of our customer service representatives for immediate assistance.",
          })
          
          // Create support ticket for technical error
          if (user) {
            (async () => {
              try {
                const ticketData = {
                  customerId: user.uid,
                  subject: "Technical error in AI system",
                  description: userMessage,
                  status: "open",
                  priority: "medium",
                  messages: [
                    {
                      senderId: user.uid,
                      senderRole: "customer",
                      message: userMessage,
                      timestamp: new Date(),
                    },
                  ],
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }
                await createDocument("supportTickets", ticketData)
                onEscalate?.("Technical error in AI system")
              } catch (ticketError) {
                console.error("Failed to create support ticket:", ticketError)
              }
            })()
          }
        }, 3000)
      } finally {
        setIsLoading(false)
      }
    } else {
      // If escalated, just add the message (human will respond)
      addMessage({
        senderId: "system",
        senderRole: "csa",
        message: "Thank you for your message. A customer service representative will respond shortly.",
      })
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const getMessageIcon = (role: string) => {
    switch (role) {
      case "ai":
        return <Bot className="h-4 w-4" />
      case "customer":
        return <User className="h-4 w-4" />
      default:
        return <MessageCircle className="h-4 w-4" />
    }
  }

  const getMessageBadge = (role: string) => {
    switch (role) {
      case "ai":
        return (
          <Badge variant="secondary" className="text-xs">
            AI Assistant
          </Badge>
        )
      case "csa":
        return (
          <Badge variant="default" className="text-xs">
            Support Agent
          </Badge>
        )
      case "vendor":
        return (
          <Badge variant="outline" className="text-xs">
            Vendor
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <Card className="h-[600px] w-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Customer Support
          {isEscalated && <Badge variant="secondary">Connected to Human Agent</Badge>}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <ScrollArea className="flex-1 px-4 min-h-0" ref={scrollAreaRef}>
          <div className="space-y-4 py-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No messages yet.</div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.id}-${index}`}
                  className={`flex gap-3 ${message.senderRole === "customer" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs">{getMessageIcon(message.senderRole)}</AvatarFallback>
                  </Avatar>

                  <div
                    className={`flex flex-col gap-1 max-w-[70%] min-w-0 ${
                      message.senderRole === "customer" ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getMessageBadge(message.senderRole)}
                      <span className="text-xs text-muted-foreground">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div
                      className={`rounded-lg px-3 py-2 text-sm break-words ${
                        message.senderRole === "customer" ? "bg-accent text-accent-foreground" : "bg-muted"
                      } ${message.isTyping ? "animate-pulse" : ""}`}
                    >
                      {message.isTyping ? (
                        <div className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Typing...</span>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap break-words">{message.message}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4 flex-shrink-0">
          <div className="flex gap-2">
            <Input
              placeholder={isEscalated ? "Type your message to the support agent..." : "Type your message..."}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={!inputMessage.trim() || isLoading} size="icon" className="flex-shrink-0">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
