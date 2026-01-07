"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
// import { getDocument } from "@/lib/firestore"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, ArrowLeft, Ticket, User, Calendar, AlertCircle, CheckCircle, Clock, MessageSquare } from "lucide-react"

export default function SupportTicketDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchTicket = async () => {
      if (user && id) {
        setLoading(true)
        try {
          // TODO: Replace with API call to fetch ticket from MongoDB
          // Example stub:
          // const result = await fetch(`/api/support/ticket/${id}`).then(res => res.json())
          // if (result && result.customerId === user.uid) {
          //   setTicket(result)
          // } else {
          //   router.push("/support")
          // }
        } catch (error) {
          console.error("Error fetching ticket:", error)
          router.push("/support")
        } finally {
          setLoading(false)
        }
      }
    }
    fetchTicket()
  }, [user, id, router])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="default" className="bg-blue-500"><Clock className="h-3 w-3 mr-1" />Open</Badge>
      case "in-progress":
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />In Progress</Badge>
      case "resolved":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>
      case "closed":
        return <Badge variant="outline">Closed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "low":
        return <Badge variant="outline" className="bg-gray-100">Low</Badge>
      case "medium":
        return <Badge variant="secondary">Medium</Badge>
      case "high":
        return <Badge variant="destructive">High</Badge>
      default:
        return <Badge variant="outline">{priority}</Badge>
    }
  }

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reply.trim()) return

    setSubmitting(true)
    // TODO: Implement reply functionality with Firestore
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert("Reply functionality will be implemented with Firestore subcollection for ticket messages")
    setReply("")
    setSubmitting(false)
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="container mx-auto px-4 py-12 min-h-screen">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
        <Footer />
      </>
    )
  }

  if (!ticket) {
    return (
      <>
        <Header />
        <main className="container mx-auto px-4 py-12 min-h-screen">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Ticket not found</p>
            <Button onClick={() => router.push("/support")} className="mt-4">
              Back to Support
            </Button>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-12 min-h-screen">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/support")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Ticket className="h-8 w-8" />
                  Support Ticket
                </h1>
                <p className="text-muted-foreground">Ticket #{ticket.id?.slice(0, 8)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {getStatusBadge(ticket.status)}
              {getPriorityBadge(ticket.priority)}
            </div>
          </div>

          {/* Ticket Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{ticket.subject}</span>
                <Badge variant="outline">{ticket.issueType}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Created: {ticket.createdAt?.toDate?.()?.toLocaleDateString() || "N/A"}
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Updated: {ticket.updatedAt?.toDate?.()?.toLocaleDateString() || "N/A"}
                </span>
              </div>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Order ID</span>
                  <p className="font-medium">{ticket.orderId || "N/A"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Assigned To</span>
                  <p className="font-medium">{ticket.assignedTo || "Unassigned"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Response/Notes Section */}
          {ticket.response && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Support Response
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-muted-foreground mb-1">Support Team</p>
                  <p className="whitespace-pre-wrap">{ticket.response}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reply Form (only if ticket is not closed) */}
          {ticket.status !== "closed" && (
            <Card>
              <CardHeader>
                <CardTitle>Add Reply</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleReplySubmit} className="space-y-4">
                  <Textarea
                    placeholder="Type your message here..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={submitting || !reply.trim()}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Reply"
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => router.push("/support")}>
                      Back to Support
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {ticket.status === "closed" && (
            <Card className="border-muted">
              <CardContent className="py-6">
                <p className="text-center text-muted-foreground">
                  This ticket is closed. If you need further assistance, please create a new support ticket.
                </p>
                <div className="flex justify-center mt-4">
                  <Button onClick={() => router.push("/support")}>
                    Back to Support
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
