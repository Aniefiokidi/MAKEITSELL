"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { Send, Bot, User, Loader2, ThumbsUp, ThumbsDown } from "lucide-react"

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i, arr) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/)
    const rendered = parts.map((part, j) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={j}>{part.slice(2, -2)}</strong>
        : <span key={j}>{part}</span>
    )
    return (
      <span key={i}>
        {rendered}
        {i < arr.length - 1 && <br />}
      </span>
    )
  })
}

interface Message {
  id: string
  senderId: string
  senderRole: "customer" | "vendor" | "csa" | "admin" | "ai"
  message: string
  timestamp: Date
  isTyping?: boolean
  feedback?: "up" | "down" | null
}

interface SupportChatProps {
  ticketId?: string
  onEscalate?: (reason: string) => void
}

const QUICK_TOPICS = [
  { emoji: "📦", label: "Track my order" },
  { emoji: "💳", label: "Payment issue" },
  { emoji: "↩️", label: "Returns & refunds" },
  { emoji: "🏪", label: "Become a seller" },
  { emoji: "🛠️", label: "Book a service" },
  { emoji: "👤", label: "Account help" },
]

export default function SupportChat({ ticketId, onEscalate }: SupportChatProps) {
  const { user, userProfile } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [initialized, setInitialized] = useState(false)
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isEscalated, setIsEscalated] = useState(false)
  const [messageCounter, setMessageCounter] = useState(0)
  const [suggestedActions, setSuggestedActions] = useState<string[]>([])
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 50)
    return () => clearTimeout(timer)
  }, [messages, scrollToBottom])

  // Scroll input into view when keyboard opens on mobile
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => scrollToBottom()
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [scrollToBottom])

  useEffect(() => {
    const fetchMessages = async () => {
      if (ticketId) {
        try {
          const res = await fetch(`/api/support/ticket/${ticketId}`)
          const ticket = await res.json()
          if (ticket && Array.isArray(ticket.messages) && ticket.messages.length > 0) {
            setMessages(ticket.messages.map((msg: any) => ({ ...msg, timestamp: new Date(msg.timestamp) })))
          } else {
            setMessages([])
          }
        } catch {
          setMessages([])
        }
      } else if (!initialized) {
        const userName = user?.displayName || userProfile?.name || user?.email?.split('@')[0] || 'there'
        setMessages([
          {
            id: "welcome",
            senderId: "ai",
            senderRole: "ai",
            message: `Hi ${userName}! 👋 I'm the MakeItSell support assistant.\n\nI understand English, Pidgin, and broken sentences — just type however you're comfortable. What can I help you with?`,
            timestamp: new Date(),
          },
        ])
        setInitialized(true)
      }
    }
    fetchMessages()
  }, [ticketId, initialized, user, userProfile])

  const addMessage = async (message: Omit<Message, "id" | "timestamp">) => {
    setMessageCounter(prev => prev + 1)
    const newMessage: Message = {
      ...message,
      id: `${Date.now()}-${messageCounter}`,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, newMessage])

    if (ticketId) {
      try {
        await fetch(`/api/support/ticket/${ticketId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newMessage),
        })
      } catch { /* silent */ }
    }
  }

  const handleQuickReply = (text: string) => {
    setSuggestedActions([])
    handleSendMessage(text)
  }

  const handleSendMessage = async (overrideMessage?: string) => {
    const userMessage = (overrideMessage || inputMessage).trim()
    if (!userMessage || isLoading) return

    if (!overrideMessage) setInputMessage("")
    setSuggestedActions([])

    addMessage({
      senderId: user?.uid || "anonymous",
      senderRole: "customer",
      message: userMessage,
    })

    if (!isEscalated) {
      setIsLoading(true)

      addMessage({
        senderId: "ai",
        senderRole: "ai",
        message: "typing",
        isTyping: true,
      })

      try {
        const userName = user?.displayName || userProfile?.name || user?.email?.split('@')[0] || undefined
        const aiRes = await fetch("/api/support/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: userMessage,
            context: {
              userId: user?.uid,
              userName,
              userRole: userProfile?.role || "customer",
              userEmail: user?.email,
              conversationHistory: messages.filter(m => !m.isTyping).slice(-10),
            },
          }),
        })
        const aiResponse = await aiRes.json()

        setMessages((prev) => prev.filter((msg) => !msg.isTyping))

        addMessage({
          senderId: "ai",
          senderRole: "ai",
          message: aiResponse.response,
        })

        if (aiResponse.suggestedActions && aiResponse.suggestedActions.length > 0) {
          setSuggestedActions(aiResponse.suggestedActions.slice(0, 4))
        }

        if (!aiResponse.canResolve) {
          setTimeout(() => {
            addMessage({
              senderId: "ai",
              senderRole: "ai",
              message: "This looks like something I need more details on. Can you tell me exactly what happened? I want to make sure you get the right help.",
            })
          }, 1500)

          setTimeout(() => {
            (async () => {
              addMessage({
                senderId: "ai",
                senderRole: "ai",
                message: "Let me connect you with one of our customer service specialists who can access your account directly and resolve this for you.",
              })
              setIsEscalated(true)
              if (user) {
                await fetch(`/api/support/ticket`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    customerId: user.uid,
                    subject: aiResponse.escalationReason || "Issue requiring specialist",
                    description: userMessage,
                    status: "open",
                    priority: aiResponse.priority || "medium",
                    messages: [{ senderId: user.uid, senderRole: "customer", message: userMessage, timestamp: new Date() }],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  }),
                })
              }
              onEscalate?.(aiResponse.escalationReason || "Issue requiring specialist")
            })()
          }, 8000)
        }
      } catch (error) {
        console.error('AI Support Error:', error)
        setMessages((prev) => prev.filter((msg) => !msg.isTyping))

        addMessage({
          senderId: "ai",
          senderRole: "ai",
          message: "I'm having a small technical issue right now, but I still want to help!\n\n• Check your order in **My Orders** section\n• For payment issues, Paystack usually resolves in 24hrs\n• Try refreshing the page if something isn't loading\n\nWhat exactly is the issue? Tell me more and I'll do my best.",
        })
      } finally {
        setIsLoading(false)
      }
    } else {
      addMessage({
        senderId: "system",
        senderRole: "csa",
        message: "Message received. A customer service representative will respond shortly.",
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const isWelcomeOnly = messages.length === 1 && messages[0].id === "welcome"

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0 bg-card">
        <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">MakeItSell Support</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            {isEscalated ? "Connected to human agent" : "AI · responds instantly"}
          </p>
        </div>
        {isEscalated && (
          <span className="text-[10px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 shrink-0 font-medium">
            LIVE AGENT
          </span>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 px-3 sm:px-4" ref={scrollAreaRef}>
        <div className="space-y-3 py-4">
          {messages.map((message, index) => {
            const isUser = message.senderRole === "customer"
            const isAI = message.senderRole === "ai"
            // Only show "AI Assistant" label on first AI message after a user message
            const showLabel = isAI && !message.isTyping && (index === 0 || messages[index - 1]?.senderRole === "customer")

            return (
              <div key={`${message.id}-${index}`}>
                <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-auto mb-4 ${
                    isUser ? "bg-accent/15" : "bg-accent/10"
                  }`}>
                    {isAI
                      ? <Bot className="h-3.5 w-3.5 text-accent" />
                      : <User className="h-3.5 w-3.5 text-accent" />
                    }
                  </div>

                  <div className={`flex flex-col gap-0.5 max-w-[78%] min-w-0 ${isUser ? "items-end" : "items-start"}`}>
                    {showLabel && (
                      <span className="text-[10px] text-muted-foreground font-medium px-1 mb-0.5">
                        AI Assistant
                      </span>
                    )}

                    {/* Bubble */}
                    <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? "bg-accent text-white rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm"
                    } ${message.isTyping ? "animate-pulse" : ""}`}>
                      {message.isTyping ? (
                        <div className="flex items-center gap-1 py-0.5 px-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms] opacity-70" />
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms] opacity-70" />
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms] opacity-70" />
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap break-words">{renderMarkdown(message.message)}</div>
                      )}
                    </div>

                    {/* Timestamp + feedback */}
                    <div className={`flex items-center gap-1 px-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                      <span className="text-[10px] text-muted-foreground">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isAI && !message.isTyping && (
                        <>
                          <button
                            type="button"
                            title="Helpful"
                            onClick={() => setMessages(prev => prev.map(m => m.id === message.id ? { ...m, feedback: "up" } : m))}
                            className={`p-0.5 rounded transition-colors ${message.feedback === "up" ? "text-green-600" : "text-muted-foreground/40 hover:text-green-600"}`}
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            title="Not helpful"
                            onClick={() => setMessages(prev => prev.map(m => m.id === message.id ? { ...m, feedback: "down" } : m))}
                            className={`p-0.5 rounded transition-colors ${message.feedback === "down" ? "text-red-500" : "text-muted-foreground/40 hover:text-red-500"}`}
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Welcome quick-topic grid — only under the first welcome message */}
                {message.id === "welcome" && isWelcomeOnly && (
                  <div className="grid grid-cols-3 gap-2 mt-3 ml-9">
                    {QUICK_TOPICS.map((topic) => (
                      <button
                        key={topic.label}
                        type="button"
                        onClick={() => handleQuickReply(topic.label)}
                        className="flex flex-col items-start gap-1 p-2.5 rounded-xl border bg-background hover:border-accent/50 hover:bg-accent/5 text-left transition-all active:scale-95"
                      >
                        <span className="text-base leading-none">{topic.emoji}</span>
                        <span className="text-[11px] font-medium text-foreground leading-tight">{topic.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Suggested action chips — shown after AI responds */}
      {suggestedActions.length > 0 && !isLoading && !isWelcomeOnly && (
        <div className="px-3 sm:px-4 pt-2 pb-1 flex flex-wrap gap-1.5 border-t bg-muted/20 shrink-0">
          {suggestedActions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleQuickReply(action)}
              className="text-xs px-3 py-1.5 rounded-full border border-accent/30 text-accent bg-accent/5 hover:bg-accent hover:text-white transition-colors active:scale-95"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        className="border-t px-3 sm:px-4 pt-3 pb-3 shrink-0"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder={isEscalated ? "Message support agent..." : "Ask me anything — English or Pidgin..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1 rounded-full text-sm"
            onFocus={() => {
              // Scroll messages to bottom when keyboard opens
              setTimeout(scrollToBottom, 350)
            }}
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            size="icon"
            className="rounded-full shrink-0 bg-accent hover:bg-accent/90"
          >
            {isLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </Button>
        </div>
      </div>
    </div>
  )
}
