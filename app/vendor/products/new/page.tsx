"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useNotification } from "@/contexts/NotificationContext"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { useRouter, useSearchParams } from "next/navigation"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, X, Loader2, Plus } from "lucide-react"
import { PHONE_MODEL_GROUPS } from "@/lib/phone-models"

const categories = [
  "Electronics",
  "Fashion",
  "Home & Garden",
  "Sports & Outdoors",
  "Books",
  "Toys & Games",
  "Health & Beauty",
  "Automotive",
  "Tools",
  "Food & Beverages",
]

const fashionSubcategories = [
  "Shoes",
  "Wig",
  "Jewelry",
  "Shirts",
  "Sweaters",
  "Swimwear",
  "Pants & Jeans",
  "Dresses",
  "Jackets & Coats",
  "Accessories",
  "Bags",
  "Hats & Caps",
  "Socks & Underwear",
]

const electronicsSubcategories = ["Phone Cases"]

const predefinedSizes = ["S", "M", "L", "XL", "XXL"]
const shoeSizes = Array.from({ length: 31 }, (_, index) => String(index + 35))

const predefinedColors = [
  "Black",
  "White",
  "Gray",
  "Red",
  "Blue",
  "Navy Blue",
  "Green",
  "Yellow",
  "Orange",
  "Pink",
  "Purple",
  "Brown",
  "Beige",
  "Cream",
  "Maroon",
  "Teal",
  "Turquoise",
  "Gold",
  "Silver",
  "Olive",
  "Burgundy",
  "Mint",
  "Lavender",
  "Coral"
]

export default function NewProduct() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, userProfile } = useAuth()
  const { success, error: showError, warning, info } = useNotification()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    subcategory: "",
    stock: "",
    lowStockThreshold: "3",
    sku: "",
    featured: false,
    hasColorOptions: false,
    hasSizeOptions: false,
    weightKg: "",
  })
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [productDocuments, setProductDocuments] = useState<File[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [sizes, setSizes] = useState<string[]>([])
  const [newColor, setNewColor] = useState("")
  const [newSize, setNewSize] = useState("")
  const [colorImages, setColorImages] = useState<{ [color: string]: File[] }>({})
  const [colorPreviews, setColorPreviews] = useState<{ [color: string]: string[] }>({})
  const [colorImageMapping, setColorImageMapping] = useState<{ [color: string]: number }>({})
  // model name -> stock count. A model's presence as a key is what "selected" means —
  // removing a model deletes its key entirely rather than leaving a stale stock number
  // an unchecked box could confuse for "still active."
  const [compatiblePhoneModels, setCompatiblePhoneModels] = useState<Record<string, number>>({})
  const [phoneModelFilter, setPhoneModelFilter] = useState("")

  const isShoeSubcategory =
    formData.category === "Fashion" &&
    ["shoe", "shoes"].includes(formData.subcategory.toLowerCase())

  const isPhoneCaseSubcategory =
    formData.category === "Electronics" && formData.subcategory === "Phone Cases"

  const availableSizeOptions = isShoeSubcategory ? shoeSizes : predefinedSizes

  const togglePhoneModel = (model: string) => {
    setCompatiblePhoneModels((prev) => {
      if (model in prev) {
        const next = { ...prev }
        delete next[model]
        return next
      }
      return { ...prev, [model]: 0 }
    })
  }

  const setPhoneModelStock = (model: string, stock: number) => {
    setCompatiblePhoneModels((prev) => ({ ...prev, [model]: Math.max(0, stock) }))
  }

  const addColor = () => {
    if (newColor && !colors.includes(newColor)) {
      setColors([...colors, newColor])
      setNewColor("")
    }
  }

  const removeColor = (color: string) => {
    setColors(colors.filter(c => c !== color))
    // Remove color images and mapping too
    const newColorImages = { ...colorImages }
    const newColorPreviews = { ...colorPreviews }
    const newColorImageMapping = { ...colorImageMapping }
    delete newColorImages[color]
    delete newColorPreviews[color]
    delete newColorImageMapping[color]
    setColorImages(newColorImages)
    setColorPreviews(newColorPreviews)
    setColorImageMapping(newColorImageMapping)
  }

  const toggleSize = (size: string) => {
    if (sizes.includes(size)) {
      setSizes(sizes.filter(s => s !== size))
    } else {
      setSizes([...sizes, size])
    }
  }

  const toggleColor = (color: string) => {
    if (colors.includes(color)) {
      removeColor(color)
    } else {
      setColors([...colors, color])
    }
  }

  const addSize = () => {
    if (newSize && !sizes.includes(newSize)) {
      setSizes([...sizes, newSize])
      setNewSize("")
    }
  }

  const removeSize = (size: string) => {
    setSizes(sizes.filter(s => s !== size))
  }

  const handleColorImagesUpload = (color: string, files: FileList | null) => {
    if (!files) return
    
    const fileArray = Array.from(files)
    const newPreviews: string[] = []
    
    fileArray.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        newPreviews.push(e.target?.result as string)
        if (newPreviews.length === fileArray.length) {
          setColorPreviews(prev => ({
            ...prev,
            [color]: [...(prev[color] || []), ...newPreviews]
          }))
        }
      }
      reader.readAsDataURL(file)
    })
    
    setColorImages(prev => ({
      ...prev,
      [color]: [...(prev[color] || []), ...fileArray]
    }))
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const selectedFiles = Array.from(files)
      const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"))
      const pdfFiles = selectedFiles.filter((file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name))
      const unsupportedCount = selectedFiles.length - imageFiles.length - pdfFiles.length

      if (unsupportedCount > 0) {
        warning("Unsupported files skipped", "Only images and PDFs can be uploaded.")
      }

      if (pdfFiles.length > 0) {
        setProductDocuments((prev) => [...prev, ...pdfFiles].slice(0, 5)) // Max 5 PDFs
      }

      if (imageFiles.length === 0) return

      setImages((prev) => [...prev, ...imageFiles].slice(0, 5)) // Max 5 images
      // Generate previews for image files only
      imageFiles.forEach((file) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreviews((prev) => [...prev, reader.result as string].slice(0, 5))
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const removeImage = (index: number) => {
  setImages((prev) => prev.filter((_, i) => i !== index))
  setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const removeDocument = (index: number) => {
    setProductDocuments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // Validation
      if (!formData.title || !formData.description || !formData.price || !formData.category) {
        throw new Error("Please fill in all required fields")
      }
      if (Number.parseFloat(formData.price) <= 0) {
        throw new Error("Price must be greater than 0")
      }
      if (Number.parseInt(formData.stock) < 0) {
        throw new Error("Stock cannot be negative")
      }
      if (!user || !userProfile) {
        throw new Error("You must be logged in as a vendor to add products.")
      }

      // Upload main product images to Cloudinary
      const imageUrls: string[] = []
      for (const file of images) {
        const url = await uploadToCloudinary(file)
        imageUrls.push(url)
      }

      const documentUrls: string[] = []
      for (const file of productDocuments) {
        const url = await uploadToCloudinary(file)
        documentUrls.push(url)
      }

      // Create color to image URL mapping
      const colorImageUrls: { [key: string]: string } = {}
      for (const [color, imageIndex] of Object.entries(colorImageMapping)) {
        if (imageUrls[imageIndex]) {
          colorImageUrls[color] = imageUrls[imageIndex]
        }
      }

      // Create product via API
      const response = await fetch('/api/database/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.title, // PATCH: send 'name' for Product model
          description: formData.description,
          price: Number(formData.price),
          category: formData.category,
          subcategory: formData.subcategory || null,
          images: imageUrls,
          productDocuments: documentUrls,
          vendorId: user.uid,
          vendorName: userProfile?.displayName || user.email || "Vendor",
          // Phone Cases: overall stock is the sum of what's set per model — one
          // authoritative number, not a second vendor-editable figure that could disagree
          // with the per-model breakdown.
          stock: formData.category === 'Food & Beverages'
            ? 9999
            : isPhoneCaseSubcategory
              ? Object.values(compatiblePhoneModels).reduce((sum, n) => sum + n, 0)
              : (Number(formData.stock) || 0),
          lowStockThreshold: formData.category === 'Food & Beverages' ? 3 : Math.max(0, Number(formData.lowStockThreshold) || 3),
          sku: formData.sku,
          featured: formData.featured,
          status: "active",
          sales: 0,
          hasColorOptions: colors.length > 0,
          hasSizeOptions: sizes.length > 0,
          colors: colors,
          sizes: sizes,
          colorImages: colorImageUrls,
          compatiblePhoneModels: isPhoneCaseSubcategory
            ? Object.entries(compatiblePhoneModels).map(([model, stock]) => ({ model, stock }))
            : undefined,
          weightKg: formData.weightKg ? Number(formData.weightKg) : undefined,
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create product')
      }

      success('Product created successfully!', 'Your product is now live')
      const returnTo = searchParams.get("returnTo")
      const returnStep = searchParams.get("step")
      if (returnTo === "setup-wizard") {
        router.push(`/vendor/setup-wizard${returnStep ? `?step=${returnStep}` : ""}`)
      } else {
        router.push("/vendor/products")
      }
    } catch (error: any) {
      const errorMessage = error.message || "Failed to create product"
      setError(errorMessage)
      showError(errorMessage, 'Product Creation Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <VendorLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-balance">Add New Product</h1>
          <p className="text-muted-foreground">Create a new product listing for your store</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Essential details about your product</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Product Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter product title"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your product..."
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (₦) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => handleInputChange("price", e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => {
                    handleInputChange("category", value)
                    // Reset subcategory (and anything scoped to it) whenever category
                    // actually changes — Fashion's and Electronics' subcategory lists are
                    // disjoint, so carrying one over into the other would show a value
                    // that doesn't belong to either list.
                    handleInputChange("subcategory", "")
                    setSizes([])
                    setCompatiblePhoneModels({})
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fashion Subcategory */}
              {formData.category === "Fashion" && (
                <div className="space-y-2">
                  <Label htmlFor="subcategory">Fashion Subcategory</Label>
                  <Select value={formData.subcategory} onValueChange={(value) => {
                    handleInputChange("subcategory", value)
                    setSizes([])
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select fashion subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {fashionSubcategories.map((subcategory) => (
                        <SelectItem key={subcategory} value={subcategory}>
                          {subcategory}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Electronics Subcategory */}
              {formData.category === "Electronics" && (
                <div className="space-y-2">
                  <Label htmlFor="subcategory">Electronics Subcategory</Label>
                  <Select value={formData.subcategory} onValueChange={(value) => {
                    handleInputChange("subcategory", value)
                    if (value !== "Phone Cases") setCompatiblePhoneModels({})
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select electronics subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {electronicsSubcategories.map((subcategory) => (
                        <SelectItem key={subcategory} value={subcategory}>
                          {subcategory}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {isPhoneCaseSubcategory ? (
                  <div className="space-y-2">
                    <Label>Stock</Label>
                    <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                      Set per phone model below
                    </div>
                  </div>
                ) : formData.category !== 'Food & Beverages' ? (
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock Quantity</Label>
                    <Input
                      id="stock"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.stock}
                      onChange={(e) => handleInputChange("stock", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Stock</Label>
                    <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                      Made to order
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    placeholder="Product SKU"
                    value={formData.sku}
                    onChange={(e) => handleInputChange("sku", e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              {formData.category !== 'Food & Beverages' && (
                <div className="space-y-2">
                  <Label htmlFor="lowStockThreshold">Low Stock Alert Threshold</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    min="0"
                    placeholder="3"
                    value={formData.lowStockThreshold}
                    onChange={(e) => handleInputChange("lowStockThreshold", e.target.value)}
                    disabled={loading}
                    className="max-w-40"
                  />
                  <p className="text-xs text-muted-foreground">We'll email and push-notify you when stock drops to this level or below.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="weightKg">Weight (kg)</Label>
                <Input
                  id="weightKg"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="1"
                  value={formData.weightKg}
                  onChange={(e) => handleInputChange("weightKg", e.target.value)}
                  disabled={loading}
                  className="max-w-40"
                />
                <p className="text-xs text-muted-foreground">Optional — helps us quote accurate delivery rates. Leave blank to use a standard estimate.</p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="featured"
                  checked={formData.featured}
                  onCheckedChange={(checked) => handleInputChange("featured", checked as boolean)}
                  disabled={loading}
                />
                <Label htmlFor="featured">Feature this product</Label>
              </div>
            </CardContent>
          </Card>

          {/* Product Images */}
          <Card>
            <CardHeader>
              <CardTitle>Product Images</CardTitle>
              <CardDescription>Upload up to 5 images and up to 5 PDF files for your product</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {previews.map((preview, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 overflow-hidden"
                  >
                    <img
                      src={preview}
                      alt={`Product ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}

                {images.length < 5 && (
                  <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground mt-2">Upload Image/PDF</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={loading}
                    />
                  </label>
                )}
              </div>

              {productDocuments.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <Label>PDF Files</Label>
                  <div className="space-y-2">
                    {productDocuments.map((doc, index) => (
                      <div key={`${doc.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span className="truncate">{doc.name}</span>
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeDocument(index)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Options */}
          <Card>
            <CardHeader>
              <CardTitle>Product Options</CardTitle>
              <CardDescription>Add color and size options for your product</CardDescription>
            </CardHeader>
              <CardContent className="space-y-6">
                {/* Sizes Section */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Available Sizes</Label>
                  {isShoeSubcategory && (
                    <p className="text-xs text-muted-foreground">Shoe sizes (EU): 35-65</p>
                  )}
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
                    {availableSizeOptions.map((size) => (
                      <div key={size} className="flex items-center space-x-2">
                        <Checkbox
                          id={`size-${size}`}
                          checked={sizes.includes(size)}
                          onCheckedChange={() => toggleSize(size)}
                          disabled={loading}
                        />
                        <Label htmlFor={`size-${size}`} className="cursor-pointer">
                          {size}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Colors Section */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Available Colors</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {predefinedColors.map((color) => (
                      <div key={color} className="flex items-center space-x-2">
                        <Checkbox
                          id={`color-${color}`}
                          checked={colors.includes(color)}
                          onCheckedChange={() => toggleColor(color)}
                          disabled={loading}
                        />
                        <Label htmlFor={`color-${color}`} className="cursor-pointer flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border border-border" 
                            style={{ backgroundColor: color.toLowerCase().replace(/ /g, '') }}
                          />
                          {color}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Color to Image Mapping */}
                {colors.length > 0 && previews.length > 0 && (
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Link Colors to Product Images</Label>
                    <p className="text-sm text-muted-foreground">Select which image represents each color</p>
                    <div className="grid gap-4">
                      {colors.map((color) => (
                        <div key={color} className="flex items-center gap-4 p-3 border rounded-lg">
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div 
                              className="w-4 h-4 rounded-full border border-border" 
                              style={{ backgroundColor: color.toLowerCase().replace(/ /g, '') }}
                            />
                            <Label className="font-medium">{color}</Label>
                          </div>
                          <Select 
                            value={colorImageMapping[color]?.toString() || ""} 
                            onValueChange={(value) => {
                              setColorImageMapping(prev => ({
                                ...prev,
                                [color]: parseInt(value)
                              }))
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select image for this color" />
                            </SelectTrigger>
                            <SelectContent>
                              {previews.map((preview, index) => (
                                <SelectItem key={index} value={index.toString()}>
                                  <div className="flex items-center gap-2">
                                    <img src={preview} alt={`Image ${index + 1}`} className="w-8 h-8 object-cover rounded" />
                                    Image {index + 1}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          {isPhoneCaseSubcategory && (
            <Card>
              <CardHeader>
                <CardTitle>Phone Compatibility</CardTitle>
                <CardDescription>Which phone models does this case fit, and how many do you have for each?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Search models (e.g. iPhone 15, Galaxy A54)"
                  value={phoneModelFilter}
                  onChange={(e) => setPhoneModelFilter(e.target.value)}
                />
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {PHONE_MODEL_GROUPS.map(({ brand, models }) => {
                    const filtered = phoneModelFilter
                      ? models.filter((m) => m.toLowerCase().includes(phoneModelFilter.toLowerCase()))
                      : models
                    if (filtered.length === 0) return null
                    return (
                      <div key={brand} className="space-y-2">
                        <Label className="text-sm font-semibold">{brand}</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {filtered.map((model) => {
                            const isSelected = model in compatiblePhoneModels
                            return (
                              <div key={model} className="flex items-center gap-2">
                                <Checkbox
                                  id={`phone-model-${model}`}
                                  checked={isSelected}
                                  onCheckedChange={() => togglePhoneModel(model)}
                                  disabled={loading}
                                />
                                <Label htmlFor={`phone-model-${model}`} className="cursor-pointer text-sm flex-1">
                                  {model}
                                </Label>
                                {isSelected && (
                                  <Input
                                    type="number"
                                    min="0"
                                    value={compatiblePhoneModels[model]}
                                    onChange={(e) => setPhoneModelStock(model, Number(e.target.value) || 0)}
                                    placeholder="Stock"
                                    className="w-20 h-8"
                                    disabled={loading}
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {Object.keys(compatiblePhoneModels).length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {Object.keys(compatiblePhoneModels).length} model{Object.keys(compatiblePhoneModels).length === 1 ? "" : "s"} selected —{" "}
                    {Object.values(compatiblePhoneModels).reduce((sum, n) => sum + n, 0)} total units in stock
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={loading} className="flex-1 bg-accent text-white hover:bg-accent/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Product
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </VendorLayout>
  )
}
