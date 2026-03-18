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

  const basePackagePrice = Number(selectedPackage?.price ?? service.price ?? 0)
  const addOnTotal = selectedAddOns.reduce((sum, addOn) => {
    if (addOn.pricingType === "percentage") {
      return sum + (basePackagePrice * Number(addOn.amount || 0)) / 100
    }
    return sum + Number(addOn.amount || 0)
  }, 0)
  const estimatedTotal = Math.max(0, Math.round(basePackagePrice + addOnTotal))

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
    
    return slots
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
              onSelect={setSelectedDate}
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
                {service.requiresQuote && (
                  <p className="text-xs text-muted-foreground">Final amount will be confirmed by provider before acceptance.</p>
                )}
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
              disabled={!selectedDate || !selectedTime || !phone || loading}
            >
              {loading ? "Booking..." : "Confirm Booking"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
