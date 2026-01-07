"use client"

import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserCheck, UserX } from "lucide-react"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"

export default function UserProfilePage() {
  const { user, userProfile } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userProfile) {
      setProfile({
        id: userProfile.uid,
        name: userProfile.displayName,
        email: userProfile.email,
        role: userProfile.role,
        status: "active",
        joinDate: userProfile.createdAt?.toISOString().split('T')[0] || "2024-01-01",
        orders: 0, // This would come from actual orders data
        totalSpent: 0, // This would come from actual orders data
        address: "", // This would come from user profile
        phone: "", // This would come from user profile
      })
    }
    setLoading(false)
  }, [userProfile])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!profile) {
    return <div>Please log in to view your profile.</div>
  }

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
    setProfile((prev) => prev ? ({ ...prev, status: newStatus }) : null)
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
                <span className="font-medium">Name:</span> {profile.name}
              </div>
              <div>
                <span className="font-medium">Email:</span> {profile.email}
              </div>
              <div>
                <span className="font-medium">Role:</span> {getRoleBadge(profile.role)}
              </div>
              <div>
                <span className="font-medium">Status:</span> {getStatusBadge(profile.status)}
              </div>
              <div>
                <span className="font-medium">Join Date:</span> {new Date(profile.joinDate).toLocaleDateString()}
              </div>
              <div>
                <span className="font-medium">Address:</span> {profile.address || 'Not provided'}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {profile.phone || 'Not provided'}
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
                  <TableCell>{profile.orders}</TableCell>
                  <TableCell>${profile.totalSpent.toFixed(2)}</TableCell>
                  <TableCell>
                    {profile.status === "active" ? (
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
