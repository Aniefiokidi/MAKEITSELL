"use client"

import { useEffect, useState } from "react"
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

const BOOKING_FEE_NAIRA = 500

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
  const [checkInDate, setCheckInDate] = useState("")
  const [checkOutDate, setCheckOutDate] = useState("")
  const [roomsCount, setRoomsCount] = useState("1")
  const [adultsCount, setAdultsCount] = useState("2")
  const [childrenCount, setChildrenCount] = useState("0")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [customerLocation, setCustomerLocation] = useState("")
  const [tripDistanceMiles, setTripDistanceMiles] = useState("")
  const [blockedSlots, setBlockedSlots] = useState<string[]>([])
  const [stayAvailability, setStayAvailability] = useState<{
    totalRooms: number
    bookedRooms: number
    remainingRooms: number
    isBookedOut: boolean
  } | null>(null)

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
  const locationType = service.locationType === "store"
    ? "store"
    : service.locationType === "home-service"
      ? "home-service"
      : service.locationType === "in-person"
        ? "store"
        : "online"
  const isOnlineService = locationType === "online"
  const isStoreService = locationType === "store"
  const isHomeService = locationType === "home-service"
  const hasHourlyPricing = (selectedPackage?.pricingType || service.pricingType) === "hourly"
  const hasSessionPricing = (selectedPackage?.pricingType || service.pricingType) === "per-session"
  const isHospitalityService = service.category === "hospitality" || Array.isArray((service as any)?.hospitalityDetails?.roomTypes)
  const parsedRoomsCount = Number.parseInt(roomsCount || "1", 10)
  const parsedAdultsCount = Number.parseInt(adultsCount || "0", 10)
  const parsedChildrenCount = Number.parseInt(childrenCount || "0", 10)
  const safeRoomsCount = Number.isFinite(parsedRoomsCount) && parsedRoomsCount > 0 ? parsedRoomsCount : 1
  const checkInDateValue = checkInDate ? new Date(checkInDate) : null
  const checkOutDateValue = checkOutDate ? new Date(checkOutDate) : null
  const nightlyNights = checkInDateValue && checkOutDateValue
    ? Math.max(1, Math.ceil((checkOutDateValue.getTime() - checkInDateValue.getTime()) / (1000 * 60 * 60 * 24)))
    : 1
  const hospitalityTotal = Math.max(0, Math.round((basePackagePrice + addOnTotal) * nightlyNights * safeRoomsCount))
  const computedTotal = isHospitalityService ? hospitalityTotal : estimatedTotal

  const blockedSlotSet = new Set(blockedSlots)

  // Generate provider schedule slots for the selected date.
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

  const fetchStayAvailability = async (checkIn: string, checkOut: string) => {
    if (!service?.providerId || !service?.id || !selectedPackage?.id || !checkIn || !checkOut) {
      setStayAvailability(null)
      return
    }

    try {
      const response = await fetch(
        `/api/database/bookings/availability?providerId=${service.providerId}&serviceId=${service.id}&roomTypeId=${selectedPackage.id}&checkInDate=${checkIn}&checkOutDate=${checkOut}`
      )
      const payload = await response.json()
      if (!payload?.success || !payload?.stayAvailability) {
        setStayAvailability(null)
        return
      }
      setStayAvailability(payload.stayAvailability)
    } catch {
      setStayAvailability(null)
    }
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

      const blockedList = Array.from(blocked)
      setBlockedSlots(blockedList)
      if (selectedTime && blocked.has(selectedTime)) {
        setSelectedTime("")
      }
    } catch {
      setBlockedSlots([])
    }
  }

  const handleBooking = async () => {
    if (!user || !userProfile) {
      toast({
        title: "Incomplete Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (!isHospitalityService && (!selectedDate || !selectedTime)) {
      toast({
        title: "Incomplete Information",
        description: "Please select booking date and time",
        variant: "destructive",
      })
      return
    }

    if (isHospitalityService) {
      if (!checkInDate || !checkOutDate) {
        toast({
          title: "Stay Dates Required",
          description: "Select check-in and check-out dates to continue.",
          variant: "destructive",
        })
        return
      }

      if (!checkInDateValue || !checkOutDateValue || checkOutDateValue <= checkInDateValue) {
        toast({
          title: "Invalid Stay Dates",
          description: "Check-out date must be after check-in date.",
          variant: "destructive",
        })
        return
      }

      if (!Number.isFinite(parsedAdultsCount) || parsedAdultsCount < 1) {
        toast({
          title: "Guest Details Required",
          description: "Add at least one adult guest.",
          variant: "destructive",
        })
        return
      }

      if (stayAvailability?.isBookedOut) {
        toast({
          title: "Room Fully Booked",
          description: "Selected room type is fully booked for those dates.",
          variant: "destructive",
        })
        return
      }

      if (stayAvailability && safeRoomsCount > stayAvailability.remainingRooms) {
        toast({
          title: "Insufficient Rooms",
          description: `Only ${stayAvailability.remainingRooms} room(s) available for selected dates.`,
          variant: "destructive",
        })
        return
      }
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
      const [hour, minute] = (isHospitalityService ? "14:00" : selectedTime).split(":").map(Number)
      const parsedDuration = Number(selectedPackage?.duration ?? service.duration)
      const duration = isHospitalityService
        ? nightlyNights * 24 * 60
        : (Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 60)
      const endTime = isHospitalityService
        ? ((service as any)?.hospitalityDetails?.checkOutTime || "12:00")
        : (() => {
            const endMinutes = minute + duration
            const endHour = hour + Math.floor(endMinutes / 60)
            const endMinute = endMinutes % 60
            return `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`
          })()

      const bookingData = {
        serviceId: service.id!,
        selectedPackageId: selectedPackage?.id,
        selectedPackageName: selectedPackage?.name,
        selectedAddOns,
        estimatedPrice: computedTotal,
        finalPrice: service.requiresQuote ? null : computedTotal,
        pricingStatus: service.requiresQuote ? "estimated" : "accepted",
        requiresQuote: Boolean(service.requiresQuote),
        customerLocation,
        tripDistanceMiles: Number.isFinite(parsedTripDistanceMiles) && parsedTripDistanceMiles > 0 ? parsedTripDistanceMiles : undefined,
        cancellationPolicyPercent: 30,
        cancellationWindowHours: 24,
        bookingFeeAmount: BOOKING_FEE_NAIRA,
        customerId: user.uid,
        customerName: userProfile.displayName,
        customerEmail: userProfile.email,
        customerPhone: phone,
        providerId: service.providerId,
        providerName: service.providerName,
        serviceTitle: service.title,
        bookingDate: isHospitalityService && checkInDateValue ? checkInDateValue : selectedDate,
        startTime: isHospitalityService ? ((service as any)?.hospitalityDetails?.checkInTime || "14:00") : selectedTime,
        endTime: endTime,
        duration: duration,
        totalPrice: computedTotal,
        status: "pending" as const,
        locationType,
        location: service.location,
        notes: notes,
        stayDetails: isHospitalityService && checkInDateValue && checkOutDateValue
          ? {
              checkInDate: checkInDateValue,
              checkOutDate: checkOutDateValue,
              nights: nightlyNights,
              roomTypeId: selectedPackage?.id,
              roomTypeName: selectedPackage?.name,
              rooms: safeRoomsCount,
              adults: parsedAdultsCount,
              children: Number.isFinite(parsedChildrenCount) ? parsedChildrenCount : 0,
              guests: parsedAdultsCount + (Number.isFinite(parsedChildrenCount) ? parsedChildrenCount : 0),
              pricePerNight: basePackagePrice,
            }
          : undefined,
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

      if (!isHospitalityService && selectedDate) {
        void fetchBlockedSlots(selectedDate)
      }
      if (isHospitalityService && checkInDate && checkOutDate) {
        void fetchStayAvailability(checkInDate, checkOutDate)
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

  const availableTimeSlots = selectedDate ? getAvailableTimeSlots() : []
  const openTimeSlots = availableTimeSlots.filter((slot) => !blockedSlotSet.has(slot))

  useEffect(() => {
    if (isHospitalityService && checkInDate && checkOutDate) {
      void fetchStayAvailability(checkInDate, checkOutDate)
    } else {
      setStayAvailability(null)
    }
    // selectedPackage id affects room type inventory.
  }, [isHospitalityService, checkInDate, checkOutDate, selectedPackage?.id])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book Appointment</DialogTitle>
          <DialogDescription>
            {isHospitalityService ? `Reserve your stay at ${service.title}` : `Schedule your appointment for ${service.title}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Service Info */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">{service.title}</h4>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>Provider: {service.providerName}</p>
              <p>Package: {selectedPackage?.name || "Standard"}</p>
              <p>Duration: {isHospitalityService ? `${nightlyNights} night(s)` : `${selectedPackage?.duration || service.duration || "Variable"} minutes`}</p>
              <p>
                {service.requiresQuote ? "Estimated Total" : "Total"}: ₦{computedTotal.toLocaleString('en-NG')}
              </p>
              <p className="capitalize">Location: {service.locationType.replace("-", " ")}</p>
            </div>
          </div>

          <div className="bg-accent/5 border border-accent/20 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Booking Type Details</h4>
            <div className="text-sm space-y-1 text-muted-foreground">
              {isOnlineService && (
                <>
                  <p>This is an online service. Meeting details are shared after provider confirmation.</p>
                  <p>Ensure your phone number is active for updates.</p>
                </>
              )}
              {isStoreService && (
                <>
                  <p>This is a store/in-person appointment.</p>
                  <p>Bring any required items and arrive 10 minutes early.</p>
                </>
              )}
              {isHomeService && (
                <>
                  <p>This is a home-service appointment. Your full service address is required.</p>
                  <p>Provider arrival may vary with traffic and distance.</p>
                </>
              )}
              {hasHourlyPricing && <p>Pricing type: hourly. Final charge is based on booked duration.</p>}
              {hasSessionPricing && <p>Pricing type: per session. Price applies per booked session.</p>}
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

          {!isHospitalityService && (
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
          )}

          {!isHospitalityService && selectedDate && (
            <div className="space-y-2">
              <Label>Select Time</Label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a time slot" />
                </SelectTrigger>
                <SelectContent className="z-1400">
                  {availableTimeSlots.map((slot) => (
                    <SelectItem key={slot} value={slot} disabled={blockedSlotSet.has(slot)}>
                      {slot}{blockedSlotSet.has(slot) ? " (Booked)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableTimeSlots.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No available time slots for the selected date. Please pick another date.
                </p>
              )}
              {availableTimeSlots.length > 0 && openTimeSlots.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  All slots are currently booked for this date.
                </p>
              )}
            </div>
          )}

          {isHospitalityService && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="checkInDate">Check-in Date</Label>
                <Input
                  id="checkInDate"
                  type="date"
                  value={checkInDate}
                  min={format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => setCheckInDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOutDate">Check-out Date</Label>
                <Input
                  id="checkOutDate"
                  type="date"
                  value={checkOutDate}
                  min={checkInDate || format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roomsCount">Number of Rooms</Label>
                <Input
                  id="roomsCount"
                  type="number"
                  min="1"
                  value={roomsCount}
                  onChange={(e) => setRoomsCount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adultsCount">Adults</Label>
                <Input
                  id="adultsCount"
                  type="number"
                  min="1"
                  value={adultsCount}
                  onChange={(e) => setAdultsCount(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="childrenCount">Children</Label>
                <Input
                  id="childrenCount"
                  type="number"
                  min="0"
                  value={childrenCount}
                  onChange={(e) => setChildrenCount(e.target.value)}
                />
              </div>

              {checkInDate && checkOutDate && stayAvailability && (
                <div className="md:col-span-2 rounded-md border border-accent/30 bg-accent/5 p-3 text-sm">
                  <p className="font-medium">Room Availability</p>
                  <p className="text-muted-foreground">
                    {stayAvailability.remainingRooms} of {stayAvailability.totalRooms} room(s) available for selected dates.
                  </p>
                  {stayAvailability.isBookedOut && (
                    <p className="text-red-600 text-xs mt-1">This room type is fully booked for the selected stay dates.</p>
                  )}
                </div>
              )}
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

          {(isHomeService || isStoreService) && (
            <div className="space-y-2">
              <Label htmlFor="customerLocation">
                {isHomeService ? "Your Full Service Address" : "Preferred Visit Area / Landmark"}
              </Label>
              <Input
                id="customerLocation"
                type="text"
                placeholder={isHomeService ? "Enter your full address" : "Enter area or nearest landmark"}
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
          {((!isHospitalityService && selectedDate && selectedTime) || (isHospitalityService && checkInDate && checkOutDate)) && (
            <div className="bg-accent/10 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Booking Summary</h4>
              <div className="text-sm space-y-1">
                {!isHospitalityService && (
                  <>
                    <p>Date: {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "-"}</p>
                    <p>Time: {selectedTime}</p>
                  </>
                )}
                {isHospitalityService && (
                  <>
                    <p>Check-in: {checkInDateValue ? format(checkInDateValue, "MMMM d, yyyy") : "-"}</p>
                    <p>Check-out: {checkOutDateValue ? format(checkOutDateValue, "MMMM d, yyyy") : "-"}</p>
                    <p>Nights: {nightlyNights}</p>
                    <p>Rooms: {safeRoomsCount}</p>
                    <p>Guests: {parsedAdultsCount} adult(s), {Number.isFinite(parsedChildrenCount) ? parsedChildrenCount : 0} child(ren)</p>
                  </>
                )}
                <p>Package: {selectedPackage?.name || "Standard"}</p>
                <p>Duration: {isHospitalityService ? `${nightlyNights} night(s)` : `${selectedPackage?.duration || service.duration || "Variable"} minutes`}</p>
                <p className="font-semibold text-accent">
                  {service.requiresQuote ? "Estimated Total" : "Total"}: ₦{computedTotal.toLocaleString('en-NG')}
                </p>
                <p>Booking fee (charged now): ₦{BOOKING_FEE_NAIRA.toLocaleString('en-NG')}</p>
                {tripDistanceFee > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Includes trip distance fee: ₦{Math.round(tripDistanceFee).toLocaleString('en-NG')}
                  </p>
                )}
                {service.requiresQuote && (
                  <p className="text-xs text-muted-foreground">Final amount will be confirmed by provider before acceptance.</p>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  Cancellation policy: 30% cancellation fee applies when you cancel within 24 hours of start time.
                </p>
                <p className="text-xs text-muted-foreground">
                  Booking fee of ₦{BOOKING_FEE_NAIRA.toLocaleString('en-NG')} is charged at booking confirmation.
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
              disabled={
                loading
                || !phone
                || ((isHomeService || isStoreService) && !customerLocation.trim())
                || (!isHospitalityService && (!selectedDate || !selectedTime))
                || (isHospitalityService && (!checkInDate || !checkOutDate))
                || (isHospitalityService && Boolean(stayAvailability?.isBookedOut))
                || (isHospitalityService && Boolean(stayAvailability) && safeRoomsCount > Number(stayAvailability?.remainingRooms || 0))
              }
            >
              {loading ? "Booking..." : "Confirm Booking"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
