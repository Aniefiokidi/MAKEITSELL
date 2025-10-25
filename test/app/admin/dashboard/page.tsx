"use client"

import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, Store, Package, DollarSign, TrendingUp, AlertTriangle, MessageSquare } from "lucide-react"

// Mock data
const mockStats = {
  totalUsers: 12543,
  totalVendors: 1247,
  totalProducts: 8932,
  totalOrders: 3421,
  totalRevenue: 245670,
  pendingTickets: 23,
  activeVendors: 892,
  lowStockProducts: 45,
}

const recentOrders = [
  {
    id: "ORD-12345",
    customer: "John Doe",
    vendor: "TechStore",
    amount: 299.99,
    status: "completed",
    date: "2024-01-15",
  },
  {
    id: "ORD-12346",
    customer: "Jane Smith",
    vendor: "FashionHub",
    amount: 149.5,
    status: "processing",
    date: "2024-01-15",
  },
  {
    id: "ORD-12347",
    customer: "Mike Johnson",
    vendor: "HomeGoods",
    amount: 89.99,
    status: "shipped",
    date: "2024-01-14",
  },
]

const recentTickets = [
  {
    id: "TKT-001",
    subject: "Payment issue",
    customer: "Alice Brown",
    priority: "high",
    status: "open",
    date: "2024-01-15",
  },
  {
    id: "TKT-002",
    subject: "Product not delivered",
    customer: "Bob Wilson",
    priority: "medium",
    status: "in-progress",
    date: "2024-01-14",
  },
]

export default function AdminDashboard() {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "secondary",
      processing: "default",
      shipped: "outline",
      open: "destructive",
      "in-progress": "default",
    }
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>
  }

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "outline",
      medium: "secondary",
      high: "destructive",
    }
    return <Badge variant={variants[priority] || "outline"}>{priority}</Badge>
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-balance">Dashboard Overview</h1>
          <p className="text-muted-foreground">Monitor your marketplace performance and key metrics</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">+12% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Vendors</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.activeVendors.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">+8% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.totalProducts.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">+15% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${mockStats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">+23% from last month</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-800">Pending Support Tickets</CardTitle>
              <MessageSquare className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-800">{mockStats.pendingTickets}</div>
              <Button size="sm" variant="outline" className="mt-2 text-orange-700 border-orange-300 bg-transparent">
                View Tickets
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-800">Low Stock Products</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-800">{mockStats.lowStockProducts}</div>
              <Button size="sm" variant="outline" className="mt-2 text-red-700 border-red-300 bg-transparent">
                View Products
              </Button>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">Monthly Growth</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-800">+18.2%</div>
              <p className="text-xs text-green-600 mt-1">Revenue growth this month</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{order.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.customer} • {order.vendor}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-medium">${order.amount}</p>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Support Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{ticket.id}</p>
                      <p className="text-sm text-muted-foreground text-balance">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">{ticket.customer}</p>
                    </div>
                    <div className="text-right space-y-1">
                      {getPriorityBadge(ticket.priority)}
                      {getStatusBadge(ticket.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
