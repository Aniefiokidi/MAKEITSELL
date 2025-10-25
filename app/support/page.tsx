"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import SupportChat from "@/components/support/SupportChat"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { useAuth } from "@/contexts/AuthContext"
import { MessageCircle, Ticket, HelpCircle, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

const issueTypes = [
  "Order Issues",
  "Product Problems",
  "Shipping & Delivery",
  "Payment & Billing",
  "Account Issues",
  "Vendor Issues",
  "Technical Problems",
  "Other",
]

export default function SupportPage() {
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("chat")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    description: "",
    issueType: "",
    priority: "medium",
    orderId: "",
  })

  // State for user's tickets
  const [userTickets, setUserTickets] = useState<any[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  // Load user's tickets
  useEffect(() => {
    const loadTickets = async () => {
      if (user && activeTab === "tickets") {
        setLoadingTickets(true)
        try {
          const { getSupportTickets } = await import("@/lib/firestore")
          const tickets = await getSupportTickets({ customerId: user.uid })
          setUserTickets(tickets)
        } catch (error) {
          console.error("Error loading tickets:", error)
        } finally {
          setLoadingTickets(false)
        }
      }
    }
    loadTickets()
  }, [user, activeTab])

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const { createSupportTicket, createNotification } = await import("@/lib/firestore")
      const { Timestamp } = await import("firebase/firestore")

      const ticketData = {
        customerId: user?.uid!,
        subject: ticketForm.subject,
        description: ticketForm.description,
        status: "open" as const,
        priority: ticketForm.priority as "low" | "medium" | "high" | "urgent",
        messages: [
          {
            senderId: user?.uid!,
            senderRole: "customer" as const,
            message: ticketForm.description,
            timestamp: Timestamp.now(),
          },
        ],
      }

      const ticketId = await createSupportTicket(ticketData)
      console.log("Ticket created with ID:", ticketId)

      // Notify admin/CSA
      await createNotification({
        userId: "admin", // Assuming admin user ID, or broadcast to all admins
        type: "ticket",
        title: "New Support Ticket",
        message: `New ticket: ${ticketForm.subject}`,
        read: false,
        relatedId: ticketId,
      })

      setSubmitSuccess(true)
      setTicketForm({
        subject: "",
        description: "",
        issueType: "",
        priority: "medium",
        orderId: "",
      })

      setTimeout(() => setSubmitSuccess(false), 5000)
    } catch (error) {
      console.error("Error creating ticket:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case "in-progress":
        return <Clock className="h-4 w-4 text-blue-500" />
      case "resolved":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <HelpCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      open: "destructive",
      "in-progress": "default",
      resolved: "secondary",
    }
    return <Badge variant={variants[status] || "outline"}>{status.replace("-", " ")}</Badge>
  }

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "outline",
      medium: "secondary",
      high: "destructive",
      urgent: "destructive",
    }
    return <Badge variant={variants[priority] || "outline"}>{priority}</Badge>
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Customer Support</h1>
              <p className="text-muted-foreground">
                Get help with your orders, products, and account. Our AI assistant is here 24/7, with human support when
                needed.
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Live Chat
                </TabsTrigger>
                <TabsTrigger value="tickets" className="flex items-center gap-2">
                  <Ticket className="h-4 w-4" />
                  My Tickets
                </TabsTrigger>
                <TabsTrigger value="create" className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Create Ticket
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <SupportChat />
                  </div>
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Quick Help</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm">
                          <h4 className="font-medium mb-2">Common Issues:</h4>
                          <ul className="space-y-1 text-muted-foreground">
                            <li>• Order tracking and status</li>
                            <li>• Product returns and refunds</li>
                            <li>• Account and login issues</li>
                            <li>• Payment problems</li>
                          </ul>
                        </div>
                        <div className="text-sm">
                          <h4 className="font-medium mb-2">Response Times:</h4>
                          <ul className="space-y-1 text-muted-foreground">
                            <li>• AI Assistant: Instant</li>
                            <li>• Human Agent: 2-4 hours</li>
                            <li>• Vendor Issues: 24-48 hours</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tickets" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Your Support Tickets</CardTitle>
                    <CardDescription>Track the status of your support requests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingTickets ? (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                        <p>Loading your tickets...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userTickets.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">No tickets found.</p>
                        ) : (
                          userTickets.map((ticket) => (
                            <div key={ticket.id} className="border rounded-lg p-4 space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{ticket.subject}</span>
                                    {getStatusIcon(ticket.status)}
                                  </div>
                                  <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>#{ticket.id}</span>
                                    <span>•</span>
                                    <span>Created {ticket.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}</span>
                                    <span>•</span>
                                    <span>Updated {ticket.updatedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  {getStatusBadge(ticket.status)}
                                  {getPriorityBadge(ticket.priority)}
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t">
                                <span className="text-sm text-muted-foreground">
                                  Assigned to: {ticket.assignedTo || 'Unassigned'}
                                </span>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => router.push(`/support/ticket/${ticket.id}`)}
                                >
                                  View Details
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="create" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Create Support Ticket</CardTitle>
                      <CardDescription>Describe your issue and we'll get you the help you need</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {submitSuccess && (
                        <Alert className="mb-4">
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>
                            Your support ticket has been created successfully! You'll receive updates via email.
                          </AlertDescription>
                        </Alert>
                      )}

                      <form onSubmit={handleTicketSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="issueType">Issue Type *</Label>
                          <Select
                            value={ticketForm.issueType}
                            onValueChange={(value) => setTicketForm((prev) => ({ ...prev, issueType: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select issue type" />
                            </SelectTrigger>
                            <SelectContent>
                              {issueTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="subject">Subject *</Label>
                          <Input
                            id="subject"
                            placeholder="Brief description of your issue"
                            value={ticketForm.subject}
                            onChange={(e) => setTicketForm((prev) => ({ ...prev, subject: e.target.value }))}
                            required
                            disabled={isSubmitting}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="description">Description *</Label>
                          <Textarea
                            id="description"
                            placeholder="Please provide detailed information about your issue..."
                            rows={4}
                            value={ticketForm.description}
                            onChange={(e) => setTicketForm((prev) => ({ ...prev, description: e.target.value }))}
                            required
                            disabled={isSubmitting}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="priority">Priority</Label>
                            <Select
                              value={ticketForm.priority}
                              onValueChange={(value) => setTicketForm((prev) => ({ ...prev, priority: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="orderId">Order ID (Optional)</Label>
                            <Input
                              id="orderId"
                              placeholder="e.g., ORD-12345"
                              value={ticketForm.orderId}
                              onChange={(e) => setTicketForm((prev) => ({ ...prev, orderId: e.target.value }))}
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {isSubmitting ? "Creating Ticket..." : "Create Ticket"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Before Creating a Ticket</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm">
                          <h4 className="font-medium mb-2">Try our AI Chat first:</h4>
                          <p className="text-muted-foreground mb-3">
                            Our AI assistant can instantly help with common issues like order tracking, account
                            problems, and basic troubleshooting.
                          </p>
                          <Button variant="outline" size="sm" onClick={() => setActiveTab("chat")}>
                            Start AI Chat
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">What to Include</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="text-sm space-y-2 text-muted-foreground">
                          <li>• Order number (if applicable)</li>
                          <li>• Screenshots or photos of the issue</li>
                          <li>• Steps you've already tried</li>
                          <li>• When the problem started</li>
                          <li>• Any error messages you received</li>
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  )
}
