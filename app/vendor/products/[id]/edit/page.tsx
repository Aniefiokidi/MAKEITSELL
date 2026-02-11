"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useNotification } from "@/contexts/NotificationContext"
import Image from "next/image"

const predefinedSizes = ["S", "M", "L", "XL", "XXL"]

const predefinedColors = [
  "Black", "White", "Gray", "Red", "Blue", "Navy Blue", "Green", "Yellow", 
  "Orange", "Pink", "Purple", "Brown", "Beige", "Cream", "Maroon", "Teal", 
  "Turquoise", "Gold", "Silver", "Olive", "Burgundy", "Mint", "Lavender", "Coral"
]

export default function ProductEditPage() {
  const router = useRouter()
  const params = useParams()
  const { id } = params as { id: string }
  const { success, error: showError } = useNotification()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [colors, setColors] = useState<string[]>([])
  const [sizes, setSizes] = useState<string[]>([])
  const [colorImageMapping, setColorImageMapping] = useState<{ [color: string]: number }>({})

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true)
      try {
        const response = await fetch(`/api/database/products?id=${id}`)
        if (!response.ok) {
          throw new Error('Product not found')
        }
        const data = await response.json()
        if (!data.success || !data.data || !data.data[0]) {
          throw new Error('Product not found')
        }
        const prod = data.data[0]
        setProduct(prod)
        setColors(prod.colors || [])
        setSizes(prod.sizes || [])
        
        // Build color to image mapping from colorImages
        if (prod.colorImages && prod.images) {
          const mapping: { [color: string]: number } = {}
          Object.entries(prod.colorImages).forEach(([color, imageUrl]) => {
            const imageIndex = prod.images.findIndex((img: string) => img === imageUrl)
            if (imageIndex !== -1) {
              mapping[color] = imageIndex
            }
          })
          setColorImageMapping(mapping)
        }
      } catch (err: any) {
        setError("Product not found")
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchProduct()
  }, [id])

  const toggleSize = (size: string) => {
    if (sizes.includes(size)) {
      setSizes(sizes.filter(s => s !== size))
    } else {
      setSizes([...sizes, size])
    }
  }

  const toggleColor = (color: string) => {
    if (colors.includes(color)) {
      // Remove color and its mapping
      setColors(colors.filter(c => c !== color))
      const newMapping = { ...colorImageMapping }
      delete newMapping[color]
      setColorImageMapping(newMapping)
    } else {
      // Only allow selecting colors if there are images available
      const maxColors = product?.images?.length || 0
      if (colors.length >= maxColors) {
        showError(`You can only select up to ${maxColors} colors (one per image)`, 'Color Limit Reached')
        return
      }
      setColors([...colors, color])
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setProduct((prev: any) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    
    try {
      // Validate that all selected colors have images mapped
      if (colors.length > 0) {
        const unmappedColors = colors.filter(color => !colorImageMapping[color] && colorImageMapping[color] !== 0)
        if (unmappedColors.length > 0) {
          throw new Error(`Please link images to these colors: ${unmappedColors.join(', ')}`)
        }
      }

      // Create color to image URL mapping
      const colorImageUrls: { [key: string]: string } = {}
      for (const [color, imageIndex] of Object.entries(colorImageMapping)) {
        if (product.images && product.images[imageIndex]) {
          colorImageUrls[color] = product.images[imageIndex]
        }
      }

      const response = await fetch(`/api/database/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: product.name || product.title,
          description: product.description,
          price: Number(product.price),
          category: product.category,
          stock: Number(product.stock) || 0,
          sku: product.sku,
          featured: product.featured || false,
          hasColorOptions: colors.length > 0,
          hasSizeOptions: sizes.length > 0,
          colors: colors,
          sizes: sizes,
          colorImages: colorImageUrls,
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update product')
      }
      
      success('Product updated successfully!', 'Your changes have been saved')
      router.push('/vendor/products')
    } catch (err: any) {
      const errorMessage = err.message || "Failed to update product"
      setError(errorMessage)
      showError(errorMessage, 'Update Failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <VendorLayout>
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    </VendorLayout>
  )
  
  if (error && !product) return (
    <VendorLayout>
      <div className="p-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    </VendorLayout>
  )
  
  if (!product) return null

  return (
    <VendorLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Product</h1>
          <p className="text-muted-foreground">Update your product details</p>
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
                <Label htmlFor="title">Product Name *</Label>
                <Input
                  id="title"
                  value={product.name || product.title || ""}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={product.description || ""}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  required
                  disabled={saving}
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
                    value={product.price || ""}
                    onChange={(e) => handleInputChange("price", e.target.value)}
                    required
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Input
                    id="category"
                    value={product.category || ""}
                    onChange={(e) => handleInputChange("category", e.target.value)}
                    required
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock Quantity</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={product.stock || 0}
                    onChange={(e) => handleInputChange("stock", e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sku">SKU (Optional)</Label>
                  <Input
                    id="sku"
                    value={product.sku || ""}
                    onChange={(e) => handleInputChange("sku", e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Images */}
          {product?.images && product.images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Product Images</CardTitle>
                <CardDescription>Current product images</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {product.images.map((img: string, index: number) => (
                    <div key={index} className="relative aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 overflow-hidden">
                      <Image
                        src={img}
                        alt={`Product ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1">
                        Image {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  You can select up to {product.images.length} color{product.images.length !== 1 ? 's' : ''} (one per image)
                </p>
              </CardContent>
            </Card>
          )}

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
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {predefinedSizes.map((size) => (
                    <div key={size} className="flex items-center space-x-2">
                      <Checkbox
                        id={`size-${size}`}
                        checked={sizes.includes(size)}
                        onCheckedChange={() => toggleSize(size)}
                        disabled={saving}
                      />
                      <Label htmlFor={`size-${size}`} className="cursor-pointer">
                        {size}
                      </Label>
                    </div>
                  ))}
                </div>
                {sizes.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {sizes.join(", ")}
                  </p>
                )}
              </div>

              {/* Colors Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Available Colors</Label>
                  {product?.images && product.images.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {colors.length}/{product.images.length} selected
                    </span>
                  )}
                </div>
                {!product?.images || product.images.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      Product must have images before you can add colors. Colors are linked to specific images.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {predefinedColors.map((color) => (
                      <div key={color} className="flex items-center space-x-2">
                        <Checkbox
                          id={`color-${color}`}
                          checked={colors.includes(color)}
                          onCheckedChange={() => toggleColor(color)}
                          disabled={saving}
                        />
                        <Label htmlFor={`color-${color}`} className="cursor-pointer flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border border-gray-300" 
                            style={{ backgroundColor: color.toLowerCase().replace(/ /g, '') }}
                          />
                          {color}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
                {colors.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {colors.join(", ")}
                  </p>
                )}
              </div>

              {/* Color to Image Mapping */}
              {colors.length > 0 && product?.images && product.images.length > 0 && (
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Link Colors to Product Images</Label>
                  <p className="text-sm text-muted-foreground">Select which image represents each color</p>
                  <div className="grid gap-4">
                    {colors.map((color) => (
                      <div key={color} className="flex items-center gap-4 p-3 border rounded-lg">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div 
                            className="w-4 h-4 rounded-full border border-gray-300" 
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
                            {product.images.map((img: string, index: number) => (
                              <SelectItem key={index} value={index.toString()}>
                                <div className="flex items-center gap-2">
                                  <div className="relative w-8 h-8 rounded overflow-hidden">
                                    <Image src={img} alt={`Image ${index + 1}`} fill className="object-cover" />
                                  </div>
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

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.push('/vendor/products')}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </VendorLayout>
  )
}
