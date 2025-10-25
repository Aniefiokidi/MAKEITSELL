"use client"

import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, CheckCircle, Clock, Filter, ArrowUp, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import type { SupportTicket } from "@/lib/firestore"

export default function AdminSupportPage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<any[]>([])
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [replyMessage, setReplyMessage] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  // Load tickets from Firestore
  useEffect(() => {
    const loadTickets = async () => {
      try {
        const { getSupportTickets } = await import("@/lib/firestore")
        const { getUserProfile } = await import("@/lib/auth")
        const allTickets = await getSupportTickets()

        // Enrich tickets with user names
        const enrichedTickets = await Promise.all(
          allTickets.map(async (ticket) => {
            const typedTicket = ticket as SupportTicket
            let customerName = "Unknown Customer"
            let vendorName = "Unknown Vendor"

            try {
              if (typedTicket.customerId) {
                const customerProfile = await getUserProfile(typedTicket.customerId)
                customerName = customerProfile?.displayName || "Unknown Customer"
              }
              if (typedTicket.vendorId) {
                const vendorProfile = await getUserProfile(typedTicket.vendorId)
                vendorName = vendorProfile?.displayName || "Unknown Vendor"
              }
            } catch (error) {
              console.error("Error fetching user profile:", error)
            }

            return {
              ...typedTicket,
              customerName,
              vendorName,
              escalatedFrom: typedTicket.vendorId ? "vendor" : "ai", // Simple logic for demo
              escalationReason: typedTicket.vendorId ? "Vendor-customer dispute" : "AI unable to resolve",
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
  }, [])

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

  const getEscalationBadge = (escalatedFrom: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ai: "default",
      vendor: "secondary",
      customer: "outline",
    }
    return (
      <Badge variant={variants[escalatedFrom] || "outline"} className="flex items-center gap-1">
        <ArrowUp className="h-3 w-3" />
        From {escalatedFrom}
      </Badge>
    )
  }

  const handleReply = async (ticketId: string) => {
    if (!replyMessage.trim() || !user) return

    try {
      const { updateSupportTicket } = await import("@/lib/firestore")
      const { Timestamp } = await import("firebase/firestore")

      const newMessage = {
        senderId: user.uid,
        senderRole: "admin" as const,
        message: replyMessage,
        timestamp: Timestamp.now(),
      }

      // Update ticket in Firestore
      const ticket = tickets.find(t => t.id === ticketId)
      if (ticket) {
        const updatedMessages = [...(ticket.messages || []), newMessage]
        await updateSupportTicket(ticketId, {
          messages: updatedMessages,
          status: "in-progress",
        })

        // Update local state
        setTickets((prev) =>
          prev.map((t) => {
            if (t.id === ticketId) {
              return {
                ...t,
                messages: updatedMessages,
                status: "in-progress",
                updatedAt: Timestamp.now(),
              }
            }
            return t
          }),
        )
      }

      setReplyMessage("")
    } catch (error) {
      console.error("Error sending reply:", error)
    }
  }

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const { updateSupportTicket } = await import("@/lib/firestore")

      await updateSupportTicket(ticketId, { status: newStatus as "open" | "in-progress" | "resolved" | "closed" })

      // Update local state
      setTickets((prev) =>
        prev.map((ticket) => {
          if (ticket.id === ticketId) {
            return {
              ...ticket,
              status: newStatus,
            }
          }
          return ticket
        }),
      )
    } catch (error) {
      console.error("Error updating status:", error)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-balance">Support Management</h1>
          <p className="text-muted-foreground">Handle escalated tickets and complex customer issues</p>
        </div>

        <Tabs defaultValue="escalated" className="space-y-6">
          <TabsList>
            <TabsTrigger value="escalated">Escalated Tickets</TabsTrigger>
            <TabsTrigger value="analytics">Support Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="escalated" className="space-y-6">
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
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p>Loading tickets...</p>
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No tickets found.</p>
                ) : (
                  filteredTickets.map((ticket) => (
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
                          <p className="text-sm text-muted-foreground">
                            Customer: {ticket.customerName} • Vendor: {ticket.vendorName}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(ticket.status)}
                          {getPriorityBadge(ticket.priority)}
                          {getEscalationBadge(ticket.escalatedFrom)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
                        <p className="text-xs text-muted-foreground">Escalation reason: {ticket.escalationReason}</p>
                        <div className="text-xs text-muted-foreground">
                          Last updated: {ticket.updatedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                        </div>
                      </div>
                    </CardContent>
                    </Card>
                  ))
                )}
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
                              {selectedTicket.id} • Escalated from {selectedTicket.escalatedFrom}
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
                            <h4 className="font-medium mb-2">Parties Involved</h4>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Customer: {selectedTicket.customerName}</p>
                              <p>Vendor: {selectedTicket.vendorName}</p>
                              <p>Created: {selectedTicket.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}</p>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">Issue Description</h4>
                            <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">Escalation Details</h4>
                            <p className="text-sm text-muted-foreground">{selectedTicket.escalationReason}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Messages */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Conversation History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {selectedTicket.messages.map((message: any, index: number) => (
                            <div
                              key={index}
                              className={`flex ${message.senderRole === "admin" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg p-3 ${
                                  message.senderRole === "admin"
                                    ? "bg-primary text-primary-foreground"
                                    : message.senderRole === "ai"
                                      ? "bg-blue-100 text-blue-900"
                                      : message.senderRole === "vendor"
                                        ? "bg-green-100 text-green-900"
                                        : "bg-muted"
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium capitalize">{message.senderRole}</span>
                                </div>
                                <p className="text-sm">{message.message}</p>
                                <p className="text-xs opacity-70 mt-1">
                                  {message.timestamp?.toDate?.()?.toLocaleString() || message.timestamp?.toLocaleString() || 'Unknown'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Admin Reply Form */}
                        <div className="mt-4 space-y-2">
                          <textarea
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder="Type your admin response..."
                            className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                            rows={3}
                          />
                          <div className="flex justify-end">
                            <Button
                              onClick={() => handleReply(selectedTicket.id)}
                              disabled={!replyMessage.trim()}
                              className="px-4 py-2"
                            >
                              Send Admin Response
                            </Button>
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
            <div className="grid gap-6 md:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Escalated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{tickets.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>From AI</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {tickets.filter((t) => t.escalatedFrom === "ai").length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>From Vendors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {tickets.filter((t) => t.escalatedFrom === "vendor").length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resolved</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-emerald-600">
                    {tickets.filter((t) => t.status === "resolved").length}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
}
