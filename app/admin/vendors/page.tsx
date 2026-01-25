"use client"

import { useEffect, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const res = await fetch("/api/admin/vendors")
        const data = await res.json()
        if (data.success) {
          setVendors(data.vendors || [])
        }
      } catch (error) {
        console.error("Failed to fetch vendors:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchVendors()
  }, [])

  const filtered = vendors.filter(v =>
    v.storeName?.toLowerCase().includes(search.toLowerCase()) ||
    v.email?.toLowerCase().includes(search.toLowerCase()) ||
    v.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Vendors Management</h1>
          <p className="text-muted-foreground">View and manage all vendors on the marketplace</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search by store name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-accent rounded-full"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No vendors found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store Name</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((vendor) => (
                      <TableRow key={vendor.id || vendor._id}>
                        <TableCell className="font-medium">{vendor.storeName || "N/A"}</TableCell>
                        <TableCell>{vendor.name || "N/A"}</TableCell>
                        <TableCell>{vendor.email || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{vendor.vendorType || "both"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={vendor.status === "active" ? "secondary" : "outline"}>
                            {vendor.status || "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {vendor.createdAt
                            ? new Date(vendor.createdAt).toLocaleDateString()
                            : "N/A"}
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
