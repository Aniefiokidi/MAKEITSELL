"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, MapPin, Phone, Package, RefreshCw, Navigation } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import RetiredFeatureNotice from "@/components/RetiredFeatureNotice"

type RiderAssignment = {
  id: string
  orderId: string
  status: "assigned" | "picked_up" | "en_route" | "arrived" | "delivered"
  destination: { lat: number; lng: number; address?: string }
  trackingToken: string
  pickupLocation: string
  pickupPhone: string
  customerName: string
  customerPhone: string
  totalAmount: number
  items: Array<{ title?: string; quantity?: number; price?: number }>
}

const STATUS_LABELS: Record<string, string> = {
  assigned: "Assigned",
  picked_up: "Picked up",
  en_route: "En route",
  arrived: "Arrived",
  delivered: "Delivered",
}

export default function RiderDashboardPage() {
  // Retired — deliveries are now dispatched and tracked automatically via Shipbubble's
  // own courier network. The custom rider system below is kept in place (not deleted)
  // for a clean revert if ever needed.
  return (
    <RetiredFeatureNotice
      title="Rider dashboard retired"
      message="Deliveries are now handled by Shipbubble's courier network instead of MakeItSell's own riders. This dashboard is no longer in use."
    />
  )

  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [assignments, setAssignments] = useState<RiderAssignment[]>([])
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const latestPositionRef = useRef<{ lat: number; lng: number } | null>(null)

  const fetchAssignments = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/riders/assignments", { credentials: "include" })
      const result = await response.json().catch(() => ({}))

      if (!response.ok || !result?.success) {
        if (response.status === 401) {
          router.push("/login")
          return
        }
        if (response.status === 403) {
          router.push("/")
          return
        }
        throw new Error(result?.error || "Failed to load assignments")
      }

      setAssignments(Array.isArray(result.assignments) ? result.assignments : [])
    } catch (err: any) {
      setError(err?.message || "Failed to load assignments")
    } finally {
      setLoading(false)
    }
  }

  const stopLocationSharing = () => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    latestPositionRef.current = null
    setActiveAssignmentId(null)
  }

  const startLocationSharing = (assignmentId: string) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location sharing is not supported on this device/browser.")
      return
    }

    stopLocationSharing()
    setActiveAssignmentId(assignmentId)

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        latestPositionRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
      },
      (geoError) => {
        console.error("[rider] geolocation error:", geoError)
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )

    const sendPing = async () => {
      const pos = latestPositionRef.current
      if (!pos) return
      try {
        await fetch("/api/riders/location-ping", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pos),
        })
      } catch (pingErr) {
        console.error("[rider] location ping failed:", pingErr)
      }
    }

    intervalRef.current = setInterval(sendPing, 12000)
  }

  const handleStartDelivery = async (assignment: RiderAssignment) => {
    setBusyId(assignment.id)
    setError("")
    try {
      const response = await fetch(`/api/riders/assignments/${assignment.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to start delivery")
      }
      startLocationSharing(assignment.id)
      await fetchAssignments()
    } catch (err: any) {
      setError(err?.message || "Failed to start delivery")
    } finally {
      setBusyId(null)
    }
  }

  const handleMarkDelivered = async (assignment: RiderAssignment) => {
    setBusyId(assignment.id)
    setError("")
    try {
      const response = await fetch(`/api/riders/assignments/${assignment.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delivered" }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to mark delivered")
      }
      if (activeAssignmentId === assignment.id) {
        stopLocationSharing()
      }
      await fetchAssignments()
    } catch (err: any) {
      setError(err?.message || "Failed to mark delivered")
    } finally {
      setBusyId(null)
    }
  }

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    if (user.role !== "rider") {
      router.push("/")
      return
    }

    fetchAssignments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.uid])

  useEffect(() => {
    return () => stopLocationSharing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (authLoading || (user && user!.role !== "rider")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">My Deliveries</h1>
          <p className="text-sm text-muted-foreground mt-1">Orders assigned to you</p>
        </div>
        <Button variant="outline" onClick={fetchAssignments} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {assignments.map((assignment) => (
          <Card key={assignment.id}>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Order ID</p>
                  <p className="font-semibold">{assignment.orderId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{STATUS_LABELS[assignment.status] || assignment.status}</Badge>
                  <Badge>₦{Number(assignment.totalAmount || 0).toLocaleString("en-NG")}</Badge>
                  {activeAssignmentId === assignment.id ? (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Navigation className="h-3 w-3" /> Sharing location
                    </Badge>
                  ) : null}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <p className="font-semibold">Pickup</p>
                  <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5" /> {assignment.pickupLocation}</p>
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {assignment.pickupPhone || "No pickup phone"}</p>
                </div>
                <div className="space-y-2">
                  <p className="font-semibold">Drop-off</p>
                  <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5" /> {assignment.destination?.address || "See map"}</p>
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {assignment.customerPhone || "No customer phone"}</p>
                  <p><span className="text-muted-foreground">Customer:</span> {assignment.customerName}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Package className="h-4 w-4" /> Items</p>
                <div className="space-y-1">
                  {(assignment.items || []).map((item, idx) => (
                    <div key={idx} className="text-sm flex items-center justify-between rounded-md border px-3 py-2">
                      <span>{item?.title || "Item"}</span>
                      <span className="text-muted-foreground">Qty {Number(item?.quantity || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                {assignment.status === "assigned" ? (
                  <Button onClick={() => handleStartDelivery(assignment)} disabled={busyId === assignment.id}>
                    {busyId === assignment.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Start Delivery
                  </Button>
                ) : null}
                {["picked_up", "en_route", "arrived"].includes(assignment.status) ? (
                  <Button variant="secondary" onClick={() => handleMarkDelivered(assignment)} disabled={busyId === assignment.id}>
                    {busyId === assignment.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Mark Delivered
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}

        {assignments.length === 0 && !loading ? (
          <Card>
            <CardHeader>
              <CardTitle>No deliveries yet</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Orders assigned to you will show up here.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
