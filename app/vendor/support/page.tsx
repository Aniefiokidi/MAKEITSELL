"use client"

import { useState, useEffect } from "react"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, CheckCircle, Clock, Filter, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import type { SupportTicket } from "@/lib/firestore"

export default function VendorSupportPage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<any[]>([])
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [replyMessage, setReplyMessage] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  // Load tickets assigned to this vendor
  useEffect(() => {
    const loadTickets = async () => {
      if (!user) return

      try {
        const { getSupportTickets } = await import("@/lib/firestore")
        const { getUserProfile } = await import("@/lib/auth")
        const allTickets = await getSupportTickets()

        // Filter tickets assigned to this vendor
        const vendorTickets = allTickets.filter((ticket: any) => ticket.vendorId === user.uid)

        // Enrich tickets with customer names
        const enrichedTickets = await Promise.all(
          vendorTickets.map(async (ticket: any) => {
            let customerName = "Unknown Customer"

            try {
              if (ticket.customerId) {
                const customerProfile = await getUserProfile(ticket.customerId)
                customerName = customerProfile?.displayName || "Unknown Customer"
              }
            } catch (error) {
              console.error("Error fetching customer profile:", error)
            }

            return {
              ...ticket,
              customerName,
            }
          })
        )

        setTickets(enrichedTickets)
      } catch (error) {
        console.error("Error loading tickets:", error)
      } finally {
        setLoading(false)
      }
    }
    loadTickets()
  }, [user])

  const filteredTickets = tickets.filter((ticket) => {
    const statusMatch = statusFilter === "all" || ticket.status === statusFilter
    const priorityMatch = priorityFilter === "all" || ticket.priority === priorityFilter
    return statusMatch && priorityMatch
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "in-progress":
        return <Clock className="h-4 w-4 text-blue-500" />
      case "resolved":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
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

  const handleReply = (ticketId: string) => {
    if (!replyMessage.trim()) return

    // Add reply to ticket
    setTickets((prev) =>
      prev.map((ticket) => {
        if (ticket.id === ticketId) {
          return {
            ...ticket,
            messages: [
              ...ticket.messages,
              {
                senderId: "vendor_current",
                senderRole: "vendor",
                message: replyMessage,
                timestamp: new Date(),
              },
            ],
            lastUpdate: new Date(),
            status: "in-progress",
          }
        }
        return ticket
      }),
    )

    setReplyMessage("")
  }

  const handleStatusChange = (ticketId: string, newStatus: string) => {
    setTickets((prev) =>
      prev.map((ticket) => {
        if (ticket.id === ticketId) {
          return {
            ...ticket,
            status: newStatus,
            lastUpdate: new Date(),
          }
        }
        return ticket
      }),
    )
  }

  return (
    <VendorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-balance">Customer Support</h1>
          <p className="text-muted-foreground">Manage customer inquiries and support tickets for your products</p>
        </div>

        <Tabs defaultValue="tickets" className="space-y-6">
          <TabsList>
            <TabsTrigger value="tickets">Support Tickets</TabsTrigger>
            <TabsTrigger value="analytics">Support Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filter Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Priority</label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priority</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tickets Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Tickets List */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Support Tickets ({filteredTickets.length})</h2>
                {filteredTickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedTicket?.id === ticket.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(ticket.status)}
                            <span className="font-medium">{ticket.id}</span>
                          </div>
                          <h3 className="font-semibold text-balance">{ticket.subject}</h3>
                          <p className="text-sm text-muted-foreground">Customer: {ticket.customerName}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(ticket.status)}
                          {getPriorityBadge(ticket.priority)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Product: {ticket.productName}</span>
                          <span>Order: {ticket.orderId}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Last updated: {ticket.lastUpdate.toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Ticket Details */}
              <div className="space-y-4">
                {selectedTicket ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">Ticket Details</h2>
                      <Select
                        value={selectedTicket.status}
                        onValueChange={(value) => handleStatusChange(selectedTicket.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Card>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-balance">{selectedTicket.subject}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {selectedTicket.id} • Customer: {selectedTicket.customerName}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {getStatusBadge(selectedTicket.status)}
                            {getPriorityBadge(selectedTicket.priority)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Order Details</h4>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Order ID: {selectedTicket.orderId}</p>
                              <p>Product: {selectedTicket.productName}</p>
                              <p>Created: {selectedTicket.createdAt.toLocaleDateString()}</p>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">Description</h4>
                            <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Messages */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Conversation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {selectedTicket.messages.map((message: any, index: number) => (
                            <div
                              key={index}
                              className={`flex ${message.senderRole === "vendor" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg p-3 ${
                                  message.senderRole === "vendor" ? "bg-primary text-primary-foreground" : "bg-muted"
                                }`}
                              >
                                <p className="text-sm">{message.message}</p>
                                <p className="text-xs opacity-70 mt-1">{message.timestamp.toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Reply Form */}
                        <div className="mt-4 space-y-2">
                          <textarea
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder="Type your reply..."
                            className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                            rows={3}
                          />
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleReply(selectedTicket.id)}
                              disabled={!replyMessage.trim()}
                              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
                            >
                              Send Reply
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="flex items-center justify-center h-64">
                      <p className="text-muted-foreground">Select a ticket to view details</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Open Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">
                    {tickets.filter((t) => t.status === "open").length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>In Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {tickets.filter((t) => t.status === "in-progress").length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resolved</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {tickets.filter((t) => t.status === "resolved").length}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </VendorLayout>
  )
}
