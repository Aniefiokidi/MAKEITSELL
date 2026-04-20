"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog"
// import { getServiceById, Service, createConversation, getConversations } from "@/lib/database"
import type { Service } from "@/lib/database-client"
import { useAuth } from "@/contexts/AuthContext"
import { ArrowLeft, MapPin, Clock, DollarSign, Calendar, MessageCircle, CheckCircle, X, ChevronLeft, ChevronRight, Star, Hotel, Building2, Truck, Music2, Camera, Briefcase } from "lucide-react"
import BookingModal from "@/components/services/BookingModal"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { buildPublicServicePath, extractEntityIdFromParam } from "@/lib/public-links"

export default function ServiceDetailPage() {
    // Slide-out state for page transition
    const [slideOut, setSlideOut] = useState(false);

    // Back to services with slide right
    const handleBackToServices = () => {
      setSlideOut(true);
      setTimeout(() => {
        router.push('/services');
      }, 600);
    };
  const params = useParams()
  const rawServiceParam = String(params.id || "")
  const serviceId = extractEntityIdFromParam(rawServiceParam)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, userProfile } = useAuth()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  const [messagingProvider, setMessagingProvider] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [quickMessage, setQuickMessage] = useState("")
  const [sendingQuickMessage, setSendingQuickMessage] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [modalImageIndex, setModalImageIndex] = useState(0)
  const [selectedPackageId, setSelectedPackageId] = useState<string>("")
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([])
  const [previewCheckInDate, setPreviewCheckInDate] = useState("")
  const [previewCheckOutDate, setPreviewCheckOutDate] = useState("")
  const [previewStayAvailability, setPreviewStayAvailability] = useState<{
    totalRooms: number
    bookedRooms: number
    remainingRooms: number
    isBookedOut: boolean
  } | null>(null)
  const [loadingPreviewAvailability, setLoadingPreviewAvailability] = useState(false)

  const toDateInputValue = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
    const fetchService = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/database/services/${serviceId}`)
        if (!res.ok) throw new Error("Failed to fetch service")
        const json = await res.json()
        setService(json.data)

        if (json?.data?.publicSlug && rawServiceParam !== json.data.publicSlug) {
          router.replace(buildPublicServicePath(json.data), { scroll: false })
        }

        const packages = (json.data?.packageOptions || []).filter((pkg: any) => pkg?.active !== false)
        const requestedPackageId = searchParams.get("package") || ""
        const defaultPackage = packages.find((pkg: any) => pkg?.isDefault) || packages[0]
        const packageToUse = packages.find((pkg: any) => pkg.id === requestedPackageId) || defaultPackage
        if (packageToUse?.id) {
          setSelectedPackageId(packageToUse.id)
        } else if (defaultPackage?.id) {
          setSelectedPackageId(defaultPackage.id)
        }

        const requestedAddOns = (searchParams.get("addons") || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
        if (requestedAddOns.length > 0) {
          setSelectedAddOnIds(requestedAddOns)
        }
      } catch (error) {
        console.error("Error fetching service:", error)
      } finally {
        setLoading(false)
      }
    }
    if (serviceId) fetchService()
  }, [serviceId, searchParams])

  const handleMessageProvider = () => {
    if (!user || !userProfile) {
      router.push("/login")
      return
    }
    setShowMessageModal(true)
  }

  const handleSendQuickMessage = async () => {
    if (!quickMessage.trim() || !service || !user || !userProfile) return
    setSendingQuickMessage(true)
    try {
      // Check if conversation exists
      const res = await fetch(`/api/database/conversations?userId=${user.uid}&role=customer`)
      const json = await res.json()
      let conversationId = null
      let existingConv = (json.data || []).find(
        (conv: any) => conv.providerId === service.providerId && conv.serviceId === service.id
      )
      if (!existingConv) {
        // Create new conversation
        const conversationData = {
          customerId: user.uid,
          customerName: userProfile.displayName,
          providerId: service.providerId,
          providerName: service.providerName,
          serviceId: service.id,
          storeName: service.providerName,
          storeImage: service.providerImage,
          lastMessage: quickMessage.trim(),
          lastMessageTime: new Date(),
          unreadCount: 0,
        }
        const createRes = await fetch(`/api/database/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(conversationData),
        })
        const createJson = await createRes.json()
        conversationId = createJson.data?.id
      } else {
        conversationId = existingConv.id
      }
      // Send message
      await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          senderId: user.uid,
          senderName: userProfile.displayName,
          senderRole: "customer",
          receiverId: service.providerId,
          message: quickMessage.trim(),
          read: false,
        }),
      })
      setQuickMessage("")
      setShowMessageModal(false)
    } catch (error) {
      console.error("Error sending quick message:", error)
    } finally {
      setSendingQuickMessage(false)
    }
  }

  const activePackages = (service?.packageOptions || []).filter((pkg: any) => pkg?.active !== false)
  const hospitalityRoomTypes = Array.isArray((service as any)?.hospitalityDetails?.roomTypes)
    ? (service as any).hospitalityDetails.roomTypes.filter((room: any) => room?.active !== false)
    : []
  const isHospitalityService = service?.category === "hospitality" || hospitalityRoomTypes.length > 0
  const normalizedCategory = String(service?.category || "").toLowerCase()
  const hospitalityPropertyType = String((service as any)?.hospitalityDetails?.propertyType || service?.subcategory || "").toLowerCase()
  const isApartmentStay = isHospitalityService && /apartment|short-let/.test(hospitalityPropertyType)
  const hospitalityLabel = isApartmentStay ? "Apartment" : "Hotel"
  const serviceFamily: "hospitality" | "event" | "logistics" | "creative" | "general" = isHospitalityService
    ? "hospitality"
    : normalizedCategory === "event-planning"
      ? "event"
      : normalizedCategory === "logistics"
        ? "logistics"
        : ["photography", "design", "beauty"].includes(normalizedCategory)
          ? "creative"
          : "general"
  const selectedPackage = activePackages.find((pkg: any) => pkg.id === selectedPackageId)
    || activePackages.find((pkg: any) => pkg.isDefault)
    || activePackages[0]
  const selectedRoomType = hospitalityRoomTypes.find((room: any) => room.id === selectedPackage?.id)
    || hospitalityRoomTypes.find((room: any) => room.isDefault)
    || hospitalityRoomTypes[0]

  const activeAddOns = (service?.addOnOptions || []).filter((addOn: any) => addOn?.active !== false)
  const selectedAddOns = activeAddOns.filter((addOn: any) => selectedAddOnIds.includes(addOn.id))
  const serviceRequirements = (() => {
    if (!service) return [] as string[]

    const requirements: string[] = []
    const locationType = String(service.locationType || "")
    const category = String(service.category || "")

    if (isHospitalityService) {
      requirements.push("Provide a valid ID for every adult guest at check-in.")
      requirements.push("Confirm guest count and stay dates before completing your booking.")
      requirements.push(`Observe ${hospitalityLabel.toLowerCase()} check-in and check-out schedule for smoother arrival.`)
    }

    if (locationType === "home-service") {
      requirements.push("Share clear address and access instructions for the provider.")
    }

    if (locationType === "online") {
      requirements.push("Ensure stable internet and preferred meeting platform details are ready.")
    }

    if (category === "photography") {
      requirements.push("Prepare your preferred style references, locations, and shot list.")
    }

    if (category === "event-planning") {
      requirements.push("Have your event date, guest estimate, and venue details available.")
    }

    if (category === "logistics") {
      requirements.push("Prepare pickup/drop-off details and recipient contact in advance.")
    }

    if (service.requiresQuote) {
      requirements.push("Final amount is confirmed by provider quote approval before booking acceptance.")
    }

    if (!isHospitalityService && !requirements.length) {
      requirements.push("Review package scope, timing, and location details before booking.")
    }

    return requirements.slice(0, 6)
  })()
  const serviceWorkflow = (() => {
    if (!service) return [] as string[]

    if (serviceFamily === "event") {
      return [
        "Share event date, type, and estimated guest count.",
        "Align package scope, timeline, and deliverables.",
        "Confirm execution checklist and final coordination details.",
      ]
    }

    if (serviceFamily === "logistics") {
      return [
        "Provide pickup and drop-off addresses with contact persons.",
        "Confirm package type, quantity, and special handling notes.",
        "Track execution and delivery confirmation after dispatch.",
      ]
    }

    if (serviceFamily === "creative") {
      return [
        "Share references, style expectations, and preferred outcome.",
        "Confirm package inclusions and delivery timeline.",
        "Review output, request adjustments, and close project.",
      ]
    }

    if (serviceFamily === "hospitality") {
      return [
        "Select room option and confirm your stay dates.",
        "Verify guest details and check-in requirements.",
        "Complete reservation and receive booking confirmation.",
      ]
    }

    return [
      "Pick a package that matches your need and budget.",
      "Confirm timing, location, and any optional add-ons.",
      "Book and coordinate details with the provider.",
    ]
  })()

  const experienceTitle = {
    hospitality: `${hospitalityLabel} Booking Flow`,
    event: "Event Delivery Flow",
    logistics: "Delivery Execution Flow",
    creative: "Creative Service Flow",
    general: "Service Booking Flow",
  }[serviceFamily]

  const experienceSubtitle = {
    hospitality: "Professional reservation steps for a smooth stay experience.",
    event: "Plan, align, and execute your event without missed details.",
    logistics: "Structured dispatch workflow for reliable delivery outcomes.",
    creative: "From brief to final output with clear collaboration steps.",
    general: "A streamlined path from inquiry to confirmed booking.",
  }[serviceFamily]

  const sidebarHint = {
    hospitality: `Tip: ${hospitalityLabel} reservations are confirmed faster when guest count and dates are complete.`,
    event: "Tip: Include event timeline and venue details for faster planning response.",
    logistics: "Tip: Add exact pickup and drop-off instructions to avoid delays.",
    creative: "Tip: Share references and expected quality level before booking.",
    general: "Tip: Provide complete notes upfront to reduce back-and-forth.",
  }[serviceFamily]

  const responseHours = Number((service as any)?.quoteSlaHours || 24)
  const completedJobs = Number((service as any)?.completedBookings || 0)
  const cancellationPolicyPercent = Number((service as any)?.cancellationPolicyPercent || 30)
  const cancellationWindowHours = Number((service as any)?.cancellationWindowHours || 24)
  const trustTier = service?.featured ? "Premium Verified" : "Verified Provider"
  const updatedAtDate = service?.updatedAt ? new Date(service.updatedAt) : null
  const lastUpdatedLabel = updatedAtDate && !Number.isNaN(updatedAtDate.getTime())
    ? updatedAtDate.toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })
    : "Recently"

  const familyTheme = {
    hospitality: {
      overlay: "from-slate-950/85 via-cyan-900/35 to-transparent",
      chip: "bg-cyan-500/20 text-cyan-100 border-cyan-200/40",
      featured: "bg-cyan-500 text-cyan-950",
      panel: "border-cyan-200/40 from-cyan-500/8 via-background to-background",
      iconWrap: "bg-cyan-500/20 border-cyan-200/40",
      iconColor: "text-cyan-100",
    },
    event: {
      overlay: "from-slate-950/85 via-fuchsia-900/35 to-transparent",
      chip: "bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-200/40",
      featured: "bg-fuchsia-500 text-fuchsia-50",
      panel: "border-fuchsia-200/40 from-fuchsia-500/8 via-background to-background",
      iconWrap: "bg-fuchsia-500/20 border-fuchsia-200/40",
      iconColor: "text-fuchsia-100",
    },
    logistics: {
      overlay: "from-slate-950/85 via-emerald-900/35 to-transparent",
      chip: "bg-emerald-500/20 text-emerald-100 border-emerald-200/40",
      featured: "bg-emerald-500 text-emerald-950",
      panel: "border-emerald-200/40 from-emerald-500/8 via-background to-background",
      iconWrap: "bg-emerald-500/20 border-emerald-200/40",
      iconColor: "text-emerald-100",
    },
    creative: {
      overlay: "from-slate-950/85 via-amber-900/35 to-transparent",
      chip: "bg-amber-500/20 text-amber-100 border-amber-200/40",
      featured: "bg-amber-500 text-amber-950",
      panel: "border-amber-200/40 from-amber-500/8 via-background to-background",
      iconWrap: "bg-amber-500/20 border-amber-200/40",
      iconColor: "text-amber-100",
    },
    general: {
      overlay: "from-slate-950/85 via-indigo-900/35 to-transparent",
      chip: "bg-indigo-500/20 text-indigo-100 border-indigo-200/40",
      featured: "bg-indigo-500 text-indigo-50",
      panel: "border-indigo-200/40 from-indigo-500/8 via-background to-background",
      iconWrap: "bg-indigo-500/20 border-indigo-200/40",
      iconColor: "text-indigo-100",
    },
  }[serviceFamily]

  const FamilyIcon =
    serviceFamily === "hospitality"
      ? (isApartmentStay ? Building2 : Hotel)
      : serviceFamily === "event"
        ? Music2
        : serviceFamily === "logistics"
          ? Truck
          : serviceFamily === "creative"
            ? Camera
            : Briefcase

    const selectedPackageImages = Array.isArray(selectedPackage?.images) ? selectedPackage.images : []
    const displayedImages = selectedPackageImages.length > 0
      ? selectedPackageImages
      : (service?.images || [])

    useEffect(() => {
      if (selectedImage >= displayedImages.length) {
        setSelectedImage(0)
      }
    }, [displayedImages.length, selectedImage])

  useEffect(() => {
    if (!isHospitalityService) {
      setPreviewStayAvailability(null)
      return
    }

    if (!previewCheckInDate || !previewCheckOutDate) {
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)
      const dayAfter = new Date(today)
      dayAfter.setDate(today.getDate() + 2)
      setPreviewCheckInDate(toDateInputValue(tomorrow))
      setPreviewCheckOutDate(toDateInputValue(dayAfter))
    }
  }, [isHospitalityService, previewCheckInDate, previewCheckOutDate])

  useEffect(() => {
    const fetchPreviewAvailability = async () => {
      if (!isHospitalityService || !service?.id || !service?.providerId || !selectedPackage?.id || !previewCheckInDate || !previewCheckOutDate) {
        setPreviewStayAvailability(null)
        return
      }

      setLoadingPreviewAvailability(true)
      try {
        const response = await fetch(
          `/api/database/bookings/availability?providerId=${service.providerId}&serviceId=${service.id}&roomTypeId=${selectedPackage.id}&checkInDate=${previewCheckInDate}&checkOutDate=${previewCheckOutDate}`
        )
        const payload = await response.json()
        if (!response.ok || !payload?.success || !payload?.stayAvailability) {
          setPreviewStayAvailability(null)
          return
        }
        setPreviewStayAvailability(payload.stayAvailability)
      } catch {
        setPreviewStayAvailability(null)
      } finally {
        setLoadingPreviewAvailability(false)
      }
    }

    void fetchPreviewAvailability()
  }, [isHospitalityService, service?.id, service?.providerId, selectedPackage?.id, previewCheckInDate, previewCheckOutDate])

  const estimatedTotal = (() => {
    if (!service) return 0
    const basePrice = Number(selectedPackage?.price ?? service.price ?? 0)
    const addOnTotal = selectedAddOns.reduce((sum: number, addOn: any) => {
      const amount = Number(addOn.amount || 0)
      if (addOn.pricingType === "percentage") {
        return sum + (basePrice * amount) / 100
      }
      return sum + amount
    }, 0)
    return Math.max(0, Math.round(basePrice + addOnTotal))
  })()

  const getPriceDisplay = () => {
    if (!service) return ""
    const priceTypeMap = {
      fixed: "",
      hourly: "/hr",
      "per-session": "/session",
      custom: "",
    }
    const activePkg = selectedPackage || activePackages[0]
    if (service.requiresQuote) {
      return `From ₦${Number(activePkg?.price ?? service.price ?? 0).toLocaleString('en-NG')}`
    }
    if (isHospitalityService) {
      const nightlyPrice = Number(selectedRoomType?.pricePerNight ?? activePkg?.price ?? service.price ?? 0)
      return `₦${nightlyPrice.toLocaleString('en-NG')}/night`
    }
    const displayPrice = Number(activePkg?.price ?? service.price ?? 0)
    return `₦${displayPrice.toLocaleString('en-NG')}${priceTypeMap[(activePkg?.pricingType || service.pricingType) as keyof typeof priceTypeMap] || ''}`
  }

  const getLocationTypeLabel = (locationType: string) => {
    const labels = {
      "online": "Online Service",
      "home-service": "Home Service (I visit you)",
      "store": "Visit Store/Office"
    }
    return labels[locationType as keyof typeof labels] || locationType
  }

  const getAvailabilityDays = () => {
    if (!service) return []
    return Object.entries(service.availability || {})
      .filter(([_, value]: [string, any]) => value.available)
      .map(([day]) => day.charAt(0).toUpperCase() + day.slice(1))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-96 bg-muted rounded-lg" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="h-8 bg-muted rounded w-3/4" />
                <div className="h-32 bg-muted rounded" />
              </div>
              <div className="h-64 bg-muted rounded" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!service) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Service not found</h1>
          <Button onClick={() => router.push("/services")} className="hover:bg-accent/80 hover:scale-105 transition-all hover:shadow-lg">Browse Services</Button>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col bg-background main-slide-anim${slideOut ? ' slide-out-right' : ''}`}>
      <style jsx global>{`
        .main-slide-anim {
          transition: transform 0.6s cubic-bezier(.7,1.7,.7,1), opacity 0.6s;
        }
        .slide-out-right {
          transform: translateX(100vw);
          opacity: 0.7;
        }
      `}</style>
      <Header />
      
      {/* Full Width Banner Section - matching store style */}
      <div className="relative w-full h-[500px] overflow-hidden">
        {/* Service Image Banner */}
        <img
          src={displayedImages.length > 0 ? displayedImages[selectedImage] : "/placeholder.svg"}
          alt={service.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Gradient Overlay */}
        <div className={`absolute inset-0 bg-linear-to-t ${familyTheme.overlay}`} style={{ zIndex: 2 }} />
        
        {/* Bottom Fade to White */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-background to-transparent" style={{ zIndex: 3 }} />
        
        {/* Content Overlay */}
        <div className="absolute inset-0 flex flex-col justify-end" style={{ zIndex: 4 }}>
          <div className="container mx-auto px-4 pb-8">
            {/* Back Button */}
            <Button
              variant="ghost"
              className="mb-4 text-white hover:bg-white/20 hover:scale-105 backdrop-blur-sm transition-all"
              onClick={handleBackToServices}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Services
            </Button>

            <div className="flex items-end justify-between gap-8">
              <div className="text-white">
                <h1 className="text-4xl md:text-5xl font-bold mb-2">{service.title}</h1>
                <p className="text-lg text-white/90 mb-4">{service.providerName}</p>
                <div className="flex flex-wrap gap-2">
                  {isHospitalityService && (
                    <Badge className={`${familyTheme.chip} border capitalize`}>
                      {hospitalityLabel} stay
                    </Badge>
                  )}
                  {!isHospitalityService && (
                    <Badge className={`${familyTheme.chip} border capitalize`}>
                      {serviceFamily} service
                    </Badge>
                  )}
                </div>
              </div>

              <div className={`hidden md:flex h-14 w-14 rounded-2xl border items-center justify-center backdrop-blur-sm ${familyTheme.iconWrap}`}>
                <FamilyIcon className={`h-7 w-7 ${familyTheme.iconColor}`} />
              </div>
              
              {service.featured && (
                <Badge className={`${familyTheme.featured} px-4 py-2 text-lg`}>
                  Featured
                </Badge>
              )}
            </div>

            {/* Click to view full size button - more visible with animation */}
            <div className="mt-6 animate-bounce">
              <Button
                onClick={() => {
                  if (displayedImages.length > 0) {
                    setModalImageIndex(selectedImage)
                    setShowImageModal(true)
                  }
                }}
                className="bg-white/20 backdrop-blur-md text-white border-2 border-white/40 hover:bg-white/30 hover:border-white/60 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl px-6 py-3 text-base font-semibold"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
                Click to View Full Size Images
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Image Thumbnails */}
        {displayedImages.length > 1 && (
          <div className="mb-8 animate-scale-in">
            <h3 className="text-lg font-semibold mb-3">Gallery</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {displayedImages.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                    selectedImage === index ? "border-accent ring-2 ring-accent/50" : "border-gray-200"
                  }`}
                >
                  <img src={img} alt={`${service.title} ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        <Card className={`mb-8 bg-linear-to-br ${familyTheme.panel}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">{experienceTitle}</CardTitle>
            <CardDescription>{experienceSubtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {serviceWorkflow.map((step, index) => (
                <div key={`workflow-step-${index}`} className="rounded-lg border bg-background/90 p-4">
                  <p className="text-xs font-semibold text-accent mb-2">Step {index + 1}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {isHospitalityService && hospitalityRoomTypes.length > 0 && (
          <div className="mb-8 space-y-3">
            <h3 className="text-lg font-semibold">{hospitalityLabel} Options</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="border-accent/20 bg-accent/5">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Property type</p>
                  <p className="font-semibold capitalize">{hospitalityPropertyType.replace(/-/g, " ") || hospitalityLabel}</p>
                </CardContent>
              </Card>
              <Card className="border-accent/20 bg-accent/5">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Check-in / Check-out</p>
                  <p className="font-semibold">
                    {(service as any)?.hospitalityDetails?.checkInTime || "14:00"} / {(service as any)?.hospitalityDetails?.checkOutTime || "12:00"}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-accent/20 bg-accent/5">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Total rooms</p>
                  <p className="font-semibold">{Number((service as any)?.hospitalityDetails?.totalRooms || hospitalityRoomTypes.reduce((sum: number, room: any) => sum + Number(room.roomCount || 0), 0)) || "Not set"}</p>
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hospitalityRoomTypes.map((room: any) => {
                const selected = selectedPackageId === room.id || (!selectedPackageId && room.isDefault)
                return (
                  <button
                    key={room.id}
                    type="button"
                    className={`rounded-lg border p-4 text-left transition-colors ${selected ? 'border-accent bg-accent/5' : 'hover:border-accent/60'}`}
                    onClick={() => setSelectedPackageId(room.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{room.name}</p>
                      <p className="text-accent font-semibold">₦{Number(room.pricePerNight || room.price || 0).toLocaleString('en-NG')}/night</p>
                    </div>
                    {room.description && <p className="text-sm text-muted-foreground mt-2">{room.description}</p>}
                    <div className="mt-2 text-xs text-muted-foreground">
                      <p>{Number(room.roomCount || 0)} room(s) available in this type</p>
                      <p>Up to {Number(room.maxGuests || 1)} guests</p>
                      {room.bedType && <p>Bed type: {room.bedType}</p>}
                    </div>
                    {Array.isArray(room.amenities) && room.amenities.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {room.amenities.slice(0, 6).map((amenity: string) => (
                          <Badge key={`${room.id}-${amenity}`} variant="secondary" className="text-xs">{amenity}</Badge>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Full Image Modal */}
        <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
          <DialogContent className="max-w-5xl w-full p-0 bg-black/95">
            <VisuallyHidden>
              <DialogTitle>Service Image Gallery</DialogTitle>
            </VisuallyHidden>
            <div className="relative">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 hover:scale-110 transition-all"
                onClick={() => setShowImageModal(false)}
              >
                <X className="h-6 w-6" />
              </Button>

              {/* Image */}
              {displayedImages.length > 0 && (
                <div className="relative">
                  <img
                    src={displayedImages[modalImageIndex]}
                    alt={`${service.title} - Image ${modalImageIndex + 1}`}
                    className="w-full h-auto max-h-[80vh] object-contain"
                  />

                  {/* Navigation arrows */}
                  {displayedImages.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hover:scale-110 transition-all"
                        onClick={() => setModalImageIndex((prev) => (prev === 0 ? displayedImages.length - 1 : prev - 1))}
                      >
                        <ChevronLeft className="h-8 w-8" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hover:scale-110 transition-all"
                        onClick={() => setModalImageIndex((prev) => (prev === displayedImages.length - 1 ? 0 : prev + 1))}
                      >
                        <ChevronRight className="h-8 w-8" />
                      </Button>
                    </>
                  )}

                  {/* Image counter */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                    {modalImageIndex + 1} / {displayedImages.length}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6 animate-fade-in">
            {/* Title & Provider */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{service.title}</h1>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={service.providerImage} />
                    <AvatarFallback>{service.providerName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{service.providerName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{service.category}</p>
                  </div>
                </div>

                <Badge variant="outline" className="capitalize">
                  {getLocationTypeLabel(service.locationType)}
                </Badge>
              </div>
            </div>

            {/* Trust, Urgency & Conversion Signals */}
            <Card className="border-accent/20 bg-background/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Trust & Conversion Signals</CardTitle>
                <CardDescription>Book with confidence and urgency</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
                <div className="rounded-md border p-3 bg-muted/20">
                  <p className="text-xs text-muted-foreground">Provider tier</p>
                  <p className="font-semibold">{trustTier}</p>
                </div>
                <div className="rounded-md border p-3 bg-muted/20">
                  <p className="text-xs text-muted-foreground">Response time</p>
                  <p className="font-semibold">Within {responseHours} hour(s)</p>
                </div>
                <div className="rounded-md border p-3 bg-muted/20">
                  <p className="text-xs text-muted-foreground">Completed jobs</p>
                  <p className="font-semibold">{completedJobs > 0 ? completedJobs.toLocaleString("en-NG") : "Not published"}</p>
                </div>
                <div className="rounded-md border p-3 bg-muted/20">
                  <p className="text-xs text-muted-foreground">Last updated</p>
                  <p className="font-semibold">{lastUpdatedLabel}</p>
                </div>
                <div className="rounded-md border p-3 bg-yellow-50 border-yellow-200">
                  <p className="text-xs text-yellow-700">Next available slot</p>
                  <p className="font-semibold text-yellow-900">
                    {/* Next slot preview logic */}
                    {(() => {
                      if (service?.availability) {
                        const today = new Date();
                        const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
                        for (let i = 0; i < 7; i++) {
                          const check = new Date(today);
                          check.setDate(today.getDate() + i);
                          const dayName = days[check.getDay()];
                          const slot = service.availability[dayName];
                          if (slot?.available) {
                            return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}: ${slot.start} - ${slot.end}`;
                          }
                        }
                      }
                      return "No slots published";
                    })()}
                  </p>
                </div>
              </CardContent>
              <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                <div className="rounded-md border p-3 bg-blue-50 border-blue-200">
                  <p className="text-xs text-blue-700">Social proof</p>
                  <p className="font-semibold text-blue-900">
                    {completedJobs > 0
                      ? `Booked ${completedJobs} time${completedJobs === 1 ? '' : 's'} this month`
                      : "Be the first to book!"}
                  </p>
                </div>
                <div className="rounded-md border p-3 bg-green-50 border-green-200">
                  <p className="text-xs text-green-700">Booking urgency</p>
                  <p className="font-semibold text-green-900">
                    {(() => {
                      if (service?.availability) {
                        const days = Object.entries(service.availability).filter(([_, v]) => v.available);
                        if (days.length <= 2) return "Limited slots left!";
                        if (days.length <= 4) return "Slots filling up soon";
                        return "Slots available this week";
                      }
                      return "Check calendar for details";
                    })()}
                  </p>
                </div>
              </CardContent>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Cancellation policy: {cancellationPolicyPercent}% fee applies within {cancellationWindowHours} hours of start time.
                </p>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="description" className="flex-1">Description</TabsTrigger>
                <TabsTrigger value="availability" className="flex-1">Availability</TabsTrigger>
                <TabsTrigger value="reviews" className="flex-1">Reviews</TabsTrigger>
              </TabsList>

              <TabsContent value="description" className="space-y-4 mt-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">
                    {isHospitalityService ? `${hospitalityLabel} Overview` : "About This Service"}
                  </h3>
                  <p className="text-muted-foreground whitespace-pre-line">{service.description}</p>
                </div>

                {service.tags && service.tags.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {service.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {service.location && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Location</h3>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-5 w-5" />
                      <span>{service.location}</span>
                    </div>
                  </div>
                )}

                {isHospitalityService && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Stay Details</h3>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="capitalize">Property Type: {(service as any)?.hospitalityDetails?.propertyType?.replace(/-/g, " ") || hospitalityLabel.toLowerCase()}</p>
                      <p>Total Rooms: {Number((service as any)?.hospitalityDetails?.totalRooms || 0) || "Not specified"}</p>
                      <p>Check-in: {(service as any)?.hospitalityDetails?.checkInTime || "14:00"}</p>
                      <p>Check-out: {(service as any)?.hospitalityDetails?.checkOutTime || "12:00"}</p>
                    </div>
                  </div>
                )}

                {serviceRequirements.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Requirements Before Booking</h3>
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      {serviceRequirements.map((requirement, index) => (
                        <div key={`service-requirement-${index}`} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                          <span>{requirement}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="availability" className="mt-6">
                <h3 className="text-xl font-semibold mb-4">Available Days</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(service.availability || {}).map(([day, schedule]: [string, any]) => (
                    <Card key={day} className={!schedule.available ? "opacity-50" : ""}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm capitalize flex items-center gap-2">
                          {schedule.available && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {day}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {schedule.available ? (
                          <p className="text-sm text-muted-foreground">
                            {schedule.start} - {schedule.end}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Unavailable</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No reviews yet. Be the first to book and review!</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Booking Sidebar */}
          <div className="animate-fade-in-delay">
            <Card className="sticky top-24 border-accent/20 shadow-lg shadow-accent/5">
              <CardHeader>
                <CardTitle className="text-2xl text-accent">{getPriceDisplay()}</CardTitle>
                <CardDescription>
                  {isHospitalityService ? `${hospitalityLabel} booking` : service.duration && `${service.duration} minutes session`}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {activePackages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">{isHospitalityService ? "Select Room Type" : "Select Package"}</p>
                    <div className="space-y-2">
                      {activePackages.map((pkg: any) => (
                        <button
                          key={pkg.id}
                          type="button"
                          className={`w-full text-left rounded-md border p-3 transition-colors ${selectedPackage?.id === pkg.id ? 'border-accent bg-accent/5' : 'hover:border-accent/50'}`}
                          onClick={() => setSelectedPackageId(pkg.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{pkg.name}</span>
                            <span className="text-sm text-accent">₦{Number(pkg.price || 0).toLocaleString('en-NG')}{isHospitalityService ? '/night' : ''}</span>
                          </div>
                          {pkg.description && <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeAddOns.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Optional Add-ons</p>
                    <div className="space-y-2">
                      {activeAddOns.map((addOn: any) => {
                        const isChecked = selectedAddOnIds.includes(addOn.id)
                        return (
                          <label key={addOn.id} className="flex items-start gap-2 p-2 border rounded-md cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setSelectedAddOnIds((prev) => {
                                  if (e.target.checked) return [...prev, addOn.id]
                                  return prev.filter((id) => id !== addOn.id)
                                })
                              }}
                              className="mt-1"
                            />
                            <span className="text-sm">
                              <span className="font-medium">{addOn.name}</span>
                              <span className="text-muted-foreground"> {addOn.pricingType === 'percentage' ? `(+${addOn.amount}%)` : `(+₦${Number(addOn.amount || 0).toLocaleString('en-NG')})`}</span>
                              {addOn.description && <span className="block text-xs text-muted-foreground mt-0.5">{addOn.description}</span>}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3 text-sm">
                  {isHospitalityService && selectedRoomType && (
                    <div className="p-3 rounded-md bg-accent/5 border border-accent/20 space-y-1">
                      <p className="font-medium">{selectedRoomType.name}</p>
                      <p className="text-xs text-muted-foreground">Up to {Number(selectedRoomType.maxGuests || 1)} guests</p>
                      {selectedRoomType.bedType && <p className="text-xs text-muted-foreground">Bed: {selectedRoomType.bedType}</p>}
                      {Array.isArray(selectedRoomType.amenities) && selectedRoomType.amenities.length > 0 && (
                        <p className="text-xs text-muted-foreground">Amenities: {selectedRoomType.amenities.join(', ')}</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{isHospitalityService ? "Nightly stay booking" : `${service.duration || "Variable"} minutes`}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{getLocationTypeLabel(service.locationType)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Available: {getAvailabilityDays().join(", ")}</span>
                  </div>
                </div>

                {isHospitalityService && (
                  <div className="rounded-md border p-3 space-y-3">
                    <p className="text-sm font-semibold">Check Room Availability</p>
                    <div className="grid grid-cols-1 gap-2">
                      <label className="text-xs text-muted-foreground">
                        Check-in
                        <input
                          type="date"
                          value={previewCheckInDate}
                          min={toDateInputValue(new Date())}
                          onChange={(e) => setPreviewCheckInDate(e.target.value)}
                          className="mt-1 w-full rounded-md border px-2 py-1 text-sm bg-background"
                        />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Check-out
                        <input
                          type="date"
                          value={previewCheckOutDate}
                          min={previewCheckInDate || toDateInputValue(new Date())}
                          onChange={(e) => setPreviewCheckOutDate(e.target.value)}
                          className="mt-1 w-full rounded-md border px-2 py-1 text-sm bg-background"
                        />
                      </label>
                    </div>

                    <div className="rounded-md bg-accent/5 border border-accent/20 p-2">
                      {loadingPreviewAvailability ? (
                        <p className="text-xs text-muted-foreground">Checking room availability...</p>
                      ) : previewStayAvailability ? (
                        <>
                          <p className="text-sm font-medium">
                            {previewStayAvailability.remainingRooms} of {previewStayAvailability.totalRooms} rooms available
                          </p>
                          <p className={`text-xs ${previewStayAvailability.isBookedOut ? "text-red-600" : "text-green-700"}`}>
                            {previewStayAvailability.isBookedOut ? "Booked out for selected dates" : "Rooms available for selected dates"}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Select valid dates to preview availability.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-md bg-accent/10 text-sm">
                  <p className="font-medium text-accent">
                    {service.requiresQuote ? 'Estimated total' : 'Total'}: ₦{estimatedTotal.toLocaleString('en-NG')}
                  </p>
                  {service.requiresQuote && (
                    <p className="text-xs text-muted-foreground mt-1">Final amount will be approved by provider before acceptance.</p>
                  )}
                </div>

                <div className="rounded-md border p-3 bg-background">
                  <p className="text-xs text-muted-foreground">{sidebarHint}</p>
                </div>

                {serviceRequirements.length > 0 && (
                  <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <p className="text-sm font-semibold">Booking checklist</p>
                    {serviceRequirements.slice(0, 3).map((requirement, index) => (
                      <div key={`sidebar-requirement-${index}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
                        <span>{requirement}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t space-y-2">
                  <Button
                    className="w-full hover:bg-accent/90 hover:scale-105 transition-all"
                    size="lg"
                    onClick={() => {
                      if (!user) {
                        router.push("/login")
                      } else {
                        setShowBookingModal(true)
                      }
                    }}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    {isHospitalityService ? (isApartmentStay ? "Reserve Apartment" : "Book Stay") : "Book Appointment"}
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full hover:bg-accent/10 hover:text-accent transition-all" 
                    size="lg"
                    onClick={handleMessageProvider}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message Provider
                  </Button>
                      {/* Quick Message Modal */}
                      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
                        <DialogContent className="max-w-md mx-auto">
                          <DialogTitle>Message Provider</DialogTitle>
                          <div className="space-y-4">
                            <input
                              type="text"
                              className="w-full border rounded px-3 py-2"
                              placeholder="Type your message..."
                              value={quickMessage}
                              onChange={e => setQuickMessage(e.target.value)}
                              disabled={sendingQuickMessage}
                              onKeyDown={e => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault()
                                  handleSendQuickMessage()
                                }
                              }}
                            />
                            <Button
                              onClick={handleSendQuickMessage}
                              disabled={!quickMessage.trim() || sendingQuickMessage}
                              className="w-full"
                            >
                              Send
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Booking Modal */}
      {showBookingModal && service && (
        <BookingModal
          service={service}
          selectedPackage={selectedPackage ? {
            id: selectedPackage.id,
            name: selectedPackage.name,
            price: Number(selectedPackage.price || 0),
            duration: selectedPackage.duration,
            pricingType: selectedPackage.pricingType,
          } : undefined}
          selectedAddOns={selectedAddOns.map((addOn: any) => ({
            id: addOn.id,
            name: addOn.name,
            pricingType: addOn.pricingType,
            amount: Number(addOn.amount || 0),
          }))}
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
        />
      )}

      
    </div>
  )
}
