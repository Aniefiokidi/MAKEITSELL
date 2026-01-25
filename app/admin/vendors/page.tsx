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
          <h1 className="text-2xl lg:text-3xl font-bold">Vendors Management</h1>
          <p className="text-muted-foreground text-sm lg:text-base">View and manage all vendors on the marketplace</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Search Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search by store name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full lg:max-w-md text-sm"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">All Vendors ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-accent rounded-full"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No vendors found</div>
            ) : (
              <div className="space-y-4">
                {/* Mobile view - Card layout */}
                <div className="lg:hidden space-y-4">
                  {filtered.map((vendor) => (
                    <Card key={vendor.id || vendor._id} className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Store:</span>
                            <span className="text-right font-medium text-xs">{vendor.storeName || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Vendor:</span>
                            <span className="text-right text-xs">{vendor.name || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Email:</span>
                            <span className="text-right text-xs break-all">{vendor.email || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Type:</span>
                            <Badge variant="outline" className="text-xs">{vendor.vendorType || "both"}</Badge>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Status:</span>
                            <Badge variant={vendor.status === "active" ? "secondary" : "outline"} className="text-xs">
                              {vendor.status || "pending"}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Joined:</span>
                            <span className="text-right text-xs">
                              {vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : "N/A"}
                            </span>
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
                        <TableHead className="text-xs">Store Name</TableHead>
                        <TableHead className="text-xs">Vendor</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((vendor) => (
                        <TableRow key={vendor.id || vendor._id}>
                          <TableCell className="font-medium text-xs">{vendor.storeName || "N/A"}</TableCell>
                          <TableCell className="text-xs">{vendor.name || "N/A"}</TableCell>
                          <TableCell className="text-xs">{vendor.email || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{vendor.vendorType || "both"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={vendor.status === "active" ? "secondary" : "outline"} className="text-xs">
                              {vendor.status || "pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : "N/A"}
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
