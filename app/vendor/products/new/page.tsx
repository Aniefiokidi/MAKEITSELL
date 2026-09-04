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
import { Upload, X, Loader2 } from "lucide-react"
import { CATEGORIES, FASHION_SUBCATEGORIES, ELECTRONICS_SUBCATEGORIES } from "@/lib/vendor-product-taxonomy"
import { ProductVariantsEditor } from "@/components/vendor/ProductVariantsEditor"
import type { ProductVariant } from "@/lib/product-variants"
import { groupVariantsByLabel } from "@/lib/product-variants"
import { VARIANT_SUGGESTIONS } from "@/lib/variant-suggestions"

export default function NewProduct() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, userProfile } = useAuth()
  const { success, error: showError, warning } = useNotification()
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
    weightKg: "",
  })
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [productDocuments, setProductDocuments] = useState<File[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  // color -> preview data URL (local, pre-upload) — resolved to the matching uploaded
  // Cloudinary URL at submit time via previews.indexOf, since previews and the
  // eventually-uploaded imageUrls stay in the same order.
  const [colorImagePreviews, setColorImagePreviews] = useState<Record<string, string>>({})

  const hasVariants = variants.length > 0
  const isFoodCategory = formData.category === "Food & Beverages"

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleCategoryChange = (value: string) => {
    handleInputChange("category", value)
    handleInputChange("subcategory", "")
    // Device-compatibility variant groups are tied to the old subcategory and no longer
    // make sense once category changes; Color/Size are category-agnostic and are kept.
    setVariants((prev) => prev.filter((v) => v.label === "Color" || v.label === "Size"))
  }

  const handleSubcategoryChange = (value: string) => {
    const previousSuggestion = VARIANT_SUGGESTIONS[formData.subcategory]
    handleInputChange("subcategory", value)
    if (previousSuggestion) {
      setVariants((prev) => prev.filter((v) => v.label !== previousSuggestion.label))
    }
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
      if (!hasVariants && !isFoodCategory && Number.parseInt(formData.stock || "0") < 0) {
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

      // Resolve each color's locally-previewed image to its uploaded URL — previews and
      // imageUrls stay in the same order since both are built by iterating `images` once.
      const colorImageUrls: { [key: string]: string } = {}
      for (const [color, previewDataUrl] of Object.entries(colorImagePreviews)) {
        const index = previews.indexOf(previewDataUrl)
        if (index !== -1 && imageUrls[index]) {
          colorImageUrls[color] = imageUrls[index]
        }
      }

      // Overall stock: the sum of the first variant group's values when variants exist —
      // one authoritative number, not a second vendor-editable figure that could disagree
      // with the per-variant breakdown. Multiple independent variant groups (e.g. Color +
      // Size) would double-count if summed together, so only the first is used.
      const firstVariantGroup = groupVariantsByLabel(variants)[0]
      const computedStock = firstVariantGroup
        ? firstVariantGroup.values.reduce((sum, v) => sum + v.stock, 0)
        : Number(formData.stock) || 0

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
          stock: isFoodCategory ? 9999 : computedStock,
          lowStockThreshold: isFoodCategory ? 3 : Math.max(0, Number(formData.lowStockThreshold) || 3),
          sku: formData.sku,
          featured: formData.featured,
          status: "active",
          sales: 0,
          variants,
          colorImages: colorImageUrls,
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
                  <Select value={formData.category} onValueChange={handleCategoryChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
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
                  <Select value={formData.subcategory} onValueChange={handleSubcategoryChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select fashion subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {FASHION_SUBCATEGORIES.map((subcategory) => (
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
                  <Select value={formData.subcategory} onValueChange={handleSubcategoryChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select electronics subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {ELECTRONICS_SUBCATEGORIES.map((subcategory) => (
                        <SelectItem key={subcategory} value={subcategory}>
                          {subcategory}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {hasVariants ? (
                  <div className="space-y-2">
                    <Label>Stock</Label>
                    <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                      Set per variant below
                    </div>
                  </div>
                ) : !isFoodCategory ? (
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

              {!isFoodCategory && (
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

          {/* Product Variants */}
          <Card>
            <CardContent className="pt-6">
              <ProductVariantsEditor
                category={formData.category}
                subcategory={formData.subcategory}
                images={previews}
                variants={variants}
                onVariantsChange={setVariants}
                colorImages={colorImagePreviews}
                onColorImagesChange={setColorImagePreviews}
              />
            </CardContent>
          </Card>

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
