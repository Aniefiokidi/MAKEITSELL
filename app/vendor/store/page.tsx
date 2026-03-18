"use client"

import { useEffect, useState } from "react"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Store, Package, Plus, ShoppingCart, BarChart3 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

type StoreItem = {
  id?: string
  _id?: string
  storeName?: string
  category?: string
  isOpen?: boolean
  isActive?: boolean
  address?: string
  productCount?: number
}

export default function VendorStorePage() {
  const { user } = useAuth()
  const [stores, setStores] = useState<StoreItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actioningStoreId, setActioningStoreId] = useState<string | null>(null)

  const loadStores = async () => {
    if (!user?.uid) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/database/stores?vendorId=${user.uid}`)
      const result = await response.json()
      if (result?.success && Array.isArray(result.data)) {
        setStores(result.data)
      } else {
        setStores([])
      }
    } catch (error) {
      console.error("Failed to load stores:", error)
      setStores([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStores()
  }, [user?.uid])

  const handleArchiveToggle = async (store: StoreItem) => {
    const storeId = String(store.id || store._id || "")
    if (!storeId) return
    setActioningStoreId(storeId)
    try {
      const response = await fetch(`/api/database/stores/${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: store.isActive === false }),
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to update store")
      }
      await loadStores()
    } catch (error) {
      console.error("Failed to archive store:", error)
      window.alert("Failed to update store status.")
    } finally {
      setActioningStoreId(null)
    }
  }

  const handleDeleteStore = async (store: StoreItem) => {
    const storeId = String(store.id || store._id || "")
    if (!storeId) return
    if (!window.confirm(`Delete ${store.storeName || "this store"}? This cannot be undone.`)) return

    setActioningStoreId(storeId)
    try {
      const response = await fetch(`/api/database/stores/${storeId}`, {
        method: "DELETE",
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to delete store")
      }
      await loadStores()
    } catch (error) {
      console.error("Failed to delete store:", error)
      window.alert("Failed to delete store.")
    } finally {
      setActioningStoreId(null)
    }
  }

  const canCreateStore = stores.length < 5

  return (
    <VendorLayout>
      <div className="container mx-auto py-12">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <Store className="h-8 w-8 text-primary" />
          My Stores
        </h1>
        <p className="text-muted-foreground mb-4">Set up and manage up to 5 stores from one dashboard.</p>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <Badge variant="outline">{stores.length}/5 stores used</Badge>
          <Button asChild disabled={!canCreateStore}>
            <Link href="/vendor/store-settings?new=1">
              <Plus className="mr-2 h-4 w-4" />
              Create New Store
            </Link>
          </Button>
          {!canCreateStore ? (
            <p className="text-xs text-muted-foreground">Store limit reached. Delete/archive a store to add another.</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">Loading stores...</CardContent>
            </Card>
          ) : stores.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">No stores yet. Create your first store to get started.</CardContent>
            </Card>
          ) : (
            stores.map((store, index) => {
              const storeId = String(store.id || store._id || "")
              return (
                <Card key={storeId || index}>
                  <CardHeader>
                    <CardTitle className="text-base">{store.storeName || "Untitled Store"}</CardTitle>
                    <CardDescription>{store.category || "General"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={store.isActive === false ? "secondary" : (store.isOpen ? "default" : "secondary")}>
                        {store.isActive === false ? "Archived" : (store.isOpen ? "Open" : "Closed")}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Products</span>
                      <span>{Number(store.productCount || 0)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{store.address || "No address"}</p>
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/vendor/store-settings?storeId=${storeId}`}>Manage Store</Link>
                    </Button>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={actioningStoreId === storeId}
                        onClick={() => handleArchiveToggle(store)}
                      >
                        {store.isActive === false ? "Unarchive" : "Archive"}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={actioningStoreId === storeId}
                        onClick={() => handleDeleteStore(store)}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

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
