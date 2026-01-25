"use client"

import { useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Loader2 } from "lucide-react"

export default function AdminServicesPage() {
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [updatingServiceId, setUpdatingServiceId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch("/api/admin/services")
        const data = await res.json()
        if (data.success) {
          setServices(data.services || [])
        }
      } catch (error) {
        console.error("Failed to fetch services:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchServices()
  }, [])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    
    const filtered = services.filter((service) => {
      const matchSearch = 
        (service.serviceTitle || "").toLowerCase().includes(term) ||
        (service.serviceDescription || "").toLowerCase().includes(term) ||
        (service.vendorName || "").toLowerCase().includes(term) ||
        (service.vendorEmail || "").toLowerCase().includes(term) ||
        (service.serviceType || "").toLowerCase().includes(term)
      
      if (!matchSearch) return false
      
      if (statusFilter !== "all" && service.status !== statusFilter) return false
      
      return true
    })

    // Sort by newest first
    return filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateB - dateA
    })
  }, [services, search, statusFilter])

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = filtered.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, "secondary" | "destructive" | "outline"> = {
      active: "secondary",
      inactive: "destructive",
      pending: "outline",
    }
    return <Badge variant={variants[status] || "outline"}>{status || "pending"}</Badge>
  }

  const handleStatusUpdate = async (serviceId: string, newStatus: string) => {
    setUpdatingServiceId(serviceId)
    try {
      const res = await fetch('/api/admin/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, status: newStatus })
      })
      const data = await res.json()
      if (data.success) {
        setServices(prev => prev.map(s => s.serviceId === serviceId ? { ...s, status: newStatus } : s))
      }
    } catch (error) {
      console.error('Failed to update service status:', error)
    } finally {
      setUpdatingServiceId(null)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Services Management</h1>
          <p className="text-muted-foreground text-sm lg:text-base">Track and manage all marketplace services</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Search Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, vendor, or type"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium block mb-2">Service Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={() => { setStatusFilter('all'); setSearch(''); setCurrentPage(1); }} className="w-full h-9 text-sm">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">All Services ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-accent rounded-full"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No services found</div>
            ) : (
              <div className="space-y-4">
                {/* Mobile view - Card layout */}
                <div className="lg:hidden space-y-4">
                  {paginatedItems.map((service) => (
                    <Card key={service.serviceId} className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Service:</span>
                            <span className="text-right font-medium text-xs">{service.serviceTitle || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Vendor:</span>
                            <div className="text-right">
                              <p className="text-xs font-medium">{service.vendorName || "N/A"}</p>
                              <p className="text-xs text-muted-foreground">{service.vendorEmail}</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Type:</span>
                            <span className="text-xs">{service.serviceType || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Price:</span>
                            <span className="text-xs font-semibold">₦{Number(service.price || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Status:</span>
                            <Select value={service.status || "pending"} onValueChange={(val) => handleStatusUpdate(service.serviceId, val)} disabled={updatingServiceId === service.serviceId}>
                              <SelectTrigger className="w-28 h-8 text-xs">
                                {updatingServiceId === service.serviceId ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">Date:</span>
                            <span className="text-xs">{service.createdAt ? new Date(service.createdAt).toLocaleDateString() : "N/A"}</span>
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
                        <TableHead className="text-xs">Service Title</TableHead>
                        <TableHead className="text-xs">Vendor</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Price</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map((service) => (
                        <TableRow key={service.serviceId} className="hover:bg-muted/50">
                          <TableCell className="font-medium text-xs">{service.serviceTitle || "N/A"}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-xs">{service.vendorName || "N/A"}</p>
                              <p className="text-xs text-muted-foreground">{service.vendorEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{service.serviceType || "N/A"}</TableCell>
                          <TableCell className="text-xs font-semibold">₦{Number(service.price || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Select value={service.status || "pending"} onValueChange={(val) => handleStatusUpdate(service.serviceId, val)} disabled={updatingServiceId === service.serviceId}>
                              <SelectTrigger className="w-28 h-8 text-xs">
                                {updatingServiceId === service.serviceId ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-xs">
                            {service.createdAt ? new Date(service.createdAt).toLocaleDateString() : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-end items-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-8 px-3 text-xs"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(page)}
                          className="h-8 w-8 p-0 text-xs"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="h-8 px-3 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
