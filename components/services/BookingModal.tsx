"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Service, createBooking } from "@/lib/database-client"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { useNotification } from "@/contexts/NotificationContext"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

interface BookingModalProps {
  service: Service
  selectedPackage?: {
    id: string
    name: string
    price: number
    duration?: number
    pricingType?: string
  }
  selectedAddOns?: Array<{
    id: string
    name: string
    pricingType: "fixed" | "percentage"
    amount: number
  }>
  isOpen: boolean
  onClose: () => void
}

export default function BookingModal({ service, selectedPackage, selectedAddOns = [], isOpen, onClose }: BookingModalProps) {
  const { user, userProfile } = useAuth()
  const { toast } = useToast()
  const notification = useNotification()
  const router = useRouter()
  
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [customerLocation, setCustomerLocation] = useState("")
  const [tripDistanceMiles, setTripDistanceMiles] = useState("")
  const [blockedSlots, setBlockedSlots] = useState<string[]>([])

  const basePackagePrice = Number(selectedPackage?.price ?? service.price ?? 0)
  const addOnTotal = selectedAddOns.reduce((sum, addOn) => {
    if (addOn.pricingType === "percentage") {
      return sum + (basePackagePrice * Number(addOn.amount || 0)) / 100
    }
    return sum + Number(addOn.amount || 0)
  }, 0)
  const distanceRatePerMile = Number((service as any)?.distanceRatePerMile || 0)
  const isRentalLikeService = /car|vehicle|rental|hire/i.test(`${service.category || ""} ${service.title || ""} ${(service.tags || []).join(" ")}`)
  const parsedTripDistanceMiles = Number(tripDistanceMiles)
  const tripDistanceFee = distanceRatePerMile > 0 && Number.isFinite(parsedTripDistanceMiles) && parsedTripDistanceMiles > 0
    ? parsedTripDistanceMiles * distanceRatePerMile
    : 0
  const estimatedTotal = Math.max(0, Math.round(basePackagePrice + addOnTotal + tripDistanceFee))

  // Generate available time slots based on service availability
  const getAvailableTimeSlots = () => {
    if (!selectedDate) return []
    
    const dayName = format(selectedDate, "EEEE").toLowerCase()
    const daySchedule = service.availability[dayName as keyof typeof service.availability]
    
    if (!daySchedule || !daySchedule.available) return []
    
    // Generate 30-minute intervals between start and end time
    const slots = []
    const [startHour, startMin] = daySchedule.start.split(":").map(Number)
    const [endHour, endMin] = daySchedule.end.split(":").map(Number)
    
    let currentHour = startHour
    let currentMin = startMin
    
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const timeSlot = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`
      slots.push(timeSlot)
      
      currentMin += 30
      if (currentMin >= 60) {
        currentMin = 0
        currentHour++
      }
    }
    
    if (blockedSlots.length === 0) return slots
    return slots.filter((slot) => !blockedSlots.includes(slot))
  }

  const fetchBlockedSlots = async (date: Date) => {
    try {
      const dateParam = format(date, "yyyy-MM-dd")
      const response = await fetch(
        `/api/database/bookings/availability?providerId=${service.providerId}&serviceId=${service.id}&date=${dateParam}`
      )
      const payload = await response.json()
      if (!payload?.success || !Array.isArray(payload.data)) {
        setBlockedSlots([])
        return
      }

      const blocked = new Set<string>()
      for (const window of payload.data) {
        const [startH, startM] = String(window.startTime || "00:00").split(":").map(Number)
        const [endH, endM] = String(window.endTime || "00:00").split(":").map(Number)
        let cursorMinutes = (startH * 60) + startM
        const endMinutes = (endH * 60) + endM
        while (cursorMinutes < endMinutes) {
          const hours = Math.floor(cursorMinutes / 60)
          const minutes = cursorMinutes % 60
          blocked.add(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`)
          cursorMinutes += 30
        }
      }

      setBlockedSlots(Array.from(blocked))
    } catch {
      setBlockedSlots([])
    }
  }

  const handleBooking = async () => {
    if (!user || !userProfile || !selectedDate || !selectedTime) {
      toast({
        title: "Incomplete Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (isRentalLikeService && distanceRatePerMile > 0) {
      if (!Number.isFinite(parsedTripDistanceMiles) || parsedTripDistanceMiles <= 0) {
        toast({
          title: "Trip Distance Required",
          description: "Enter the expected trip distance to calculate rental pricing.",
          variant: "destructive",
        })
        return
      }
    }

    try {
      setLoading(true)

      // Calculate end time based on service duration
      const [hour, minute] = selectedTime.split(":").map(Number)
      const parsedDuration = Number(selectedPackage?.duration ?? service.duration)
      const duration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 60
      const endMinutes = minute + duration
      const endHour = hour + Math.floor(endMinutes / 60)
      const endMinute = endMinutes % 60
      const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`

      const locationType = service.locationType === "store"
        ? "store"
        : service.locationType === "home-service"
          ? "home-service"
          : service.locationType === "in-person"
            ? "store"
            : "online"

      const bookingData = {
        serviceId: service.id!,
        selectedPackageId: selectedPackage?.id,
        selectedPackageName: selectedPackage?.name,
        selectedAddOns,
        estimatedPrice: estimatedTotal,
        finalPrice: service.requiresQuote ? null : estimatedTotal,
        pricingStatus: service.requiresQuote ? "estimated" : "accepted",
        requiresQuote: Boolean(service.requiresQuote),
        customerLocation,
        tripDistanceMiles: Number.isFinite(parsedTripDistanceMiles) && parsedTripDistanceMiles > 0 ? parsedTripDistanceMiles : undefined,
        cancellationPolicyPercent: 30,
        cancellationWindowHours: 24,
        customerId: user.uid,
        customerName: userProfile.displayName,
        customerEmail: userProfile.email,
        customerPhone: phone,
        providerId: service.providerId,
        providerName: service.providerName,
        serviceTitle: service.title,
        bookingDate: selectedDate, // MongoDB expects a Date object, not Firestore Timestamp
        startTime: selectedTime,
        endTime: endTime,
        duration: duration,
        totalPrice: estimatedTotal,
        status: "pending" as const,
        locationType,
        location: service.location,
        notes: notes,
      }

      await createBooking(bookingData)

      notification.success(
        'Booking Confirmed!',
        "Your appointment has been booked successfully. The provider will confirm shortly. You'll receive email confirmation.",
        4000
      )

      onClose()
      router.push("/appointments") // Redirect to appointments page
    } catch (error: any) {
      console.error("Error creating booking:", error)
      
      // Handle specific error cases
      if (error.message?.includes('time slot is already booked') || error.message?.includes('conflictingBooking')) {
        toast({
          title: "Time Slot Unavailable",
          description: "This time slot is already booked. Please choose a different time.",
          variant: "destructive",
        })
      } else if (error.message?.includes('Missing required fields')) {
        toast({
          title: "Incomplete Information",
          description: "Please fill in all required fields and try again.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Booking Failed", 
          description: error.message || "Something went wrong. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // Filter dates to only show available days
  const isDateAvailable = (date: Date) => {
    const dayName = format(date, "EEEE").toLowerCase()
    const daySchedule = service.availability[dayName as keyof typeof service.availability]
    return daySchedule?.available || false
  }

  const handleDateSelect = (date?: Date) => {
    setSelectedDate(date)
    setSelectedTime("")
    if (date) {
      void fetchBlockedSlots(date)
    } else {
      setBlockedSlots([])
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book Appointment</DialogTitle>
          <DialogDescription>
            Schedule your appointment for {service.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Service Info */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">{service.title}</h4>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>Provider: {service.providerName}</p>
              <p>Package: {selectedPackage?.name || "Standard"}</p>
              <p>Duration: {selectedPackage?.duration || service.duration || "Variable"} minutes</p>
              <p>
                {service.requiresQuote ? "Estimated Total" : "Total"}: ₦{estimatedTotal.toLocaleString('en-NG')}
              </p>
              <p className="capitalize">Location: {service.locationType.replace("-", " ")}</p>
            </div>
          </div>

          {selectedAddOns.length > 0 && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Selected Add-ons</h4>
              <div className="text-sm space-y-1 text-muted-foreground">
                {selectedAddOns.map((addOn) => (
                  <p key={addOn.id}>
                    {addOn.name} ({addOn.pricingType === "percentage" ? `${addOn.amount}%` : `₦${addOn.amount.toLocaleString('en-NG')}`})
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Select Date</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => date < new Date() || !isDateAvailable(date)}
              className="rounded-md border"
            />
          </div>

          {/* Time Selection */}
          {selectedDate && (
            <div className="space-y-2">
              <Label>Select Time</Label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a time slot" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableTimeSlots().map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Contact Information */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {(service.locationType === "home-service" || service.locationType === "store") && (
            <div className="space-y-2">
              <Label htmlFor="customerLocation">Your Location / Address</Label>
              <Input
                id="customerLocation"
                type="text"
                placeholder="Enter city, state or full address"
                value={customerLocation}
                onChange={(e) => setCustomerLocation(e.target.value)}
              />
            </div>
          )}

          {distanceRatePerMile > 0 && isRentalLikeService && (
            <div className="space-y-2">
              <Label htmlFor="tripDistanceMiles">Estimated Trip Distance (miles)</Label>
              <Input
                id="tripDistanceMiles"
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 25"
                value={tripDistanceMiles}
                onChange={(e) => setTripDistanceMiles(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Distance fee rate: ₦{distanceRatePerMile.toLocaleString('en-NG')} per mile
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any special requirements or questions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Summary */}
          {selectedDate && selectedTime && (
            <div className="bg-accent/10 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Booking Summary</h4>
              <div className="text-sm space-y-1">
                <p>Date: {format(selectedDate, "MMMM d, yyyy")}</p>
                <p>Time: {selectedTime}</p>
                <p>Package: {selectedPackage?.name || "Standard"}</p>
                <p>Duration: {selectedPackage?.duration || service.duration || "Variable"} minutes</p>
                <p className="font-semibold text-accent">
                  {service.requiresQuote ? "Estimated Total" : "Total"}: ₦{estimatedTotal.toLocaleString('en-NG')}
                </p>
                {tripDistanceFee > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Includes trip distance fee: ₦{Math.round(tripDistanceFee).toLocaleString('en-NG')}
                  </p>
                )}
                {service.requiresQuote && (
                  <p className="text-xs text-muted-foreground">Final amount will be confirmed by provider before acceptance.</p>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  Cancellation policy: 30% fee applies if cancelled within 24 hours of start time.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBooking}
              className="flex-1"
              disabled={!selectedDate || !selectedTime || !phone || loading || ((service.locationType === "home-service" || service.locationType === "store") && !customerLocation.trim())}
            >
              {loading ? "Booking..." : "Confirm Booking"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
