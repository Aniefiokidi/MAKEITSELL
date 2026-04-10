"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Plus, Upload, X, Sparkles } from "lucide-react"

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

const SERVICE_CATEGORIES = [
  "photography",
  "consulting",
  "repairs",
  "design",
  "fitness",
  "education",
  "beauty",
  "cleaning",
  "tech",
  "rentals",
  "hospitality",
  "marketing",
  "legal",
  "healthcare",
  "logistics",
  "home-improvement",
  "automotive",
  "event-planning",
  "other",
]

const RENTAL_SUBCATEGORIES = [
  "car-rentals",
  "event-equipment",
  "party-supplies",
  "fashion-rentals",
  "camera-gear",
  "audio-visual",
  "furniture-rentals",
  "short-let-spaces",
  "construction-tools",
  "generator-power",
  "baby-kids-gear",
  "outdoor-camping",
]

const HOSPITALITY_SUBCATEGORIES = [
  "hotel",
  "apartment",
  "short-let-apartment",
  "resort",
  "guest-house",
]

const NIGERIA_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
]

type ServicePackageOption = {
  id: string
  name: string
  description: string
  price: string
  duration: string
  pricingType: "fixed" | "hourly" | "per-session" | "custom"
  isDefault: boolean
  active: boolean
}

type ServiceAddOnOption = {
  id: string
  name: string
  description: string
  pricingType: "fixed" | "percentage"
  amount: string
  optional: boolean
  active: boolean
}

type LocationPricingRule = {
  id: string
  label: string
  matchType: "state" | "city" | "contains"
  matchValue: string
  fixedAdjustment: string
  percentageAdjustment: string
  active: boolean
}

type RoomTypeOption = {
  id: string
  name: string
  description: string
  pricePerNight: string
  roomCount: string
  maxGuests: string
  maxAdults: string
  maxChildren: string
  bedType: string
  amenities: string
  isDefault: boolean
  active: boolean
}

const makeOptionId = () => `opt-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const MAX_PACKAGE_IMAGES = 5

export default function NewServicePage() {
  const router = useRouter()
  const { user, userProfile } = useAuth()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    subcategory: "",
    price: "",
    pricingType: "fixed" as "fixed" | "hourly" | "per-session" | "custom",
    duration: "",
    location: "",
    state: "",
    city: "",
    locationType: "online" as "online" | "home-service" | "store",
    tags: "",
  })

  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([])
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [availability, setAvailability] = useState<any>(
    DAYS.reduce((acc, day) => ({
      ...acc,
      [day]: { start: "09:00", end: "17:00", available: false }
    }), {})
  )

  const [images, setImages] = useState<string[]>([])
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [logoPreview, setLogoPreview] = useState<string>("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoIsPdf, setLogoIsPdf] = useState(false)
  const [logoFileName, setLogoFileName] = useState("")
  const [loading, setLoading] = useState(false)
  const [packageOptions, setPackageOptions] = useState<ServicePackageOption[]>([
    {
      id: makeOptionId(),
      name: "Standard",
      description: "",
      price: "",
      duration: "60",
      pricingType: "fixed",
      isDefault: true,
      active: true,
    },
  ])
  const [addOnOptions, setAddOnOptions] = useState<ServiceAddOnOption[]>([])
  const [requiresQuote, setRequiresQuote] = useState(false)
  const [quoteNotesTemplate, setQuoteNotesTemplate] = useState("")
  const [quoteSlaHours, setQuoteSlaHours] = useState("24")
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false)
  const [externalCalendarIcsUrl, setExternalCalendarIcsUrl] = useState("")
  const [locationPricingRules, setLocationPricingRules] = useState<LocationPricingRule[]>([])
  const [distanceRatePerMile, setDistanceRatePerMile] = useState("0")
  const [generatingDescription, setGeneratingDescription] = useState(false)
  const [packageImageAssignments, setPackageImageAssignments] = useState<Record<string, number[]>>({})
  const [totalRooms, setTotalRooms] = useState("")
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([])
  const [roomImageAssignments, setRoomImageAssignments] = useState<Record<string, number[]>>({})

  const isHospitalityCategory = formData.category === "hospitality"

  const addLocationPricingRule = () => {
    setLocationPricingRules((prev) => [
      ...prev,
      {
        id: makeOptionId(),
        label: "",
        matchType: "contains",
        matchValue: "",
        fixedAdjustment: "0",
        percentageAdjustment: "0",
        active: true,
      },
    ])
  }

  const removeLocationPricingRule = (id: string) => {
    setLocationPricingRules((prev) => prev.filter((item) => item.id !== id))
  }

  const handleGenerateDescription = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Title required",
        description: "Add a service title before generating description.",
        variant: "destructive",
      })
      return
    }

    try {
      setGeneratingDescription(true)
      const response = await fetch("/api/vendor/services/ai-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          category: formData.category,
          tags: formData.tags,
          locationType: formData.locationType,
          packageNames: packageOptions.map((pkg) => pkg.name).filter(Boolean),
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to generate description")
      }

      setFormData((prev) => ({ ...prev, description: payload.data.description || prev.description }))
      toast({ title: "Description generated", description: "AI draft added. You can edit before publishing." })
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message || "Unable to generate description.", variant: "destructive" })
    } finally {
      setGeneratingDescription(false)
    }
  }

  const addPackageOption = () => {
    const nextId = makeOptionId()
    setPackageOptions((prev) => [
      ...prev,
      {
        id: nextId,
        name: "",
        description: "",
        price: "",
        duration: "",
        pricingType: "fixed",
        isDefault: prev.length === 0,
        active: true,
      },
    ])
    setPackageImageAssignments((prev) => ({
      ...prev,
      [nextId]: [],
    }))
  }

  const removePackageOption = (id: string) => {
    setPackageImageAssignments((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })

    setPackageOptions((prev) => {
      const next = prev.filter((item) => item.id !== id)
      if (!next.some((item) => item.isDefault) && next.length > 0) {
        next[0] = { ...next[0], isDefault: true }
      }
      return next
    })
  }

  const setDefaultPackageOption = (id: string) => {
    setPackageOptions((prev) => prev.map((item) => ({ ...item, isDefault: item.id === id })))
  }

  const addAddOnOption = () => {
    setAddOnOptions((prev) => [
      ...prev,
      {
        id: makeOptionId(),
        name: "",
        description: "",
        pricingType: "fixed",
        amount: "",
        optional: true,
        active: true,
      },
    ])
  }

  const addRoomType = () => {
    const nextId = makeOptionId()
    setRoomTypes((prev) => [
      ...prev,
      {
        id: nextId,
        name: "",
        description: "",
        pricePerNight: "",
        roomCount: "",
        maxGuests: "2",
        maxAdults: "2",
        maxChildren: "0",
        bedType: "",
        amenities: "",
        isDefault: prev.length === 0,
        active: true,
      },
    ])
    setRoomImageAssignments((prev) => ({ ...prev, [nextId]: [] }))
  }

  const removeRoomType = (id: string) => {
    setRoomImageAssignments((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })

    setRoomTypes((prev) => {
      const next = prev.filter((room) => room.id !== id)
      if (!next.some((room) => room.isDefault) && next.length > 0) {
        next[0] = { ...next[0], isDefault: true }
      }
      return next
    })
  }

  const setDefaultRoomType = (id: string) => {
    setRoomTypes((prev) => prev.map((room) => ({ ...room, isDefault: room.id === id })))
  }

  const toggleRoomImage = (roomTypeId: string, imageIndex: number) => {
    setRoomImageAssignments((prev) => {
      const current = prev[roomTypeId] || []
      const exists = current.includes(imageIndex)
      return {
        ...prev,
        [roomTypeId]: exists ? current.filter((idx) => idx !== imageIndex) : [...current, imageIndex],
      }
    })
  }

  const removeAddOnOption = (id: string) => {
    setAddOnOptions((prev) => prev.filter((item) => item.id !== id))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 5MB`,
          variant: "destructive",
        })
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        setImages((prev) => [...prev, reader.result as string])
        setImageFiles((prev) => [...prev, file])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    setPackageImageAssignments((prev) => {
      const next: Record<string, number[]> = {}
      for (const [packageId, imageIndexes] of Object.entries(prev)) {
        next[packageId] = imageIndexes
          .filter((imgIndex) => imgIndex !== index)
          .map((imgIndex) => (imgIndex > index ? imgIndex - 1 : imgIndex))
      }
      return next
    })
    setRoomImageAssignments((prev) => {
      const next: Record<string, number[]> = {}
      for (const [roomTypeId, imageIndexes] of Object.entries(prev)) {
        next[roomTypeId] = imageIndexes
          .filter((imgIndex) => imgIndex !== index)
          .map((imgIndex) => (imgIndex > index ? imgIndex - 1 : imgIndex))
      }
      return next
    })
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
    const isImage = file.type.startsWith("image/")

    if (!isPdf && !isImage) {
      toast({
        title: "Unsupported file type",
        description: "Only image and PDF files are supported for logos",
        variant: "destructive",
      })
      return
    }

    if (file.size > 3 * 1024 * 1024) {
      toast({
        title: "Logo too large",
        description: "Please upload a logo smaller than 3MB",
        variant: "destructive",
      })
      return
    }

    setLogoFile(file)
    setLogoFileName(file.name)
    setLogoIsPdf(isPdf)

    if (isPdf) {
      setLogoPreview("")
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const togglePackageImage = (packageId: string, imageIndex: number) => {
    setPackageImageAssignments((prev) => {
      const current = prev[packageId] || []
      const exists = current.includes(imageIndex)
      if (!exists && current.length >= MAX_PACKAGE_IMAGES) {
        toast({
          title: "Package image limit reached",
          description: `Each package can contain up to ${MAX_PACKAGE_IMAGES} images.`,
          variant: "destructive",
        })
        return prev
      }
      return {
        ...prev,
        [packageId]: exists
          ? current.filter((idx) => idx !== imageIndex)
          : [...current, imageIndex],
      }
    })
  }

  // Address autocomplete using Google Maps Places API
  const searchAddress = async (query: string) => {
    if (query.length < 3) {
      setLocationSuggestions([])
      setShowSuggestions(false)
      return
    }

    setLoadingLocation(true)
    try {
      // Using Google Maps Places Autocomplete API
      const response = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(query)}&region=ng`)
      
      if (response.ok) {
        const data = await response.json()
        setLocationSuggestions(data.predictions || [])
        setShowSuggestions(true)
      }
    } catch (error) {
      console.error('Error fetching address suggestions:', error)
    } finally {
      setLoadingLocation(false)
    }
  }

  const selectAddress = (suggestion: any) => {
    setFormData({ ...formData, location: suggestion.description })
    setLocationSuggestions([])
    setShowSuggestions(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || !userProfile) {
      toast({
        title: "Not authenticated",
        description: "Please log in to add a service",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)

      // Upload images
      const imageUrls = await Promise.all(
        imageFiles.map((file) => uploadToCloudinary(file))
      )
      const providerImageUrl = logoFile ? await uploadToCloudinary(logoFile) : ""

      // Prepare service data
      let locationValue = "Online"
      if (formData.locationType === "home-service") {
        locationValue = formData.state || "Nigeria"
      } else if (formData.locationType === "store") {
        locationValue = formData.location || "Not specified"
      }

      const normalizedPackages = packageOptions
        .filter((pkg) => pkg.name.trim() && pkg.price !== "")
        .map((pkg) => {
          const assignedIndexes = packageImageAssignments[pkg.id] || []
          const assignedImages = assignedIndexes
            .map((imgIndex) => imageUrls[imgIndex])
            .filter((imgUrl): imgUrl is string => Boolean(imgUrl))
            .slice(0, MAX_PACKAGE_IMAGES)

          return {
            id: pkg.id,
            name: pkg.name.trim(),
            description: pkg.description.trim(),
            price: Number.parseFloat(pkg.price),
            duration: pkg.duration ? Number.parseInt(pkg.duration, 10) : undefined,
            pricingType: pkg.pricingType,
            isDefault: pkg.isDefault,
            active: pkg.active,
            images: assignedImages,
          }
        })

      const normalizedRoomTypes = roomTypes
        .filter((room) => room.name.trim() && room.pricePerNight !== "")
        .map((room) => {
          const assignedIndexes = roomImageAssignments[room.id] || []
          const assignedImages = assignedIndexes
            .map((imgIndex) => imageUrls[imgIndex])
            .filter((imgUrl): imgUrl is string => Boolean(imgUrl))

          const amenities = room.amenities
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)

          return {
            id: room.id,
            name: room.name.trim(),
            description: room.description.trim(),
            pricePerNight: Number.parseFloat(room.pricePerNight),
            roomCount: Number.parseInt(room.roomCount || "0", 10) || 0,
            maxGuests: Number.parseInt(room.maxGuests || "1", 10) || 1,
            maxAdults: Number.parseInt(room.maxAdults || "1", 10) || 1,
            maxChildren: Number.parseInt(room.maxChildren || "0", 10) || 0,
            bedType: room.bedType.trim(),
            amenities,
            images: assignedImages,
            isDefault: room.isDefault,
            active: room.active,
          }
        })

      const effectivePackages = isHospitalityCategory
        ? normalizedRoomTypes.map((room) => ({
            id: room.id,
            name: room.name,
            description: room.description,
            price: room.pricePerNight,
            duration: 1440,
            pricingType: "fixed" as const,
            isDefault: room.isDefault,
            active: room.active,
            images: room.images,
          }))
        : normalizedPackages

      const normalizedAddOns = addOnOptions
        .filter((addOn) => addOn.name.trim() && addOn.amount !== "")
        .map((addOn) => ({
          id: addOn.id,
          name: addOn.name.trim(),
          description: addOn.description.trim(),
          pricingType: addOn.pricingType,
          amount: Number.parseFloat(addOn.amount),
          optional: addOn.optional,
          active: addOn.active,
        }))

      if (isHospitalityCategory && normalizedRoomTypes.length === 0) {
        throw new Error("Add at least one room type with price for hotel/apartment services")
      }

      if (effectivePackages.length === 0 && !formData.price) {
        throw new Error("Add at least one package price or provide a base price")
      }

      const minPackagePrice = effectivePackages.length > 0
        ? Math.min(...effectivePackages.map((pkg) => pkg.price))
        : undefined

      const defaultPackage = effectivePackages.find((pkg) => pkg.isDefault) || effectivePackages[0]

      const serviceData: any = {
        providerId: user.uid,
        providerName: userProfile.displayName,
        providerImage: providerImageUrl,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        subcategory: formData.subcategory,
        price: minPackagePrice ?? parseFloat(formData.price),
        pricingType: defaultPackage?.pricingType || formData.pricingType,
        location: locationValue,
        state: formData.state,
        city: formData.city,
        locationType: formData.locationType,
        images: imageUrls,
        availability,
        featured: false,
        status: "active" as const,
        tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
        packageOptions: effectivePackages,
        addOnOptions: normalizedAddOns,
        requiresQuote,
        quoteNotesTemplate: quoteNotesTemplate.trim(),
        quoteSlaHours: Number.parseInt(quoteSlaHours, 10) || 24,
        calendarSyncEnabled,
        externalCalendarIcsUrl: externalCalendarIcsUrl.trim(),
        locationPricingRules: locationPricingRules
          .filter((rule) => rule.label.trim() && rule.matchValue.trim())
          .map((rule) => ({
            id: rule.id,
            label: rule.label.trim(),
            matchType: rule.matchType,
            matchValue: rule.matchValue.trim(),
            fixedAdjustment: Number.parseFloat(rule.fixedAdjustment) || 0,
            percentageAdjustment: Number.parseFloat(rule.percentageAdjustment) || 0,
            active: rule.active,
          })),
        distanceRatePerMile: Number.parseFloat(distanceRatePerMile) || 0,
      }

      if (isHospitalityCategory) {
        serviceData.hospitalityDetails = {
          propertyType: formData.subcategory || "hotel",
          totalRooms: Number.parseInt(totalRooms || "0", 10) || normalizedRoomTypes.reduce((sum, room) => sum + room.roomCount, 0),
          checkInTime: "14:00",
          checkOutTime: "12:00",
          maxAdvanceBookingDays: 365,
          roomTypes: normalizedRoomTypes,
        }
      }

      // Only add duration if it's provided
      if (formData.duration) {
        serviceData.duration = parseInt(formData.duration)
      }

      // Create service via API
      const response = await fetch('/api/vendor/services/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serviceData)
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)

      if (!response.ok) {
        let errorData
        const contentType = response.headers.get('content-type')
        
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json()
        } else {
          const text = await response.text()
          errorData = { error: text || 'Failed to create service' }
        }
        
        console.error('Service creation failed:', errorData)
        console.error('Service data sent:', serviceData)
        throw new Error(errorData.error || errorData.details || 'Failed to create service')
      }

      toast({
        title: "Service Created",
        description: "Your service has been added successfully",
      })

      router.push("/vendor/dashboard")
    } catch (error: any) {
      console.error("Error creating service:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create service. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <VendorLayout>
      <div className="max-w-4xl">
        <Button variant="ghost" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">Add New Service</h1>
          <p className="text-muted-foreground">Create a new service offering for your customers</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Service Title *</Label>
                <Input
                  id="title"
                  required
                  placeholder="e.g., Professional Photography Session"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={handleGenerateDescription} disabled={generatingDescription}>
                    <Sparkles className="h-4 w-4 mr-1" />
                    {generatingDescription ? "Generating..." : "Generate With AI"}
                  </Button>
                </div>
                <Textarea
                  id="description"
                  required
                  rows={5}
                  placeholder="Describe your service in detail..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        category: value,
                        subcategory: value === "rentals" || value === "hospitality" ? formData.subcategory : "",
                        locationType: value === "hospitality" ? "store" : formData.locationType,
                      })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat} className="capitalize">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subcategory">Subcategory</Label>
                  <Select
                    value={formData.subcategory}
                    onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
                    disabled={formData.category !== "rentals" && formData.category !== "hospitality"}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          formData.category === "rentals"
                            ? "Select rental type"
                            : formData.category === "hospitality"
                              ? "Select property type"
                              : "Available for rentals/hospitality"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(formData.category === "hospitality" ? HOSPITALITY_SUBCATEGORIES : RENTAL_SUBCATEGORIES).map((subcategory) => (
                        <SelectItem key={subcategory} value={subcategory} className="capitalize">
                          {subcategory.replace(/-/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma separated)</Label>
                  <Input
                    id="tags"
                    placeholder="wedding, portrait, event"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing & Duration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-base">Service Packages</Label>
                    <p className="text-xs text-muted-foreground">Create multiple package types with different prices.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addPackageOption}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Package
                  </Button>
                </div>

                <div className="space-y-3">
                  {packageOptions.map((pkg, index) => (
                    <div key={pkg.id} className="rounded-md border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">Package {index + 1}</p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={pkg.isDefault ? "default" : "outline"}
                            onClick={() => setDefaultPackageOption(pkg.id)}
                          >
                            {pkg.isDefault ? "Default" : "Set Default"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={packageOptions.length === 1}
                            onClick={() => removePackageOption(pkg.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Package Name *</Label>
                          <Input
                            placeholder="Basic, Standard, Premium"
                            value={pkg.name}
                            onChange={(e) =>
                              setPackageOptions((prev) =>
                                prev.map((item) => (item.id === pkg.id ? { ...item, name: e.target.value } : item))
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Price (₦) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={pkg.price}
                            onChange={(e) =>
                              setPackageOptions((prev) =>
                                prev.map((item) => (item.id === pkg.id ? { ...item, price: e.target.value } : item))
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Pricing Type</Label>
                          <Select
                            value={pkg.pricingType}
                            onValueChange={(value: any) =>
                              setPackageOptions((prev) =>
                                prev.map((item) => (item.id === pkg.id ? { ...item, pricingType: value } : item))
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Fixed Price</SelectItem>
                              <SelectItem value="hourly">Per Hour</SelectItem>
                              <SelectItem value="per-session">Per Session</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Duration (minutes)</Label>
                          <Input
                            type="number"
                            placeholder="60"
                            value={pkg.duration}
                            onChange={(e) =>
                              setPackageOptions((prev) =>
                                prev.map((item) => (item.id === pkg.id ? { ...item, duration: e.target.value } : item))
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          rows={2}
                          placeholder="What is included in this package"
                          value={pkg.description}
                          onChange={(e) =>
                            setPackageOptions((prev) =>
                              prev.map((item) => (item.id === pkg.id ? { ...item, description: e.target.value } : item))
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-base">Optional Add-ons</Label>
                    <p className="text-xs text-muted-foreground">Allow customers to add extras at booking.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addAddOnOption}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Add-on
                  </Button>
                </div>

                {addOnOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No add-ons yet.</p>
                ) : (
                  <div className="space-y-3">
                    {addOnOptions.map((addOn) => (
                      <div key={addOn.id} className="rounded-md border p-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-2 md:col-span-2">
                            <Label>Name *</Label>
                            <Input
                              placeholder="Rush delivery, Extra revision"
                              value={addOn.name}
                              onChange={(e) =>
                                setAddOnOptions((prev) =>
                                  prev.map((item) => (item.id === addOn.id ? { ...item, name: e.target.value } : item))
                                )
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Amount *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0"
                              value={addOn.amount}
                              onChange={(e) =>
                                setAddOnOptions((prev) =>
                                  prev.map((item) => (item.id === addOn.id ? { ...item, amount: e.target.value } : item))
                                )
                              }
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                              value={addOn.pricingType}
                              onValueChange={(value: any) =>
                                setAddOnOptions((prev) =>
                                  prev.map((item) => (item.id === addOn.id ? { ...item, pricingType: value } : item))
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fixed">Fixed Amount (₦)</SelectItem>
                                <SelectItem value="percentage">Percentage (%)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeAddOnOption(addOn.id)}
                            >
                              Remove Add-on
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input
                            placeholder="Optional details about this add-on"
                            value={addOn.description}
                            onChange={(e) =>
                              setAddOnOptions((prev) =>
                                prev.map((item) => (item.id === addOn.id ? { ...item, description: e.target.value } : item))
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isHospitalityCategory && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-base">Rooms & Stay Configuration</Label>
                      <p className="text-xs text-muted-foreground">Create room types, nightly pricing, occupancy and images.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addRoomType}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Room Type
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Total Rooms In Property</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="e.g. 18"
                      value={totalRooms}
                      onChange={(e) => setTotalRooms(e.target.value)}
                    />
                  </div>

                  {roomTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No room type yet. Add at least one to publish this category.</p>
                  ) : (
                    <div className="space-y-3">
                      {roomTypes.map((room, index) => {
                        const assignedIndexes = roomImageAssignments[room.id] || []
                        return (
                          <div key={room.id} className="rounded-md border p-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium">Room Type {index + 1}</p>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={room.isDefault ? "default" : "outline"}
                                  onClick={() => setDefaultRoomType(room.id)}
                                >
                                  {room.isDefault ? "Default" : "Set Default"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeRoomType(room.id)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Room Type Name *</Label>
                                <Input
                                  placeholder="Deluxe Studio, Executive Suite"
                                  value={room.name}
                                  onChange={(e) =>
                                    setRoomTypes((prev) => prev.map((item) => (item.id === room.id ? { ...item, name: e.target.value } : item)))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Price Per Night (₦) *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={room.pricePerNight}
                                  onChange={(e) =>
                                    setRoomTypes((prev) => prev.map((item) => (item.id === room.id ? { ...item, pricePerNight: e.target.value } : item)))
                                  }
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                              <div className="space-y-2">
                                <Label>Rooms</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={room.roomCount}
                                  onChange={(e) =>
                                    setRoomTypes((prev) => prev.map((item) => (item.id === room.id ? { ...item, roomCount: e.target.value } : item)))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Max Guests</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={room.maxGuests}
                                  onChange={(e) =>
                                    setRoomTypes((prev) => prev.map((item) => (item.id === room.id ? { ...item, maxGuests: e.target.value } : item)))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Max Adults</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={room.maxAdults}
                                  onChange={(e) =>
                                    setRoomTypes((prev) => prev.map((item) => (item.id === room.id ? { ...item, maxAdults: e.target.value } : item)))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Max Children</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={room.maxChildren}
                                  onChange={(e) =>
                                    setRoomTypes((prev) => prev.map((item) => (item.id === room.id ? { ...item, maxChildren: e.target.value } : item)))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Bed Type</Label>
                                <Input
                                  placeholder="King, Queen, Twin"
                                  value={room.bedType}
                                  onChange={(e) =>
                                    setRoomTypes((prev) => prev.map((item) => (item.id === room.id ? { ...item, bedType: e.target.value } : item)))
                                  }
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Room Description</Label>
                              <Textarea
                                rows={2}
                                value={room.description}
                                onChange={(e) =>
                                  setRoomTypes((prev) => prev.map((item) => (item.id === room.id ? { ...item, description: e.target.value } : item)))
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Amenities (comma separated)</Label>
                              <Input
                                placeholder="Wi-Fi, Smart TV, Balcony, Breakfast"
                                value={room.amenities}
                                onChange={(e) =>
                                  setRoomTypes((prev) => prev.map((item) => (item.id === room.id ? { ...item, amenities: e.target.value } : item)))
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Assign Room Images</Label>
                              {images.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Upload service images first, then assign them to this room type.</p>
                              ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                  {images.map((img, imageIndex) => {
                                    const checked = assignedIndexes.includes(imageIndex)
                                    return (
                                      <button
                                        type="button"
                                        key={`${room.id}-${imageIndex}`}
                                        className={`relative rounded-md overflow-hidden border-2 ${checked ? "border-accent" : "border-transparent"}`}
                                        onClick={() => toggleRoomImage(room.id, imageIndex)}
                                      >
                                        <img src={img} alt={`Room ${room.name || index + 1} image ${imageIndex + 1}`} className="h-16 w-full object-cover" />
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-base">Quote Approval</Label>
                    <p className="text-xs text-muted-foreground">Enable when final amount depends on job details.</p>
                  </div>
                  <Switch checked={requiresQuote} onCheckedChange={setRequiresQuote} />
                </div>

                {requiresQuote && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="quoteNotesTemplate">Quote Notes (Optional)</Label>
                      <Textarea
                        id="quoteNotesTemplate"
                        rows={3}
                        placeholder="Add details customers should provide for accurate quote approval"
                        value={quoteNotesTemplate}
                        onChange={(e) => setQuoteNotesTemplate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quoteSlaHours">Quote SLA (hours)</Label>
                      <Input
                        id="quoteSlaHours"
                        type="number"
                        min="1"
                        max="168"
                        value={quoteSlaHours}
                        onChange={(e) => setQuoteSlaHours(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Quotes automatically expire after this window.</p>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Fallback Base Price (Legacy Support)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  required={packageOptions.every((pkg) => !pkg.name.trim() || pkg.price === "")}
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Used only if no valid package is configured.</p>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
              <CardDescription>Choose how customers will access your service</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="locationType">Service Location *</Label>
                <Select
                  value={formData.locationType}
                  onValueChange={(value: any) => {
                    setFormData({ ...formData, locationType: value, location: "", state: "", city: "" })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online - Service provided remotely</SelectItem>
                    <SelectItem value="home-service">Home Service - I visit customers</SelectItem>
                    <SelectItem value="store">Store/Office - Customers visit me</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.locationType === "home-service" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state">State/Region *</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) => setFormData({ ...formData, state: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {NIGERIA_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state === "FCT" ? "FCT - Abuja" : state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Select the state where you provide home services</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="e.g. Ikeja"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Optional: helps customers filter by city inside the selected state.</p>
                  </div>
                </div>
              )}

              {formData.locationType === "store" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Region *</Label>
                      <Select
                        value={formData.state}
                        onValueChange={(value) => setFormData({ ...formData, state: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {NIGERIA_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state === "FCT" ? "FCT - Abuja" : state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        required={formData.locationType === "store"}
                        placeholder="e.g. Port Harcourt"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 relative">
                    <Label htmlFor="location">Store/Office Address *</Label>
                  <div className="relative">
                    <Input
                      id="location"
                      required
                      placeholder="Start typing your address..."
                      value={formData.location}
                      onChange={(e) => {
                        setFormData({ ...formData, location: e.target.value })
                        searchAddress(e.target.value)
                      }}
                      onFocus={() => {
                        if (locationSuggestions.length > 0) {
                          setShowSuggestions(true)
                        }
                      }}
                      autoComplete="off"
                    />
                    {loadingLocation && (
                      <div className="absolute right-3 top-3">
                        <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                  
                  {/* Suggestions Dropdown */}
                  {showSuggestions && locationSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {locationSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.place_id || index}
                          type="button"
                          className="w-full px-4 py-3 text-left text-popover-foreground hover:bg-accent/10 transition-colors border-b border-border last:border-b-0 flex items-start gap-2"
                          onMouseDown={(e) => {
                            e.preventDefault() // Prevent input blur
                            selectAddress(suggestion)
                          }}
                        >
                          <svg className="w-5 h-5 text-accent mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-popover-foreground">{suggestion.structured_formatting?.main_text || suggestion.description}</p>
                            {suggestion.structured_formatting?.secondary_text && (
                              <p className="text-xs text-muted-foreground">{suggestion.structured_formatting.secondary_text}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    <svg className="w-3 h-3 inline mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified by Mapbox - Start typing to see suggestions
                  </p>
                </div>
                </div>
              )}

              {formData.locationType === "online" && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-900">
                    ✓ Your service will be provided remotely via video calls, phone, or online platforms
                  </p>
                </div>
              )}

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-base">Google/Outlook Calendar Sync</Label>
                    <p className="text-xs text-muted-foreground">Paste your public iCal (.ics) URL to auto-block busy slots.</p>
                  </div>
                  <Switch checked={calendarSyncEnabled} onCheckedChange={setCalendarSyncEnabled} />
                </div>
                {calendarSyncEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="externalCalendarIcsUrl">Public iCal URL</Label>
                    <Input
                      id="externalCalendarIcsUrl"
                      placeholder="https://calendar.google.com/calendar/ical/.../public/basic.ics"
                      value={externalCalendarIcsUrl}
                      onChange={(e) => setExternalCalendarIcsUrl(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-base">Multi-location Pricing Rules</Label>
                    <p className="text-xs text-muted-foreground">Adjust pricing by state/city/location phrase and optional distance fee.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addLocationPricingRule}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Rule
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="distanceRatePerMile">Distance Fee Rate (N per mile)</Label>
                  <Input
                    id="distanceRatePerMile"
                    type="number"
                    min="0"
                    step="0.01"
                    value={distanceRatePerMile}
                    onChange={(e) => setDistanceRatePerMile(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    For car rentals, customers can enter trip distance and this rate will be applied to their quote.
                  </p>
                </div>

                {locationPricingRules.length > 0 && (
                  <div className="space-y-3">
                    {locationPricingRules.map((rule) => (
                      <div key={rule.id} className="rounded-md border p-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Rule Label</Label>
                            <Input
                              value={rule.label}
                              onChange={(e) =>
                                setLocationPricingRules((prev) =>
                                  prev.map((item) => (item.id === rule.id ? { ...item, label: e.target.value } : item))
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Match Type</Label>
                            <Select
                              value={rule.matchType}
                              onValueChange={(value: any) =>
                                setLocationPricingRules((prev) =>
                                  prev.map((item) => (item.id === rule.id ? { ...item, matchType: value } : item))
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="state">State</SelectItem>
                                <SelectItem value="city">City</SelectItem>
                                <SelectItem value="contains">Contains</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-2 md:col-span-1">
                            <Label>Match Value</Label>
                            <Input
                              value={rule.matchValue}
                              onChange={(e) =>
                                setLocationPricingRules((prev) =>
                                  prev.map((item) => (item.id === rule.id ? { ...item, matchValue: e.target.value } : item))
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Fixed Adj. (N)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={rule.fixedAdjustment}
                              onChange={(e) =>
                                setLocationPricingRules((prev) =>
                                  prev.map((item) => (item.id === rule.id ? { ...item, fixedAdjustment: e.target.value } : item))
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>% Adj.</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={rule.percentageAdjustment}
                              onChange={(e) =>
                                setLocationPricingRules((prev) =>
                                  prev.map((item) => (item.id === rule.id ? { ...item, percentageAdjustment: e.target.value } : item))
                                )
                              }
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end">
                          <Button type="button" variant="destructive" size="sm" onClick={() => removeLocationPricingRule(rule.id)}>
                            Remove Rule
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Availability */}
          <Card>
            <CardHeader>
              <CardTitle>Availability</CardTitle>
              <CardDescription>Set your working hours for each day</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {DAYS.map((day) => (
                <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 w-full sm:w-36 shrink-0">
                    <Switch
                      checked={availability[day].available}
                      className="border border-border data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                      onCheckedChange={(checked) =>
                        setAvailability({
                          ...availability,
                          [day]: { ...availability[day], available: checked },
                        })
                      }
                    />
                    <Label className="capitalize cursor-pointer">{day}</Label>
                  </div>

                  {availability[day].available && (
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:flex-1 min-w-0">
                      <Input
                        type="time"
                        value={availability[day].start}
                        onChange={(e) =>
                          setAvailability({
                            ...availability,
                            [day]: { ...availability[day], start: e.target.value },
                          })
                        }
                        className="w-full sm:w-36 min-w-0"
                      />
                      <span className="text-sm text-muted-foreground shrink-0">to</span>
                      <Input
                        type="time"
                        value={availability[day].end}
                        onChange={(e) =>
                          setAvailability({
                            ...availability,
                            [day]: { ...availability[day], end: e.target.value },
                          })
                        }
                        className="w-full sm:w-36 min-w-0"
                      />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Provider Logo</CardTitle>
              <CardDescription>Upload your brand logo as an image or PDF (optional, max 3MB)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-muted-foreground/40 overflow-hidden bg-muted/30 flex items-center justify-center">
                  {logoPreview && !logoIsPdf ? (
                    <img src={logoPreview} alt="Service logo preview" className="w-full h-full object-cover" />
                  ) : logoIsPdf ? (
                    <div className="text-center px-2">
                      <p className="text-[10px] font-semibold text-muted-foreground">PDF</p>
                    </div>
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="inline-flex items-center px-4 py-2 rounded-md border border-input bg-background hover:bg-accent/10 cursor-pointer text-sm font-medium">
                    Upload Logo
                    <input type="file" accept="image/*,application/pdf" onChange={handleLogoChange} className="hidden" />
                  </label>
                  {logoFile && (
                    <p className="text-xs text-muted-foreground truncate max-w-[220px]">{logoFileName}</p>
                  )}
                  {logoFile && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                      setLogoPreview("")
                      setLogoFile(null)
                      setLogoIsPdf(false)
                      setLogoFileName("")
                    }}>
                      Remove logo
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Portfolio Images</CardTitle>
              <CardDescription>Upload 5-10 images showcasing your past work (max 5MB each)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((img, index) => (
                  <div key={index} className="relative group">
                    <img src={img} alt={`Portfolio ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {images.length < 10 && (
                  <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-accent transition-colors">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Add Image ({images.length}/10)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {images.length > 0 && packageOptions.length > 1 && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div>
                    <Label className="text-base">Assign Images To Packages</Label>
                    <p className="text-xs text-muted-foreground">Select which uploaded images belong to each package (max 5 per package).</p>
                  </div>

                  <div className="space-y-4">
                    {packageOptions.map((pkg) => (
                      <div key={pkg.id} className="space-y-2">
                        <p className="text-sm font-medium">{pkg.name || "Unnamed Package"}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                          {images.map((img, imageIndex) => {
                            const selectedForPackage = (packageImageAssignments[pkg.id] || []).includes(imageIndex)
                            return (
                              <button
                                key={`${pkg.id}-${imageIndex}`}
                                type="button"
                                onClick={() => togglePackageImage(pkg.id, imageIndex)}
                                className={`relative rounded-md overflow-hidden border-2 transition-colors ${selectedForPackage ? 'border-accent ring-2 ring-accent/30' : 'border-border hover:border-accent/60'}`}
                              >
                                <img src={img} alt={`${pkg.name || 'Package'} image ${imageIndex + 1}`} className="w-full h-20 object-cover" />
                                <span className={`absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded ${selectedForPackage ? 'bg-accent text-white' : 'bg-black/50 text-white'}`}>
                                  {selectedForPackage ? 'Assigned' : 'Assign'}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {images.length < 5 && (
                <p className="text-sm text-amber-600">
                  <svg className="inline w-4 h-4 text-yellow-500 mr-2 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L1 21h22L12 2zm0 3.84L19.53 19H4.47L12 5.84zM11 16h2v2h-2v-2zm0-6h2v4h-2v-4z"/>
                  </svg>
                  Tip: Upload at least 5 images to showcase your work portfolio effectively
                </p>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Creating..." : "Create Service"}
            </Button>
          </div>
        </form>
      </div>
    </VendorLayout>
  )
}
