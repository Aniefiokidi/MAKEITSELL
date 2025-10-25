"use client"

import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Store, Package, Plus, ShoppingCart, BarChart3 } from "lucide-react"

export default function VendorStorePage() {
  return (
    <VendorLayout>
      <div className="container mx-auto py-12">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <Store className="h-8 w-8 text-primary" />
          My Store
        </h1>
        <p className="text-muted-foreground mb-8">Welcome to your vendor storefront. Manage your products, view orders, and track your store's performance.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
              <CardDescription>Manage your product listings</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full mb-2">
                <Link href="/vendor/products">
                  <Package className="mr-2 h-4 w-4" />
                  View Products
                </Link>
              </Button>
              <Button asChild className="w-full">
                <Link href="/vendor/products/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
              <CardDescription>View and manage orders</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/vendor/orders">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  View Orders
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
              <CardDescription>Track your store's performance</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/vendor/analytics">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Analytics
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </VendorLayout>
  )
}
