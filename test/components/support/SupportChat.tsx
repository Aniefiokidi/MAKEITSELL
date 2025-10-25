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
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
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
        setMessages([
          {
            id: "welcome",
            senderId: "ai",
            senderRole: "ai",
            message:
              "Hi! I'm your AI assistant. I'm here to help you with any questions or issues you might have. What can I help you with today?",
            timestamp: new Date(),
          },
        ])
        setInitialized(true)
      }
    }
    fetchMessages()
  }, [ticketId, initialized])

  const addMessage = async (message: Omit<Message, "id" | "timestamp">) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
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
        const aiResponse = await analyzeQueryWithGemini(userMessage, {
          userId: user?.uid,
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

        // If AI can't resolve, escalate
        if (!aiResponse.canResolve) {
          setTimeout(() => {
            addMessage({
              senderId: "ai",
              senderRole: "ai",
              message:
                "I'm connecting you with a human customer service representative who can better assist you with this issue.",
            })
            setIsEscalated(true)
            // Create ticket in Firestore on escalation
            if (user) {
              (async () => {
                const ticketData = {
                  customerId: user.uid,
                  subject: aiResponse.escalationReason || "AI unable to resolve",
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
              })()
            }
            onEscalate?.(aiResponse.escalationReason || "AI unable to resolve")
          }, 2000)
        } else if (aiResponse.suggestedActions) {
          // Add suggested actions
          setTimeout(() => {
            addMessage({
              senderId: "ai",
              senderRole: "ai",
              message: aiResponse.suggestedActions && aiResponse.suggestedActions.length > 0
                ? `Here are some things you can try:\n${aiResponse.suggestedActions.map((action: string) => `• ${action}`).join("\n")}\n\nIs there anything else I can help you with?`
                : "Is there anything else I can help you with?",
            })
          }, 1000)
        }
      } catch (error) {
        setMessages((prev) => prev.filter((msg) => !msg.isTyping))
        addMessage({
          senderId: "ai",
          senderRole: "ai",
          message:
            "I apologize, but I'm experiencing some technical difficulties. Let me connect you with a human representative.",
        })
        setIsEscalated(true)
        // Create ticket in Firestore on escalation
        if (user) {
          (async () => {
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
          })()
        }
        onEscalate?.("Technical error in AI system")
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
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Customer Support
          {isEscalated && <Badge variant="secondary">Connected to Human Agent</Badge>}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
          <div className="space-y-4 py-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No messages yet.</div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.senderRole === "customer" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{getMessageIcon(message.senderRole)}</AvatarFallback>
                  </Avatar>

                  <div
                    className={`flex flex-col gap-1 max-w-[80%] ${
                      message.senderRole === "customer" ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {getMessageBadge(message.senderRole)}
                      <span className="text-xs text-muted-foreground">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div
                      className={`rounded-lg px-3 py-2 text-sm ${
                        message.senderRole === "customer" ? "bg-accent text-accent-foreground" : "bg-muted"
                      } ${message.isTyping ? "animate-pulse" : ""}`}
                    >
                      {message.isTyping ? (
                        <div className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Typing...</span>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{message.message}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              placeholder={isEscalated ? "Type your message to the support agent..." : "Type your message..."}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            <Button onClick={handleSendMessage} disabled={!inputMessage.trim() || isLoading} size="icon">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
