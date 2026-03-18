"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import VendorLayout from "@/components/vendor/VendorLayout"
import { useAuth } from "@/contexts/AuthContext"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Loader2 } from "lucide-react"

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
  "marketing",
  "legal",
  "healthcare",
  "logistics",
  "home-improvement",
  "automotive",
  "event-planning",
  "other",
]

const initialAvailability = DAYS.reduce((acc, day) => {
  acc[day] = { start: "09:00", end: "17:00", available: day !== "sunday" }
  return acc
}, {} as Record<string, { start: string; end: string; available: boolean }>)

type WizardStep = "basic" | "pricing" | "delivery" | "availability" | "publish"

const stepOrder: Array<{ key: WizardStep; title: string; description: string }> = [
  { key: "basic", title: "Basic", description: "Title, category, description" },
  { key: "pricing", title: "Pricing", description: "Price and billing model" },
  { key: "delivery", title: "Delivery", description: "Where service is provided" },
  { key: "availability", title: "Availability", description: "Working days and hours" },
  { key: "publish", title: "Publish", description: "Review and create service" },
]

export default function ServiceSetupWizardPage() {
  const router = useRouter()
  const { user, userProfile } = useAuth()
  const { toast } = useToast()

  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState("")
  const [logoUploading, setLogoUploading] = useState(false)

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    price: "",
    pricingType: "fixed" as "fixed" | "hourly" | "per-session" | "custom",
    duration: "60",
    locationType: "online" as "online" | "home-service" | "store",
    location: "",
    state: "",
    city: "",
    tags: "",
  })

  const [availability, setAvailability] = useState(initialAvailability)

  const activeStep = stepOrder[stepIndex]

  const completion = useMemo(() => {
    return {
      basic: formData.title.trim().length > 2 && formData.description.trim().length > 10 && formData.category.trim().length > 0,
      pricing: Number(formData.price) > 0,
      delivery:
        formData.locationType === "online" ||
        (formData.locationType === "home-service" && formData.state.trim().length > 1) ||
        (formData.locationType === "store" && formData.location.trim().length > 4),
      availability: Object.values(availability).some((day) => day.available),
      publish: false,
    }
  }, [availability, formData])

  const handleLogoChange = (file: File | null) => {
    if (!file) return

    const isImage = file.type.startsWith("image/")
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
    if (!isImage && !isPdf) {
      toast({ title: "Unsupported file", description: "Upload image or PDF only.", variant: "destructive" })
      return
    }

    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 3MB.", variant: "destructive" })
      return
    }

    setLogoFile(file)

    if (isPdf) {
      setLogoPreview("")
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => setLogoPreview(String(reader.result || ""))
    reader.readAsDataURL(file)
  }

  const buildLocationValue = () => {
    if (formData.locationType === "online") return "Online"
    if (formData.locationType === "home-service") {
      const parts = [formData.city.trim(), formData.state.trim()].filter(Boolean)
      return parts.join(", ") || "Nigeria"
    }
    return formData.location.trim() || "Not specified"
  }

  const createService = async () => {
    if (!user?.uid || !userProfile) {
      throw new Error("Please log in as vendor")
    }

    let providerImage = ""
    if (logoFile) {
      setLogoUploading(true)
      providerImage = await uploadToCloudinary(logoFile)
      setLogoUploading(false)
    }

    const payload: any = {
      providerId: user.uid,
      providerName: userProfile.displayName || userProfile.name || "Vendor",
      providerImage,
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      price: Number(formData.price),
      pricingType: formData.pricingType,
      duration: Number(formData.duration) || 60,
      locationType: formData.locationType,
      location: buildLocationValue(),
      state: formData.state.trim(),
      city: formData.city.trim(),
      tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
      availability,
      images: [],
      featured: false,
      status: "active",
      packageOptions: [],
      addOnOptions: [],
      requiresQuote: false,
      quoteNotesTemplate: "",
      quoteSlaHours: 24,
      calendarSyncEnabled: false,
      externalCalendarIcsUrl: "",
      locationPricingRules: [],
      distanceRatePerMile: 0,
    }

    const response = await fetch("/api/vendor/services/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result?.error || result?.details || "Failed to create service")
    }
  }

  const handleContinue = async () => {
    if (activeStep.key !== "publish") {
      if (!completion[activeStep.key]) {
        setMessage("Please complete required fields in this step before continuing")
        return
      }
      setMessage("")
      setStepIndex((prev) => Math.min(stepOrder.length - 1, prev + 1))
      return
    }

    try {
      setSaving(true)
      setMessage("")
      await createService()
      toast({ title: "Service created", description: "Your service setup is complete." })
      router.push("/vendor/services")
    } catch (error: any) {
      setMessage(error?.message || "Unable to create service")
      toast({ title: "Error", description: error?.message || "Unable to create service", variant: "destructive" })
    } finally {
      setSaving(false)
      setLogoUploading(false)
    }
  }

  return (
    <VendorLayout>
      <div className="space-y-6 max-w-4xl">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div>
          <h1 className="text-3xl font-bold">Service Setup Wizard</h1>
          <p className="text-muted-foreground">Complete these steps to publish your first service.</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span>Step {stepIndex + 1} of {stepOrder.length}</span>
              <span>{Math.round(((stepIndex + 1) / stepOrder.length) * 100)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${((stepIndex + 1) / stepOrder.length) * 100}%` }} />
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-5">
              {stepOrder.map((step, idx) => (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setStepIndex(idx)}
                  className={`rounded border px-3 py-2 text-left text-xs transition ${idx === stepIndex ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <p className="font-semibold">{idx + 1}. {step.title}</p>
                  <p className="text-muted-foreground">{step.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{activeStep.title}</CardTitle>
            <CardDescription>{activeStep.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeStep.key === "basic" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="title">Service Title</Label>
                  <Input id="title" value={formData.title} onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))} placeholder="e.g. Home Deep Cleaning" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category || undefined} onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}>
                    <SelectTrigger id="category"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" rows={4} value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="providerImage">Brand Image (optional)</Label>
                  <Input id="providerImage" type="file" accept="image/*,application/pdf" onChange={(e) => handleLogoChange(e.target.files?.[0] || null)} />
                  {logoUploading ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading logo...</p>
                  ) : null}
                  {logoPreview ? <img src={logoPreview} alt="Logo preview" className="h-16 w-16 rounded object-cover border" /> : null}
                </div>
              </>
            )}

            {activeStep.key === "pricing" && (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Base Price (Naira)</Label>
                    <Input id="price" type="number" min={1} value={formData.price} onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pricingType">Pricing Type</Label>
                    <Select value={formData.pricingType} onValueChange={(value: any) => setFormData((prev) => ({ ...prev, pricingType: value }))}>
                      <SelectTrigger id="pricingType"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="per-session">Per Session</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input id="duration" type="number" min={15} step={15} value={formData.duration} onChange={(e) => setFormData((prev) => ({ ...prev, duration: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (optional)</Label>
                  <Input id="tags" value={formData.tags} onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))} placeholder="cleaning, deep-clean, home" />
                </div>
              </>
            )}

            {activeStep.key === "delivery" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="locationType">Location Type</Label>
                  <Select value={formData.locationType} onValueChange={(value: any) => setFormData((prev) => ({ ...prev, locationType: value }))}>
                    <SelectTrigger id="locationType"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="home-service">Home Service</SelectItem>
                      <SelectItem value="store">At Store/Office</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.locationType === "home-service" && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input id="state" value={formData.state} onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))} placeholder="Lagos" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City (optional)</Label>
                      <Input id="city" value={formData.city} onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))} placeholder="Ikeja" />
                    </div>
                  </div>
                )}

                {formData.locationType === "store" && (
                  <div className="space-y-2">
                    <Label htmlFor="location">Store Address</Label>
                    <Input id="location" value={formData.location} onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))} placeholder="Full address" />
                  </div>
                )}
              </>
            )}

            {activeStep.key === "availability" && (
              <div className="space-y-3">
                {DAYS.map((day) => (
                  <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 w-full sm:w-36 shrink-0">
                      <Switch
                        checked={availability[day].available}
                        className="border border-border data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                        onCheckedChange={(checked) =>
                          setAvailability((prev) => ({
                            ...prev,
                            [day]: { ...prev[day], available: checked },
                          }))
                        }
                      />
                      <Label className="capitalize">{day}</Label>
                    </div>
                    {availability[day].available && (
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:flex-1 min-w-0">
                        <Input
                          type="time"
                          value={availability[day].start}
                          onChange={(e) => setAvailability((prev) => ({ ...prev, [day]: { ...prev[day], start: e.target.value } }))}
                          className="w-full sm:w-36 min-w-0"
                        />
                        <span className="text-sm text-muted-foreground shrink-0">to</span>
                        <Input
                          type="time"
                          value={availability[day].end}
                          onChange={(e) => setAvailability((prev) => ({ ...prev, [day]: { ...prev[day], end: e.target.value } }))}
                          className="w-full sm:w-36 min-w-0"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeStep.key === "publish" && (
              <div className="space-y-3 text-sm">
                <div className="rounded-md border p-3 bg-muted/30">
                  <p className="font-semibold">Service summary</p>
                  <p className="text-muted-foreground mt-1">{formData.title || "Untitled service"}</p>
                  <p className="text-muted-foreground">Category: {formData.category || "Not set"}</p>
                  <p className="text-muted-foreground">Price: {formData.price ? `N${Number(formData.price).toLocaleString()}` : "Not set"}</p>
                  <p className="text-muted-foreground">Location Type: {formData.locationType}</p>
                </div>
                <p className="text-xs text-muted-foreground">Click Publish Service to create your first service. You can add packages, add-ons and advanced settings later from Add Service page.</p>
              </div>
            )}

            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))} disabled={stepIndex === 0 || saving || logoUploading}>
                Previous
              </Button>
              <Button type="button" onClick={handleContinue} disabled={saving || logoUploading}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {activeStep.key === "publish" ? "Publish Service" : "Save & Continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </VendorLayout>
  )
}
