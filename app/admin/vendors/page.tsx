"use client"

import { useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const getCompactPagination = (currentPage: number, totalPages: number): Array<number | string> => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis-right", totalPages]
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis-left", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, "ellipsis-left", currentPage - 1, currentPage, currentPage + 1, "ellipsis-right", totalPages]
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [currentNoStorePage, setCurrentNoStorePage] = useState(1)
  const itemsPerPage = 20

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

  const vendorsWithStores = filtered.filter((vendor) => vendor.hasStore)
  const vendorsWithoutStores = filtered.filter((vendor) => !vendor.hasStore)

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const totalNoStorePages = Math.max(1, Math.ceil(vendorsWithoutStores.length / itemsPerPage))

  const paginatedVendors = useMemo(
    () => filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filtered, currentPage]
  )

  const paginatedNoStoreVendors = useMemo(
    () => vendorsWithoutStores.slice((currentNoStorePage - 1) * itemsPerPage, currentNoStorePage * itemsPerPage),
    [vendorsWithoutStores, currentNoStorePage]
  )

  const vendorPaginationItems = useMemo(
    () => getCompactPagination(currentPage, totalPages),
    [currentPage, totalPages]
  )

  const noStorePaginationItems = useMemo(
    () => getCompactPagination(currentNoStorePage, totalNoStorePages),
    [currentNoStorePage, totalNoStorePages]
  )

  useEffect(() => {
    setCurrentPage(1)
    setCurrentNoStorePage(1)
  }, [search])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  useEffect(() => {
    if (currentNoStorePage > totalNoStorePages) setCurrentNoStorePage(totalNoStorePages)
  }, [currentNoStorePage, totalNoStorePages])

  const renderAllVendorsPagination = () => {
    if (filtered.length <= itemsPerPage) return null

    return (
      <div className="flex justify-end items-center gap-2">
        <button
          type="button"
          className="h-8 px-3 text-xs rounded border border-border bg-background disabled:opacity-50"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <div className="flex items-center gap-1">
          {vendorPaginationItems.map((item, idx) =>
            typeof item === "number" ? (
              <button
                key={`vendors-page-${item}`}
                type="button"
                className={`h-8 min-w-8 px-2 text-xs rounded border ${currentPage === item ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
                onClick={() => setCurrentPage(item)}
              >
                {item}
              </button>
            ) : (
              <span key={`vendors-ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground select-none">...</span>
            )
          )}
        </div>
        <button
          type="button"
          className="h-8 px-3 text-xs rounded border border-border bg-background disabled:opacity-50"
          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
    )
  }

  const renderNoStorePagination = () => {
    if (vendorsWithoutStores.length <= itemsPerPage) return null

    return (
      <div className="flex justify-end items-center gap-2">
        <button
          type="button"
          className="h-8 px-3 text-xs rounded border border-border bg-background disabled:opacity-50"
          onClick={() => setCurrentNoStorePage((prev) => Math.max(1, prev - 1))}
          disabled={currentNoStorePage === 1}
        >
          Previous
        </button>
        <div className="flex items-center gap-1">
          {noStorePaginationItems.map((item, idx) =>
            typeof item === "number" ? (
              <button
                key={`no-store-page-${item}`}
                type="button"
                className={`h-8 min-w-8 px-2 text-xs rounded border ${currentNoStorePage === item ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
                onClick={() => setCurrentNoStorePage(item)}
              >
                {item}
              </button>
            ) : (
              <span key={`no-store-ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground select-none">...</span>
            )
          )}
        </div>
        <button
          type="button"
          className="h-8 px-3 text-xs rounded border border-border bg-background disabled:opacity-50"
          onClick={() => setCurrentNoStorePage((prev) => Math.min(totalNoStorePages, prev + 1))}
          disabled={currentNoStorePage === totalNoStorePages}
        >
          Next
        </button>
      </div>
    )
  }

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
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">With Store: {vendorsWithStores.length}</Badge>
              <Badge variant="outline">Without Store: {vendorsWithoutStores.length}</Badge>
            </div>
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
                <div className="mt-1 mb-1">{renderAllVendorsPagination()}</div>
                {/* Mobile view - Card layout */}
                <div className="lg:hidden space-y-4">
                  {paginatedVendors.map((vendor) => (
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
                      {paginatedVendors.map((vendor) => (
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

                <div className="mt-2">{renderAllVendorsPagination()}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Vendors Without Stores ({vendorsWithoutStores.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-accent rounded-full"></div>
              </div>
            ) : vendorsWithoutStores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">All vendors currently have stores</div>
            ) : (
              <div className="space-y-4">
                <div className="mt-1 mb-1">{renderNoStorePagination()}</div>
                <div className="lg:hidden space-y-3">
                  {paginatedNoStoreVendors.map((vendor) => (
                    <Card key={`no-store-${vendor.id || vendor._id}`} className="bg-muted/50">
                      <CardContent className="pt-4 space-y-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">Vendor:</span>
                          <span className="text-right text-xs">{vendor.name || "N/A"}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">Email:</span>
                          <span className="text-right text-xs break-all">{vendor.email || "N/A"}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">Joined:</span>
                          <span className="text-right text-xs">{vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : "N/A"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Vendor</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Vendor Type</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedNoStoreVendors.map((vendor) => (
                        <TableRow key={`no-store-row-${vendor.id || vendor._id}`}>
                          <TableCell className="text-xs font-medium">{vendor.name || "N/A"}</TableCell>
                          <TableCell className="text-xs">{vendor.email || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{vendor.vendorType || "both"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={vendor.status === "active" ? "secondary" : "outline"} className="text-xs">
                              {vendor.status || "pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : "N/A"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-2">{renderNoStorePagination()}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
