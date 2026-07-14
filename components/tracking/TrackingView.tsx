"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

const LeafletTrackingMap = dynamic(() => import("@/components/tracking/LeafletTrackingMap"), { ssr: false })

type TrackingData = {
  status: string
  orderShortId: string
  riderName: string
  riderLocation: { lat: number; lng: number; updatedAt: string } | null
  destination: { lat: number; lng: number; address?: string }
  etaMinutes: number | null
}

const STATUS_LABELS: Record<string, string> = {
  assigned: "Rider assigned",
  picked_up: "Order picked up",
  en_route: "On the way",
  arrived: "Rider has arrived",
  delivered: "Delivered",
}

const POLLING_STATUSES = new Set(["picked_up", "en_route"])

export default function TrackingView({ trackingToken }: { trackingToken: string }) {
  const [data, setData] = useState<TrackingData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/track/${trackingToken}`)
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Tracking link not found")
      }
      setData(result)
      setError("")

      if (!POLLING_STATUSES.has(result.status) && intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load tracking info")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    intervalRef.current = setInterval(fetchStatus, 12000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingToken])

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="pt-6 text-sm text-destructive">{error || "Tracking link not found"}</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Order #{data.orderShortId}</h1>
          <p className="text-sm text-muted-foreground">{data.riderName}</p>
        </div>
        <Badge variant="outline">{STATUS_LABELS[data.status] || data.status}</Badge>
      </div>

      {data.etaMinutes != null && POLLING_STATUSES.has(data.status) ? (
        <p className="text-sm">
          <span className="font-semibold">Estimated arrival:</span> ~{data.etaMinutes} min
          <span className="text-xs text-muted-foreground"> (straight-line estimate, actual time may vary with traffic)</span>
        </p>
      ) : null}

      <LeafletTrackingMap riderPosition={data.riderLocation} destination={data.destination} />

      {data.destination.address ? (
        <p className="text-sm text-muted-foreground">Delivering to: {data.destination.address}</p>
      ) : null}
    </div>
  )
}
