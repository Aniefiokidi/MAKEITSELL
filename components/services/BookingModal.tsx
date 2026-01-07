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
import { useRouter } from "next/navigation"
import { Timestamp } from "firebase/firestore"
import { format } from "date-fns"

interface BookingModalProps {
  service: Service
  isOpen: boolean
  onClose: () => void
}

export default function BookingModal({ service, isOpen, onClose }: BookingModalProps) {
  const { user, userProfile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

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
      const duration = service.duration || 60
      const endMinutes = minute + duration
      const endHour = hour + Math.floor(endMinutes / 60)
      const endMinute = endMinutes % 60
      const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`

      const bookingData = {
        serviceId: service.id!,
        customerId: user.uid,
        customerName: userProfile.displayName,
        customerEmail: userProfile.email,
        customerPhone: phone,
        providerId: service.providerId,
        providerName: service.providerName,
        serviceTitle: service.title,
        bookingDate: Timestamp.fromDate(selectedDate),
        startTime: selectedTime,
        endTime: endTime,
        duration: duration,
        totalPrice: service.price,
        status: "pending" as const,
        locationType: service.locationType as "online" | "home-service" | "store",
        location: service.location,
        notes: notes,
      }

      await createBooking(bookingData)

      toast({
        title: "Booking Confirmed!",
        description: "Your appointment has been booked successfully. The provider will confirm shortly.",
      })

      onClose()
      router.push("/order") // Redirect to bookings page
    } catch (error) {
      console.error("Error creating booking:", error)
      toast({
        title: "Booking Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
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
              <p>Duration: {service.duration || "Variable"} minutes</p>
              <p>Price: ₦{service.price?.toLocaleString('en-NG')}</p>
              <p className="capitalize">Location: {service.locationType.replace("-", " ")}</p>
            </div>
          </div>

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
                <p>Duration: {service.duration || "Variable"} minutes</p>
                <p className="font-semibold text-accent">Total: ₦{service.price?.toLocaleString('en-NG')}</p>
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
