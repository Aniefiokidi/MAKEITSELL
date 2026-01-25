"use client"

import { useEffect, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/admin/products")
        const data = await res.json()
        if (data.success) {
          setProducts(data.products || [])
        }
      } catch (error) {
        console.error("Failed to fetch products:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const filtered = products.filter((p) => {
    const term = search.toLowerCase()
    return (
      p.title?.toLowerCase().includes(term) ||
      p.name?.toLowerCase().includes(term) ||
      p.storeName?.toLowerCase().includes(term) ||
      p.vendorName?.toLowerCase().includes(term) ||
      p.vendorEmail?.toLowerCase().includes(term)
    )
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Products Management</h1>
          <p className="text-muted-foreground text-sm lg:text-base">View and manage all products on the marketplace</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Search Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search by product name or vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full lg:max-w-md text-sm"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">All Products ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-accent rounded-full"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No products found</div>
            ) : (
              <div className="space-y-4">
                {/* Mobile view - Card layout */}
                <div className="lg:hidden space-y-4">
                  {filtered.map((product) => (
                    <Card key={product.id || product._id} className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Product:</span>
                            <span className="text-right font-medium text-xs">{product.title || product.name || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Store:</span>
                            <span className="text-right text-xs">{product.storeName || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Seller:</span>
                            <span className="text-right text-xs">{product.vendorEmail || product.vendorName || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Category:</span>
                            <span className="text-right text-xs">{product.category || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Price:</span>
                            <span className="text-right font-semibold text-xs">₦{(product.price || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Stock:</span>
                            <div className="text-right">
                              <p className="text-xs font-semibold">{product.stock || 0}</p>
                              <Badge variant={product.stock > 0 ? "secondary" : "destructive"} className="text-xs">
                                {product.stock > 0 ? "In Stock" : "Out"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop view - Table layout */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Product Name</TableHead>
                        <TableHead className="text-xs">Store</TableHead>
                        <TableHead className="text-xs">Seller</TableHead>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-xs">Price</TableHead>
                        <TableHead className="text-xs">Stock</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((product) => (
                        <TableRow key={product.id || product._id}>
                          <TableCell className="font-medium text-xs">{product.title || product.name || "N/A"}</TableCell>
                          <TableCell className="text-xs">{product.storeName || "N/A"}</TableCell>
                          <TableCell className="text-xs">{product.vendorEmail || product.vendorName || "N/A"}</TableCell>
                          <TableCell className="text-xs">{product.category || "N/A"}</TableCell>
                          <TableCell className="text-xs font-semibold">₦{(product.price || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{product.stock || 0}</TableCell>
                          <TableCell>
                            <Badge variant={product.stock > 0 ? "secondary" : "destructive"} className="text-xs">
                              {product.stock > 0 ? "In Stock" : "Out"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
