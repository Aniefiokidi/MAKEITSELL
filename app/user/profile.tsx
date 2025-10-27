"use client"

import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserCheck, UserX } from "lucide-react"
import { useState } from "react"

// Mock user profile data
const mockUser = {
  id: "user_001",
  name: "John Doe",
  email: "john@example.com",
  role: "customer",
  status: "active",
  joinDate: "2024-01-10",
  orders: 12,
  totalSpent: 1299.99,
  address: "123 Main St, Washington, DC",
  phone: "+1 555-1234",
}

export default function UserProfilePage() {
  const [user, setUser] = useState(mockUser)

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "secondary",
      suspended: "destructive",
      pending: "outline",
    }
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>
  }

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      customer: "outline",
      vendor: "default",
      admin: "secondary",
    }
    return <Badge variant={variants[role] || "outline"}>{role}</Badge>
  }

  const handleStatusChange = (newStatus: string) => {
    setUser((prev) => ({ ...prev, status: newStatus }))
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-balance">User Profile</h1>
          <p className="text-muted-foreground">View and manage your account details</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <span className="font-medium">Name:</span> {user.name}
              </div>
              <div>
                <span className="font-medium">Email:</span> {user.email}
              </div>
              <div>
                <span className="font-medium">Role:</span> {getRoleBadge(user.role)}
              </div>
              <div>
                <span className="font-medium">Status:</span> {getStatusBadge(user.status)}
              </div>
              <div>
                <span className="font-medium">Join Date:</span> {new Date(user.joinDate).toLocaleDateString()}
              </div>
              <div>
                <span className="font-medium">Address:</span> {user.address}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {user.phone}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Order Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orders</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>{user.orders}</TableCell>
                  <TableCell>${user.totalSpent.toFixed(2)}</TableCell>
                  <TableCell>
                    {user.status === "active" ? (
                      <Button variant="destructive" size="sm" onClick={() => handleStatusChange("suspended")}> <UserX className="mr-2 h-4 w-4" /> Suspend </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => handleStatusChange("active")}> <UserCheck className="mr-2 h-4 w-4" /> Activate </Button>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
