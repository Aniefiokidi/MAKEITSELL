"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import { Calendar, Clock, MapPin, User, MessageSquare, CheckCircle, AlertCircle, XCircle } from "lucide-react"
import { format } from "date-fns"

interface Appointment {
  id: string
  serviceId: string
  serviceTitle: string
  providerName: string
  bookingDate: Date
  startTime: string
  endTime: string
  duration: number
  totalPrice: number
  status: "pending" | "confirmed" | "completed" | "cancelled"
  location: string
  locationType: "online" | "in-person" | "both"
  notes?: string
  customerPhone?: string
}

export default function AppointmentsPage() {
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed" | "cancelled">("upcoming")

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }
    fetchAppointments()
  }, [user, router])

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/database/bookings?customerId=${user?.uid}`)
      const data = await response.json()
      if (data.success) {
        setAppointments(data.data)
      }
    } catch (error) {
      console.error("Error fetching appointments:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAppointments = appointments.filter((apt) => {
    if (filter === "all") return true
    if (filter === "upcoming") {
      return apt.status === "pending" || apt.status === "confirmed"
    }
    return apt.status === filter
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "pending":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case "completed":
        return <CheckCircle className="h-5 w-5 text-blue-500" />
      case "cancelled":
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "completed":
        return "bg-blue-100 text-blue-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-accent/5">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8 p-6 md:p-8 bg-gradient-to-br from-accent/5 via-accent/15 to-accent/50 backdrop-blur-2xl rounded-3xl border border-accent/30 shadow-2xl shadow-accent/20 hover:shadow-3xl hover:shadow-accent/30 transition-all duration-500">
          <div className="text-center md:text-left">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-2 text-accent dark:text-white/70" style={{ 
              fontFamily: '"Bebas Neue", "Impact", sans-serif',
              textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))'
            }}>
              YOUR APPOINTMENTS
            </h1>
            <p className="text-accent dark:text-white/70 text-sm sm:text-base md:text-lg">
              Manage and track all your service appointments in one place
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-3 mb-8 ">
          {(["all", "upcoming", "completed", "cancelled"] as const).map((tab) => (
            <Button
              key={tab}
              variant={filter === tab ? "default" : "outline"}
              onClick={() => setFilter(tab)}
              className={`capitalize transition-all ${
                filter === tab 
                  ? "bg-accent text-white/90 hover:bg-white/90 hover:text-accent border-accent/30" 
                  : "border-accent/30"
              }`}
            >
              {tab === "upcoming" ? "Upcoming & Confirmed" : tab}
            </Button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-40 bg-muted" />
              </Card>
            ))}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Calendar className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-2xl font-bold mb-2">No Appointments Yet</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                {filter === "upcoming"
                  ? "You don't have any upcoming appointments. Browse services and book one today!"
                  : `You don't have any ${filter} appointments.`}
              </p>
              <Button onClick={() => router.push("/services")} size="lg" className="bg-accent text-white/90 hover:bg-white/90 hover:text-accent border-accent/30 transition-all">
                Browse Services
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {filteredAppointments.map((appointment) => (
              <Card
                key={appointment.id}
                className="overflow-hidden hover:shadow-lg transition-shadow border-l-4"
                style={{
                  borderLeftColor:
                    appointment.status === "confirmed"
                      ? "#22c55e"
                      : appointment.status === "pending"
                        ? "#eab308"
                        : appointment.status === "completed"
                          ? "#3b82f6"
                          : "#ef4444",
                }}
              >
                <CardHeader className="pb-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-3">
                        <h3 className="text-2xl font-bold text-accent">{appointment.serviceTitle}</h3>
                        <Badge className={getStatusColor(appointment.status)}>
                          <span className="inline-flex items-center gap-1">
                            {getStatusIcon(appointment.status)}
                            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                          </span>
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mb-2">
                        With <span className="font-semibold text-foreground">{appointment.providerName}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-accent">₦{appointment.totalPrice.toLocaleString()}</div>
                      <p className="text-sm text-muted-foreground">{appointment.duration} mins</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Appointment Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Date & Time */}
                    <div className="flex items-start gap-3 p-4 bg-accent/5 rounded-lg">
                      <Calendar className="h-5 w-5 text-accent mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Date</p>
                        <p className="text-lg font-bold">
                          {format(new Date(appointment.bookingDate), "MMM dd, yyyy")}
                        </p>
                      </div>
                    </div>

                    {/* Time Slot */}
                    <div className="flex items-start gap-3 p-4 bg-accent/5 rounded-lg">
                      <Clock className="h-5 w-5 text-accent mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Time</p>
                        <p className="text-lg font-bold">
                          {appointment.startTime} - {appointment.endTime}
                        </p>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-start gap-3 p-4 bg-accent/5 rounded-lg">
                      <MapPin className="h-5 w-5 text-accent mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Location</p>
                        <p className="text-lg font-bold capitalize">{appointment.locationType}</p>
                        {appointment.location && (
                          <p className="text-sm text-muted-foreground">{appointment.location}</p>
                        )}
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="flex items-start gap-3 p-4 bg-accent/5 rounded-lg">
                      <User className="h-5 w-5 text-accent mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Contact</p>
                        {appointment.customerPhone && (
                          <p className="text-lg font-bold">{appointment.customerPhone}</p>
                        )}
                        <p className="text-sm text-muted-foreground truncate">
                          {userProfile?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {appointment.notes && (
                    <div className="p-4 bg-card border border-border rounded-lg">
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Notes</p>
                      <p className="text-foreground">{appointment.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => router.push(`/service/${appointment.serviceId}`)}
                    >
                      <MapPin className="h-4 w-4" />
                      View Service
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        /* TODO: Open messaging modal */
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Message Provider
                    </Button>
                    {appointment.status === "confirmed" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          /* TODO: Cancel appointment */
                        }}
                      >
                        Cancel Appointment
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
