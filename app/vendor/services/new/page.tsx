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
import { ArrowLeft, Upload, X } from "lucide-react"

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
  "other",
]

export default function NewServicePage() {
  const router = useRouter()
  const { user, userProfile } = useAuth()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    price: "",
    pricingType: "fixed" as "fixed" | "hourly" | "per-session" | "custom",
    duration: "",
    location: "",
    state: "",
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
  const [loading, setLoading] = useState(false)

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

      // Prepare service data
      let locationValue = "Online"
      if (formData.locationType === "home-service") {
        locationValue = formData.state || "Nigeria"
      } else if (formData.locationType === "store") {
        locationValue = formData.location || "Not specified"
      }

      const serviceData: any = {
        providerId: user.uid,
        providerName: userProfile.displayName,
        providerImage: "",
        title: formData.title,
        description: formData.description,
        category: formData.category,
        price: parseFloat(formData.price),
        pricingType: formData.pricingType,
        location: locationValue,
        locationType: formData.locationType,
        images: imageUrls,
        availability,
        featured: false,
        status: "active" as const,
        tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
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
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (₦) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pricingType">Pricing Type *</Label>
                  <Select
                    value={formData.pricingType}
                    onValueChange={(value: any) => setFormData({ ...formData, pricingType: value })}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="60"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                />
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
                    setFormData({ ...formData, locationType: value, location: "", state: "" })
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
                      <SelectItem value="Abia">Abia</SelectItem>
                      <SelectItem value="Adamawa">Adamawa</SelectItem>
                      <SelectItem value="Akwa Ibom">Akwa Ibom</SelectItem>
                      <SelectItem value="Anambra">Anambra</SelectItem>
                      <SelectItem value="Bauchi">Bauchi</SelectItem>
                      <SelectItem value="Bayelsa">Bayelsa</SelectItem>
                      <SelectItem value="Benue">Benue</SelectItem>
                      <SelectItem value="Borno">Borno</SelectItem>
                      <SelectItem value="Cross River">Cross River</SelectItem>
                      <SelectItem value="Delta">Delta</SelectItem>
                      <SelectItem value="Ebonyi">Ebonyi</SelectItem>
                      <SelectItem value="Edo">Edo</SelectItem>
                      <SelectItem value="Ekiti">Ekiti</SelectItem>
                      <SelectItem value="Enugu">Enugu</SelectItem>
                      <SelectItem value="FCT">FCT - Abuja</SelectItem>
                      <SelectItem value="Gombe">Gombe</SelectItem>
                      <SelectItem value="Imo">Imo</SelectItem>
                      <SelectItem value="Jigawa">Jigawa</SelectItem>
                      <SelectItem value="Kaduna">Kaduna</SelectItem>
                      <SelectItem value="Kano">Kano</SelectItem>
                      <SelectItem value="Katsina">Katsina</SelectItem>
                      <SelectItem value="Kebbi">Kebbi</SelectItem>
                      <SelectItem value="Kogi">Kogi</SelectItem>
                      <SelectItem value="Kwara">Kwara</SelectItem>
                      <SelectItem value="Lagos">Lagos</SelectItem>
                      <SelectItem value="Nasarawa">Nasarawa</SelectItem>
                      <SelectItem value="Niger">Niger</SelectItem>
                      <SelectItem value="Ogun">Ogun</SelectItem>
                      <SelectItem value="Ondo">Ondo</SelectItem>
                      <SelectItem value="Osun">Osun</SelectItem>
                      <SelectItem value="Oyo">Oyo</SelectItem>
                      <SelectItem value="Plateau">Plateau</SelectItem>
                      <SelectItem value="Rivers">Rivers</SelectItem>
                      <SelectItem value="Sokoto">Sokoto</SelectItem>
                      <SelectItem value="Taraba">Taraba</SelectItem>
                      <SelectItem value="Yobe">Yobe</SelectItem>
                      <SelectItem value="Zamfara">Zamfara</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Select the state where you provide home services</p>
                </div>
              )}

              {formData.locationType === "store" && (
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
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {locationSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.place_id || index}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-accent/10 transition-colors border-b last:border-b-0 flex items-start gap-2"
                          onMouseDown={(e) => {
                            e.preventDefault() // Prevent input blur
                            selectAddress(suggestion)
                          }}
                        >
                          <svg className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{suggestion.structured_formatting?.main_text || suggestion.description}</p>
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
              )}

              {formData.locationType === "online" && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-900">
                    ✓ Your service will be provided remotely via video calls, phone, or online platforms
                  </p>
                </div>
              )}
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
                <div key={day} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="flex items-center gap-2 w-32">
                    <Switch
                      checked={availability[day].available}
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
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={availability[day].start}
                        onChange={(e) =>
                          setAvailability({
                            ...availability,
                            [day]: { ...availability[day], start: e.target.value },
                          })
                        }
                        className="max-w-32"
                      />
                      <span>to</span>
                      <Input
                        type="time"
                        value={availability[day].end}
                        onChange={(e) =>
                          setAvailability({
                            ...availability,
                            [day]: { ...availability[day], end: e.target.value },
                          })
                        }
                        className="max-w-32"
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
