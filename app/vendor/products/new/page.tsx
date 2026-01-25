"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useNotification } from "@/contexts/NotificationContext"
import { uploadImageToStorage } from "@/lib/firebase"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { useRouter } from "next/navigation"
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

export default function NewProduct() {
  const router = useRouter()
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
    sku: "",
    featured: false,
    hasColorOptions: false,
    hasSizeOptions: false,
  })
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [sizes, setSizes] = useState<string[]>([])
  const [newColor, setNewColor] = useState("")
  const [newSize, setNewSize] = useState("")
  const [colorImages, setColorImages] = useState<{ [color: string]: File[] }>({})
  const [colorPreviews, setColorPreviews] = useState<{ [color: string]: string[] }>({})

  const addColor = () => {
    if (newColor && !colors.includes(newColor)) {
      setColors([...colors, newColor])
      setNewColor("")
    }
  }

  const removeColor = (color: string) => {
    setColors(colors.filter(c => c !== color))
    // Remove color images too
    const newColorImages = { ...colorImages }
    const newColorPreviews = { ...colorPreviews }
    delete newColorImages[color]
    delete newColorPreviews[color]
    setColorImages(newColorImages)
    setColorPreviews(newColorPreviews)
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
      const newFiles = Array.from(files)
      setImages((prev) => [...prev, ...newFiles].slice(0, 5)) // Max 5 images
      // Generate previews
      newFiles.forEach((file) => {
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

      // Upload color-specific images to Cloudinary
      const colorImagesUploaded: { [key: string]: string[] } = {}
      for (const [colorName, imageFiles] of Object.entries(colorImages)) {
        if (imageFiles && imageFiles.length > 0) {
          const colorImageUrls: string[] = []
          for (const file of imageFiles) {
            const url = await uploadToCloudinary(file)
            colorImageUrls.push(url)
          }
          colorImagesUploaded[colorName] = colorImageUrls
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
          vendorId: user.uid,
          vendorName: userProfile?.displayName || user.email || "Vendor",
          stock: Number(formData.stock) || 0,
          sku: formData.sku,
          featured: formData.featured,
          status: "active",
          sales: 0,
          hasColorOptions: colors.length > 0,
          hasSizeOptions: sizes.length > 0,
          colors: colors,
          sizes: sizes,
          colorImages: colorImagesUploaded,
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create product')
      }

      success('Product created successfully!', 'Your product is now live')
      router.push("/vendor/products")
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
                    // Reset subcategory when category changes
                    if (value !== "Fashion") {
                      handleInputChange("subcategory", "")
                    }
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
                  <Select value={formData.subcategory} onValueChange={(value) => handleInputChange("subcategory", value)}>
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

              <div className="grid grid-cols-2 gap-4">
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
              <CardDescription>Upload up to 5 images of your product</CardDescription>
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
                    <span className="text-sm text-muted-foreground mt-2">Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={loading}
                    />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Product Options */}
          <Card>
            <CardHeader>
              <CardTitle>Product Options</CardTitle>
              <CardDescription>Add color and size options for your product (recommended for fashion items)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Colors Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Colors</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addColor}
                    disabled={loading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Color
                  </Button>
                </div>
                
                {colors.length > 0 && (
                  <div className="space-y-4">
                    {colors.map((color, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <Input
                            placeholder="Color name (e.g., Red, Blue, Black)"
                            value={color}
                            onChange={(e) => {
                              const newColors = [...colors]
                              newColors[index] = e.target.value
                              setColors(newColors)
                            }}
                            disabled={loading}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeColor(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Color-specific images */}
                        <div className="space-y-2">
                          <Label className="text-sm">Images for {color || 'this color'}</Label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {colorPreviews[color]?.map((preview, imgIndex) => (
                              <div
                                key={imgIndex}
                                className="relative aspect-square rounded border overflow-hidden"
                              >
                                <img
                                  src={preview}
                                  alt={`${color} ${imgIndex + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-1 right-1 h-5 w-5"
                                  onClick={() => {
                                    const newColorImages = { ...colorImages }
                                    const newColorPreviews = { ...colorPreviews }
                                    if (newColorImages[color]) {
                                      newColorImages[color] = newColorImages[color].filter((_, i) => i !== imgIndex)
                                      newColorPreviews[color] = newColorPreviews[color].filter((_, i) => i !== imgIndex)
                                      if (newColorImages[color].length === 0) {
                                        delete newColorImages[color]
                                        delete newColorPreviews[color]
                                      }
                                    }
                                    setColorImages(newColorImages)
                                    setColorPreviews(newColorPreviews)
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            <label className="aspect-square rounded border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors text-center">
                              <Upload className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground mt-1">Add Images</span>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => handleColorImagesUpload(color, e)}
                                disabled={loading}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sizes Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Sizes</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSize}
                    disabled={loading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Size
                  </Button>
                </div>
                
                {sizes.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {sizes.map((size, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="Size (e.g., S, M, L, XL)"
                          value={size}
                          onChange={(e) => {
                            const newSizes = [...sizes]
                            newSizes[index] = e.target.value
                            setSizes(newSizes)
                          }}
                          disabled={loading}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => removeSize(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={loading} className="flex-1">
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
