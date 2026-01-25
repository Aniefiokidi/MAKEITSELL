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
          <h1 className="text-3xl font-bold">Products Management</h1>
          <p className="text-muted-foreground">View and manage all products on the marketplace</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search by product name or vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Products</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-accent rounded-full"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No products found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((product) => (
                      <TableRow key={product.id || product._id}>
                        <TableCell className="font-medium">{product.title || product.name || "N/A"}</TableCell>
                        <TableCell>{product.storeName || "N/A"}</TableCell>
                        <TableCell>{product.vendorEmail || product.vendorName || "N/A"}</TableCell>
                        <TableCell>{product.category || "N/A"}</TableCell>
                        <TableCell>₦{(product.price || 0).toLocaleString()}</TableCell>
                        <TableCell>{product.stock || 0}</TableCell>
                        <TableCell>
                          <Badge variant={product.stock > 0 ? "secondary" : "destructive"}>
                            {product.stock > 0 ? "In Stock" : "Out of Stock"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
