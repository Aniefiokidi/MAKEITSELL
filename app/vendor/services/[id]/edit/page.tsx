"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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

const makeOptionId = () => `opt-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

type ServicePackageOption = {
  id: string
  name: string
  description?: string
  price: number
  duration?: number
  pricingType: "fixed" | "hourly" | "per-session" | "custom"
  isDefault?: boolean
  active?: boolean
  images?: string[]
  attachments?: any[]
}

type EditableService = {
  id: string
  title: string
  description: string
  category: string
  subcategory?: string
  price?: number
  pricingType?: string
  duration?: number
  locationType?: "online" | "home-service" | "store"
  location?: string
  state?: string
  city?: string
  status?: "active" | "paused" | "inactive"
  tags?: string[]
  images?: string[]
  packageOptions?: ServicePackageOption[]
  addOnOptions?: any[]
}

export default function ServiceEditPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = String((params as { id?: string })?.id || "")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [service, setService] = useState<EditableService | null>(null)
  const [tagsInput, setTagsInput] = useState("")

  useEffect(() => {
    async function fetchService() {
      if (!id) return

      setLoading(true)
      setError("")

      try {
        const response = await fetch(`/api/database/services/${id}`)
        const payload = await response.json().catch(() => null)

        if (!response.ok || !payload?.success || !payload?.data) {
          throw new Error(payload?.error || "Service not found")
        }

        const data = payload.data as any
        const normalizedPackages: ServicePackageOption[] = Array.isArray(data.packageOptions) && data.packageOptions.length > 0
          ? data.packageOptions.map((pkg: any, index: number) => ({
              id: String(pkg?.id || makeOptionId()),
              name: String(pkg?.name || ""),
              description: String(pkg?.description || ""),
              price: Number(pkg?.price || 0),
              duration: Number(pkg?.duration || 60),
              pricingType: (["fixed", "hourly", "per-session", "custom"].includes(pkg?.pricingType) ? pkg.pricingType : "fixed") as ServicePackageOption["pricingType"],
              isDefault: Boolean(pkg?.isDefault) || index === 0,
              active: pkg?.active !== false,
              images: Array.isArray(pkg?.images) ? pkg.images : [],
              attachments: Array.isArray(pkg?.attachments) ? pkg.attachments : [],
            }))
          : [{
              id: makeOptionId(),
              name: "Standard",
              description: "",
              price: Number(data.price || 0),
              duration: Number(data.duration || 60),
              pricingType: "fixed",
              isDefault: true,
              active: true,
              images: Array.isArray(data.images) ? data.images : [],
              attachments: [],
            }]

        setService({
          id: data.id,
          title: data.title || "",
          description: data.description || "",
          category: data.category || "other",
          subcategory: data.subcategory || "",
          price: Number(data.price || 0),
          pricingType: data.pricingType || "fixed",
          duration: Number(data.duration || 60),
          locationType: (data.locationType as any) || "online",
          location: data.location || "",
          state: data.state || "",
          city: data.city || "",
          status: (data.status as any) || "active",
          tags: Array.isArray(data.tags) ? data.tags : [],
          images: Array.isArray(data.images) ? data.images : [],
          packageOptions: normalizedPackages,
          addOnOptions: Array.isArray(data.addOnOptions) ? data.addOnOptions : [],
        })
        setTagsInput(Array.isArray(data.tags) ? data.tags.join(", ") : "")
      } catch (err: any) {
        setError(err?.message || "Unable to load service")
      } finally {
        setLoading(false)
      }
    }

    fetchService()
  }, [id])

  const primaryImage = useMemo(() => {
    if (Array.isArray(service?.images) && service.images.length > 0) return service.images[0]
    const packageImage = (service?.packageOptions || [])
      .find((pkg: any) => Array.isArray(pkg?.images) && pkg.images.length > 0)
      ?.images?.[0]
    return packageImage || ""
  }, [service])

  const updateField = (field: keyof EditableService, value: any) => {
    setService((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const updatePackage = (packageId: string, field: keyof ServicePackageOption, value: any) => {
    setService((prev) => {
      if (!prev) return prev
      const current = Array.isArray(prev.packageOptions) ? prev.packageOptions : []
      return {
        ...prev,
        packageOptions: current.map((pkg) => pkg.id === packageId ? { ...pkg, [field]: value } : pkg),
      }
    })
  }

  const addPackage = () => {
    setService((prev) => {
      if (!prev) return prev
      const current = Array.isArray(prev.packageOptions) ? prev.packageOptions : []
      return {
        ...prev,
        packageOptions: [
          ...current,
          {
            id: makeOptionId(),
            name: "",
            description: "",
            price: 0,
            duration: Number(prev.duration || 60),
            pricingType: "fixed",
            isDefault: current.length === 0,
            active: true,
            images: [],
            attachments: [],
          },
        ],
      }
    })
  }

  const removePackage = (packageId: string) => {
    setService((prev) => {
      if (!prev) return prev
      const current = Array.isArray(prev.packageOptions) ? prev.packageOptions : []
      const next = current.filter((pkg) => pkg.id !== packageId)
      if (!next.some((pkg) => pkg.isDefault) && next.length > 0) {
        next[0] = { ...next[0], isDefault: true }
      }
      return { ...prev, packageOptions: next }
    })
  }

  const setDefaultPackage = (packageId: string) => {
    setService((prev) => {
      if (!prev) return prev
      const current = Array.isArray(prev.packageOptions) ? prev.packageOptions : []
      return {
        ...prev,
        packageOptions: current.map((pkg) => ({ ...pkg, isDefault: pkg.id === packageId })),
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!service) return

    setSaving(true)
    setError("")

    try {
      const normalizedPackageOptions = (service.packageOptions || [])
        .filter((pkg) => pkg && pkg.name?.trim())
        .map((pkg, index) => ({
          id: pkg.id || makeOptionId(),
          name: pkg.name.trim(),
          description: pkg.description?.trim() || "",
          price: Number(pkg.price || 0),
          duration: Number(pkg.duration || service.duration || 60),
          pricingType: pkg.pricingType || "fixed",
          isDefault: Boolean(pkg.isDefault) || index === 0,
          active: pkg.active !== false,
          images: Array.isArray(pkg.images) ? pkg.images : [],
          attachments: Array.isArray(pkg.attachments) ? pkg.attachments : [],
        }))

      const packagePrices = normalizedPackageOptions
        .map((pkg) => Number(pkg.price || 0))
        .filter((value) => Number.isFinite(value) && value >= 0)

      const defaultPackage = normalizedPackageOptions.find((pkg) => pkg.isDefault) || normalizedPackageOptions[0]
      const computedPrice = packagePrices.length > 0 ? Math.min(...packagePrices) : Number(service.price || 0)

      const response = await fetch(`/api/vendor/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: service.title,
          description: service.description,
          category: service.category,
          subcategory: service.subcategory || "",
          price: computedPrice,
          pricingType: defaultPackage?.pricingType || service.pricingType,
          duration: Number(defaultPackage?.duration || service.duration || 60),
          locationType: service.locationType,
          location: service.location || "",
          state: service.state || "",
          city: service.city || "",
          status: service.status || "active",
          tags: tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean),
          images: service.images || [],
          packageOptions: normalizedPackageOptions,
          addOnOptions: service.addOnOptions || [],
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update service")
      }

      toast({ title: "Service updated", description: "Your changes have been saved." })
      router.push("/vendor/services")
    } catch (err: any) {
      const message = err?.message || "Failed to update service"
      setError(message)
      toast({ title: "Update failed", description: message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <VendorLayout>
        <div className="flex min-h-80 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </VendorLayout>
    )
  }

  if (!service) {
    return (
      <VendorLayout>
        <div className="p-4">
          <Alert variant="destructive">
            <AlertDescription>{error || "Service not found"}</AlertDescription>
          </Alert>
        </div>
      </VendorLayout>
    )
  }

  return (
    <VendorLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Service</h1>
          <p className="text-muted-foreground">Update your service details.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Core details your customers will see.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {primaryImage ? (
                <div className="h-48 w-full overflow-hidden rounded border">
                  <img src={primaryImage} alt={service.title} className="h-full w-full object-cover" />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={service.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  required
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={service.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  required
                  disabled={saving}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={service.category} onValueChange={(value) => updateField("category", value)}>
                    <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={service.status || "active"} onValueChange={(value: any) => updateField("status", value)}>
                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="paused">paused</SelectItem>
                      <SelectItem value="inactive">inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing and Location</CardTitle>
              <CardDescription>Base values used for display and discovery.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="price">Base Price (Naira)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    value={service.price || 0}
                    onChange={(e) => updateField("price", e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={15}
                    step={15}
                    value={service.duration || 60}
                    onChange={(e) => updateField("duration", e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationType">Location Type</Label>
                <Select value={service.locationType || "online"} onValueChange={(value: any) => updateField("locationType", value)}>
                  <SelectTrigger id="locationType"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">online</SelectItem>
                    <SelectItem value="home-service">home-service</SelectItem>
                    <SelectItem value="store">store</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={service.location || ""}
                  onChange={(e) => updateField("location", e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={service.state || ""}
                    onChange={(e) => updateField("state", e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={service.city || ""}
                    onChange={(e) => updateField("city", e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  disabled={saving}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Package Options</CardTitle>
                  <CardDescription>Edit package names and prices used on your service card.</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addPackage} disabled={saving}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Package
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(service.packageOptions || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No package options yet.</p>
              ) : (
                (service.packageOptions || []).map((pkg, index) => (
                  <div key={pkg.id || index} className="space-y-3 rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">Package {index + 1}</p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant={pkg.isDefault ? "default" : "outline"}
                          size="sm"
                          onClick={() => setDefaultPackage(pkg.id)}
                          disabled={saving}
                        >
                          {pkg.isDefault ? "Default" : "Set Default"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removePackage(pkg.id)}
                          disabled={saving || (service.packageOptions || []).length <= 1}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={pkg.name || ""}
                          onChange={(e) => updatePackage(pkg.id, "name", e.target.value)}
                          disabled={saving}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Price (Naira)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={Number(pkg.price || 0)}
                          onChange={(e) => updatePackage(pkg.id, "price", Number(e.target.value || 0))}
                          disabled={saving}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Duration (minutes)</Label>
                        <Input
                          type="number"
                          min={15}
                          step={15}
                          value={Number(pkg.duration || 60)}
                          onChange={(e) => updatePackage(pkg.id, "duration", Number(e.target.value || 60))}
                          disabled={saving}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Pricing Type</Label>
                        <Select
                          value={pkg.pricingType || "fixed"}
                          onValueChange={(value: ServicePackageOption["pricingType"]) => updatePackage(pkg.id, "pricingType", value)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">fixed</SelectItem>
                            <SelectItem value="hourly">hourly</SelectItem>
                            <SelectItem value="per-session">per-session</SelectItem>
                            <SelectItem value="custom">custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        rows={2}
                        value={pkg.description || ""}
                        onChange={(e) => updatePackage(pkg.id, "description", e.target.value)}
                        disabled={saving}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={pkg.active === false ? "inactive" : "active"}
                        onValueChange={(value) => updatePackage(pkg.id, "active", value === "active")}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">active</SelectItem>
                          <SelectItem value="inactive">inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/vendor/services")} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving...</span>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </div>
    </VendorLayout>
  )
}
