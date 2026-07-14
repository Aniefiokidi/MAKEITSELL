"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search } from "lucide-react"

const PinPickerMap = dynamic(() => import("@/components/tracking/PinPickerMap"), { ssr: false })

type RiderOption = {
  id: string
  name: string
  phone: string
  vehicleType: string
  isActive: boolean
}

type GeocodeResult = {
  label: string
  lat: number
  lng: number
}

interface AssignRiderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  region: "lagos" | "abuja"
  orderId: string
  vendorId?: string
  storeId?: string
  dropoffLocationHint: string
  onAssigned: () => void
}

export default function AssignRiderModal({
  open,
  onOpenChange,
  region,
  orderId,
  vendorId,
  storeId,
  dropoffLocationHint,
  onAssigned,
}: AssignRiderModalProps) {
  const [riders, setRiders] = useState<RiderOption[]>([])
  const [ridersLoading, setRidersLoading] = useState(false)
  const [selectedRiderId, setSelectedRiderId] = useState("")

  const [searchQuery, setSearchQuery] = useState(dropoffLocationHint || "")
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [pin, setPin] = useState<{ lat: number; lng: number; address: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError("")
    setSearchQuery(dropoffLocationHint || "")
    setSearchResults([])
    setPin(null)
    setSelectedRiderId("")

    const fetchRiders = async () => {
      setRidersLoading(true)
      try {
        const response = await fetch(`/api/riders/pool?region=${region}`, { credentials: "include" })
        const result = await response.json().catch(() => ({}))
        setRiders(Array.isArray(result?.riders) ? result.riders : [])
      } catch {
        setRiders([])
      } finally {
        setRidersLoading(false)
      }
    }
    fetchRiders()
  }, [open, region, dropoffLocationHint])

  const runSearch = async () => {
    if (!searchQuery || searchQuery.trim().length < 3) return
    setSearchLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/riders/geocode?region=${region}&q=${encodeURIComponent(searchQuery)}`, {
        credentials: "include",
      })
      const result = await response.json().catch(() => ({}))
      const results = Array.isArray(result?.results) ? result.results : []
      setSearchResults(results)
      if (results.length > 0) {
        setPin({ lat: results[0].lat, lng: results[0].lng, address: results[0].label })
      } else {
        setError("No matches found for that address — search again or try a nearby landmark.")
      }
    } catch {
      setError("Address search failed. Please try again.")
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAssign = async () => {
    if (!selectedRiderId) {
      setError("Select a rider")
      return
    }
    if (!pin) {
      setError("Search for the delivery address and confirm a pin on the map")
      return
    }

    setSubmitting(true)
    setError("")
    try {
      const response = await fetch("/api/riders/assign", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          vendorId,
          storeId,
          region,
          riderId: selectedRiderId,
          destination: { lat: pin.lat, lng: pin.lng, address: pin.address, source: "geocode" },
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to assign rider")
      }
      onAssigned()
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || "Failed to assign rider")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Rider</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="space-y-2">
            <Label>Rider</Label>
            <Select value={selectedRiderId} onValueChange={setSelectedRiderId} disabled={ridersLoading}>
              <SelectTrigger>
                <SelectValue placeholder={ridersLoading ? "Loading riders..." : "Select a rider"} />
              </SelectTrigger>
              <SelectContent>
                {riders.map((rider) => (
                  <SelectItem key={rider.id} value={rider.id}>
                    {rider.name} · {rider.vehicleType} {rider.phone ? `· ${rider.phone}` : ""}
                  </SelectItem>
                ))}
                {riders.length === 0 && !ridersLoading ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No riders registered in this region yet</div>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Delivery address</Label>
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search delivery address"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    runSearch()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={runSearch} disabled={searchLoading}>
                {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {searchResults.length > 1 ? (
              <div className="max-h-28 overflow-y-auto rounded-md border text-xs">
                {searchResults.map((result, idx) => (
                  <button
                    type="button"
                    key={idx}
                    className="block w-full text-left px-2 py-1.5 hover:bg-accent/50"
                    onClick={() => setPin({ lat: result.lat, lng: result.lng, address: result.label })}
                  >
                    {result.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {pin ? (
            <div className="space-y-2">
              <Label>Confirm drop-off pin (drag to adjust)</Label>
              <PinPickerMap
                lat={pin.lat}
                lng={pin.lng}
                onChange={(lat, lng) => setPin((prev) => (prev ? { ...prev, lat, lng } : { lat, lng, address: "" }))}
              />
              <p className="text-xs text-muted-foreground">{pin.address}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Assign Rider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
