"use client"

import { useState, useEffect, useMemo } from "react"
import VendorLayout from "@/components/vendor/VendorLayout"
import { useAuth } from "@/contexts/AuthContext"
import { useNotification } from "@/contexts/NotificationContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye, Package, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"

// Define Product interface
interface Product {
  id: string
  title: string
  description: string
  price: number
  category: string
  images: string[]
  stock: number
  vendorId: string
  createdAt: Date
  updatedAt: Date
}

const VendorProductsPage = () => {
  const router = useRouter()
  const { success, error, warning } = useNotification()
  const [searchQuery, setSearchQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [bulkPrice, setBulkPrice] = useState("")
  const [bulkStock, setBulkStock] = useState("")
  const [bulkStatus, setBulkStatus] = useState("")
  const [bulkCategory, setBulkCategory] = useState("")
  const [selectionPreset, setSelectionPreset] = useState("all_filtered")
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const { user } = useAuth()

  const fetchProducts = async () => {
    setLoading(true)
    try {
      let result = []
      if (!showAll && user?.uid) {
        const response = await fetch(`/api/database/products?vendorId=${user.uid}`)
        const data = await response.json()
        result = data.data || []
      } else {
        const response = await fetch('/api/database/products')
        const data = await response.json()
        result = data.data || []
      }

      const processedProducts = (result || []).map((product: any) => ({
        ...product,
        id: product.id || product._id || `product-${Date.now()}-${Math.random()}`,
        sales: product.sales || 0,
      }))
      setProducts(processedProducts)
    } catch (err) {
      console.error('Error fetching products:', err)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user && !showAll) return;
    fetchProducts()
  }, [showAll, user])

  const filteredProducts = products.filter(
    (product: any) =>
      ((product.title || product.name || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
      ((product.sku || '').toLowerCase().includes(searchQuery.toLowerCase())),
  )

  const selectedInFiltered = useMemo(
    () => filteredProducts.filter((product: any) => selectedProductIds.includes(product.id)),
    [filteredProducts, selectedProductIds]
  )

  const allFilteredSelected = filteredProducts.length > 0 && selectedInFiltered.length === filteredProducts.length

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedProductIds((prev) => prev.filter((id) => !filteredProducts.some((product: any) => product.id === id)))
      return
    }

    const merged = new Set([...selectedProductIds, ...filteredProducts.map((product: any) => product.id)])
    setSelectedProductIds(Array.from(merged))
  }

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    )
  }

  const applySelectionPreset = () => {
    let candidates: any[] = []

    switch (selectionPreset) {
      case "all_filtered":
        candidates = filteredProducts
        break
      case "low_stock":
        candidates = filteredProducts.filter((product: any) => Number(product.stock || 0) > 0 && Number(product.stock || 0) < 5)
        break
      case "out_of_stock":
        candidates = filteredProducts.filter((product: any) => Number(product.stock || 0) === 0)
        break
      case "active":
        candidates = filteredProducts.filter((product: any) => String(product.status || "active") === "active")
        break
      default:
        candidates = filteredProducts
        break
    }

    setSelectedProductIds(candidates.map((product: any) => product.id))
  }

  const handleApplyBulkUpdates = async () => {
    if (!user?.uid) {
      warning('Login required', 'Please sign in again to continue.')
      return
    }

    if (selectedProductIds.length === 0) {
      warning('No products selected', 'Select one or more products to update.')
      return
    }

    const updates: Record<string, any> = {}
    if (bulkPrice.trim()) updates.price = Number(bulkPrice)
    if (bulkStock.trim()) updates.stock = Number(bulkStock)
    if (bulkStatus) updates.status = bulkStatus
    if (bulkCategory.trim()) updates.category = bulkCategory.trim()

    if (Object.keys(updates).length === 0) {
      warning('No update values', 'Enter at least one bulk value before applying changes.')
      return
    }

    setBulkUpdating(true)
    try {
      const response = await fetch('/api/vendor/products/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: selectedProductIds,
          updates,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Bulk update failed')
      }

      success('Bulk update complete', `${result.modifiedCount || 0} products updated.`)
      setBulkPrice("")
      setBulkStock("")
      setBulkStatus("")
      setBulkCategory("")
      setSelectedProductIds([])
      await fetchProducts()
    } catch (err: any) {
      console.error('Bulk update error:', err)
      error('Bulk update failed', err?.message || 'Please try again.')
    } finally {
      setBulkUpdating(false)
    }
  }

  const getStatusBadge = (status: string, stock: number) => {
    if (stock === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>
    }
    if (stock < 5) {
      return <Badge variant="secondary">Low Stock</Badge>
    }
    return <Badge variant="default">Active</Badge>
  }

  if (!user && !showAll) {
    return (
      <VendorLayout>
        <div className="flex justify-center items-center min-h-[40vh]">
          <div className="text-muted-foreground text-lg">Loading vendor info...</div>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-balance">Products</h1>
            <p className="text-muted-foreground">Manage your product inventory and listings</p>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              variant={showAll ? "default" : "outline"}
              onClick={() => setShowAll(false)}
              disabled={!showAll}
              className="hover:bg-accent/10 hover:text-accent transition-all"
            >
              My Products
            </Button>
            <Button
              variant={showAll ? "outline" : "default"}
              onClick={() => setShowAll(true)}
              disabled={showAll}
              className="hover:bg-accent/10 hover:text-accent transition-all"
            >
              All Products
            </Button>
            <Button asChild className="hover:bg-accent/80 hover:scale-105 transition-all hover:shadow-lg">
              <Link href="/vendor/products/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Link>
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Product Inventory</CardTitle>
            <CardDescription>{filteredProducts.length} products found</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="mb-4 rounded-md border p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Bulk Operations</p>
                <p className="text-xs text-muted-foreground">{selectedProductIds.length} selected</p>
              </div>
              <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                <Select value={selectionPreset} onValueChange={setSelectionPreset}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selection preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_filtered">Select all filtered</SelectItem>
                    <SelectItem value="low_stock">Select low stock</SelectItem>
                    <SelectItem value="out_of_stock">Select out of stock</SelectItem>
                    <SelectItem value="active">Select active</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={applySelectionPreset}>
                  Apply Selection
                </Button>
                <Button type="button" variant="outline" onClick={() => setSelectedProductIds([])}>
                  Clear Selection
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                <Input
                  type="number"
                  placeholder="Set price"
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(e.target.value)}
                  min={0}
                />
                <Input
                  type="number"
                  placeholder="Set stock"
                  value={bulkStock}
                  onChange={(e) => setBulkStock(e.target.value)}
                  min={0}
                />
                <Select value={bulkStatus || undefined} onValueChange={setBulkStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Set status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="out_of_stock">Out of stock</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Set category"
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                />
                <Button onClick={handleApplyBulkUpdates} disabled={bulkUpdating || selectedProductIds.length === 0}>
                  {bulkUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Apply
                </Button>
              </div>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAllFiltered} />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product: any, index: number) => (
                    <TableRow key={product.id || product._id || index}>
                      <TableCell>
                        <Checkbox
                          checked={selectedProductIds.includes(product.id)}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="relative h-12 w-12 rounded-md overflow-hidden bg-muted">
                            <Image
                              src={product.images?.[0] || "/placeholder.svg"}
                              alt={product.title || product.name || "Product image"}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{product.title || product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.category}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell className="font-medium">₦{product.price}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>{getStatusBadge(product.status, product.stock)}</TableCell>
                      <TableCell>{product.sales || 0} sold</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="hover:scale-110 hover:bg-accent/10 transition-all">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/vendor/products/${product.id}`} prefetch={false}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/vendor/products/${product.id}/edit`} prefetch={false}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive cursor-pointer"
                              onClick={async () => {
                                if (window.confirm("Are you sure you want to delete this product?")) {
                                  try {
                                    const response = await fetch(`/api/vendor/products?productId=${product.id}`, {
                                      method: 'DELETE'
                                    })
                                    if (response.ok) {
                                      success(`Product "${product.title || product.name}" deleted successfully`)
                                      await fetchProducts()
                                    } else {
                                      error('Failed to delete product', 'Please try again')
                                    }
                                  } catch (err) {
                                    console.error('Delete error:', err)
                                    error('Failed to delete product', 'An error occurred')
                                  }
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {loading ? (
              <div className="text-center py-12">Loading products...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No products found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? "Try adjusting your search terms" : "Get started by adding your first product"}
                </p>
                {!searchQuery && (
                  <Button asChild className="mt-4 hover:bg-accent/80 hover:scale-105 transition-all hover:shadow-lg">
                    <Link href="/vendor/products/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Product
                    </Link>
                  </Button>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </VendorLayout>
  )
}

export default VendorProductsPage
