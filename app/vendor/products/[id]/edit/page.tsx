"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useNotification } from "@/contexts/NotificationContext"
import Image from "next/image"
import { CATEGORIES, FASHION_SUBCATEGORIES, ELECTRONICS_SUBCATEGORIES } from "@/lib/vendor-product-taxonomy"
import { ProductVariantsEditor } from "@/components/vendor/ProductVariantsEditor"
import type { ProductVariant } from "@/lib/product-variants"
import { normalizeProductVariants, groupVariantsByLabel } from "@/lib/product-variants"
import { VARIANT_SUGGESTIONS } from "@/lib/variant-suggestions"

export default function ProductEditPage() {
  const router = useRouter()
  const params = useParams()
  const { id } = params as { id: string }
  const { success, error: showError } = useNotification()
  const [product, setProduct] = useState<any>(null)
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [variants, setVariants] = useState<ProductVariant[]>([])
  // color -> already-uploaded photo URL (unlike the create page, there are no local
  // previews to resolve here — product.images are already real Cloudinary URLs).
  const [colorImageUrls, setColorImageUrls] = useState<Record<string, string>>({})

  const hasVariants = variants.length > 0
  const isFoodCategory = String(product?.category || "").trim() === "Food & Beverages"

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
        // Critical: seed from the normalizer, never from the raw legacy fields directly —
        // normalizeProductVariants is the only thing that correctly reads BOTH the new
        // `variants` field and legacy compatiblePhoneModels/colors/sizes. Seeding from a
        // raw legacy field here would silently drop the other legacy data the moment this
        // form saves (see lib/models/Product.ts's `variants` field comment).
        setVariants(normalizeProductVariants(prod))
        setColorImageUrls(prod.colorImages || {})
      } catch (err: any) {
        setError("Product not found")
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchProduct()
  }, [id])

  const handleInputChange = (field: string, value: any) => {
    setProduct((prev: any) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleCategoryChange = (value: string) => {
    handleInputChange("category", value)
    handleInputChange("subcategory", "")
    setVariants((prev) => prev.filter((v) => v.label === "Color" || v.label === "Size"))
  }

  const handleSubcategoryChange = (value: string) => {
    const previousSuggestion = VARIANT_SUGGESTIONS[String(product?.subcategory || "")]
    handleInputChange("subcategory", value)
    if (previousSuggestion) {
      setVariants((prev) => prev.filter((v) => v.label !== previousSuggestion.label))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")

    try {
      const firstVariantGroup = groupVariantsByLabel(variants)[0]
      const computedStock = firstVariantGroup
        ? firstVariantGroup.values.reduce((sum, v) => sum + v.stock, 0)
        : Number(product.stock) || 0

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
          subcategory: product.subcategory || null,
          stock: isFoodCategory ? 9999 : computedStock,
          lowStockThreshold: isFoodCategory ? 3 : Math.max(0, Number(product.lowStockThreshold) || 3),
          sku: product.sku,
          featured: product.featured || false,
          variants,
          colorImages: colorImageUrls,
          images: product.images, // <-- persist reordered images
          weightKg: product.weightKg !== undefined && product.weightKg !== "" ? Number(product.weightKg) : undefined,
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


  // Drag-and-drop handlers for image reordering
  const handleDragStart = (index: number) => {
    dragItem.current = index
  }
  const handleDragEnter = (index: number) => {
    dragOverItem.current = index
  }
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null
      dragOverItem.current = null
      return
    }
    const updatedImages = [...product.images]
    const draggedImg = updatedImages.splice(dragItem.current, 1)[0]
    updatedImages.splice(dragOverItem.current, 0, draggedImg)
    setProduct((prev: any) => ({ ...prev, images: updatedImages }))
    dragItem.current = null
    dragOverItem.current = null
  }

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
                  <Select value={product.category || ""} onValueChange={handleCategoryChange}>
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

              {String(product.category || "").trim() === "Fashion" && (
                <div className="space-y-2">
                  <Label htmlFor="subcategory">Fashion Subcategory</Label>
                  <Select value={product.subcategory || ""} onValueChange={handleSubcategoryChange}>
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

              {String(product.category || "").trim() === "Electronics" && (
                <div className="space-y-2">
                  <Label htmlFor="subcategory">Electronics Subcategory</Label>
                  <Select value={product.subcategory || ""} onValueChange={handleSubcategoryChange}>
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
                      value={product.stock || 0}
                      onChange={(e) => handleInputChange("stock", e.target.value)}
                      disabled={saving}
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
                  <Label htmlFor="sku">SKU (Optional)</Label>
                  <Input
                    id="sku"
                    value={product.sku || ""}
                    onChange={(e) => handleInputChange("sku", e.target.value)}
                    disabled={saving}
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
                    value={product.lowStockThreshold ?? 3}
                    onChange={(e) => handleInputChange("lowStockThreshold", e.target.value)}
                    disabled={saving}
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
                  value={product.weightKg ?? ""}
                  onChange={(e) => handleInputChange("weightKg", e.target.value)}
                  disabled={saving}
                  className="max-w-40"
                />
                <p className="text-xs text-muted-foreground">Optional — helps us quote accurate delivery rates. Leave blank to use a standard estimate.</p>
              </div>
            </CardContent>
          </Card>

          {/* Product Images */}
          {product?.images && product.images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Product Images</CardTitle>
                <CardDescription>Drag and drop to reorder images</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {product.images.map((img: string, index: number) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 overflow-hidden cursor-move"
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => e.preventDefault()}
                      style={{ opacity: dragItem.current === index ? 0.5 : 1 }}
                    >
                      <Image
                        src={img}
                        alt={`Product ${index + 1}`}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1">
                        Image {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Drag and drop images to change their order. The first image will be the main display image.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Product Variants */}
          <Card>
            <CardContent className="pt-6">
              <ProductVariantsEditor
                category={product.category || ""}
                subcategory={product.subcategory || ""}
                images={product.images || []}
                variants={variants}
                onVariantsChange={setVariants}
                colorImages={colorImageUrls}
                onColorImagesChange={setColorImageUrls}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={saving} className="flex-1 bg-accent text-white hover:bg-accent/90">
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
