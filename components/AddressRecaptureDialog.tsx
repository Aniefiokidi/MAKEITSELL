"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NIGERIA_STATE_CITY_OPTIONS, NIGERIA_STATES } from "@/lib/nigeria-locations"

export default function AddressRecaptureDialog() {
  const { user, userProfile } = useAuth()
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState("")
  const [state, setState] = useState("")
  const [city, setCity] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const availableCities = useMemo(() => {
    return state ? (NIGERIA_STATE_CITY_OPTIONS[state] || []) : []
  }, [state])

  useEffect(() => {
    if (!user || !userProfile) return

    if (userProfile.role !== "customer" && userProfile.role !== "vendor") return

    const existingAddress = String(userProfile.address || "").trim()
    const existingState = String(userProfile.state || "").trim()
    const existingCity = String(userProfile.city || "").trim()

    // Legacy/manual address users: have address text but missing structured location.
    const requiresRecapture = Boolean(existingAddress) && (!existingState || !existingCity)

    if (!requiresRecapture) return

    setAddress(existingAddress)
    setState(existingState)
    setCity(existingCity)
    setOpen(true)
  }, [user, userProfile])

  const handleSave = async () => {
    setError("")

    const trimmedAddress = address.trim()
    if (!trimmedAddress || !state || !city) {
      setError("Please provide your full address, state, and city.")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/user/address-recapture", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: trimmedAddress,
          state,
          city,
        }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to save address details")
      }

      setOpen(false)
      window.location.reload()
    } catch (err: any) {
      setError(err?.message || "Failed to save address details")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Update Your Address Details</DialogTitle>
          <DialogDescription>
            To keep delivery pricing accurate, confirm your address using the state and city fields below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="recaptureAddress">Address</Label>
            <Input
              id="recaptureAddress"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter your address"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="recaptureState">State</Label>
              <Select
                value={state}
                onValueChange={(value) => {
                  setState(value)
                  setCity("")
                }}
                disabled={saving}
              >
                <SelectTrigger id="recaptureState">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {NIGERIA_STATES.map((stateName) => (
                    <SelectItem key={stateName} value={stateName}>{stateName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recaptureCity">City</Label>
              <Select
                value={city}
                onValueChange={setCity}
                disabled={saving || !state}
              >
                <SelectTrigger id="recaptureCity">
                  <SelectValue placeholder={state ? "Select city" : "Select state first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableCities.map((cityName) => (
                    <SelectItem key={cityName} value={cityName}>{cityName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Note: this update is required to apply the correct shipping fee calculation.
          </p>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving..." : "Save Address Details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
