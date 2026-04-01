"use client"

import { useEffect, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

type Listing = {
  _id: string
  title: string
  description: string
  imageUrl?: string
  category?: string
  location?: string
  startPrice: number
  currentBid: number
  minIncrement: number
  endsAt: string
  status: "draft" | "live" | "closed"
  featured: boolean
  bidCount: number
}

const initialForm = {
  title: "",
  description: "",
  imageUrl: "",
  category: "",
  location: "",
  startPrice: "",
  minIncrement: "1000",
  reservePrice: "",
  endsAt: "",
  status: "live",
}

export default function AdminBiddingPage() {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [listings, setListings] = useState<Listing[]>([])

  const loadListings = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/bidding")
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to load listings")
      }
      setListings(result.listings || [])
    } catch (err: any) {
      setError(err?.message || "Failed to load listings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadListings()
  }, [])

  const createListing = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setSuccess("")
    setSubmitting(true)

    try {
      const response = await fetch("/api/admin/bidding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startPrice: Number(form.startPrice),
          minIncrement: Number(form.minIncrement),
          reservePrice: form.reservePrice ? Number(form.reservePrice) : undefined,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to create listing")
      }

      setSuccess("Bidding listing created")
      setForm(initialForm)
      await loadListings()
    } catch (err: any) {
      setError(err?.message || "Failed to create listing")
    } finally {
      setSubmitting(false)
    }
  }

  const updateListing = async (listingId: string, patch: Record<string, any>) => {
    setError("")
    try {
      const response = await fetch(`/api/admin/bidding/${listingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to update listing")
      }
      await loadListings()
    } catch (err: any) {
      setError(err?.message || "Failed to update listing")
    }
  }

  const deleteListing = async (listingId: string) => {
    setError("")
    try {
      const response = await fetch(`/api/admin/bidding/${listingId}`, {
        method: "DELETE",
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to delete listing")
      }
      await loadListings()
    } catch (err: any) {
      setError(err?.message || "Failed to delete listing")
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Bidding Marketplace</h1>
          <p className="text-muted-foreground text-sm lg:text-base">
            Admin can create and manage all products listed for live bidding.
          </p>
        </div>

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-green-200 bg-green-50">
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Create New Bidding Product</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createListing} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Image URL"
                  value={form.imageUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                />
              </div>

              <Textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                required
              />

              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  placeholder="Category"
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                />
                <Input
                  placeholder="Location"
                  value={form.location}
                  onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                />
                <Input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))}
                  required
                />
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <Input
                  type="number"
                  min={1}
                  placeholder="Starting Price"
                  value={form.startPrice}
                  onChange={(e) => setForm((prev) => ({ ...prev, startPrice: e.target.value }))}
                  required
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Min Increment"
                  value={form.minIncrement}
                  onChange={(e) => setForm((prev) => ({ ...prev, minIncrement: e.target.value }))}
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Reserve Price (optional)"
                  value={form.reservePrice}
                  onChange={(e) => setForm((prev) => ({ ...prev, reservePrice: e.target.value }))}
                />
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="live">Live</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <Button type="submit" disabled={submitting} className="bg-accent hover:bg-accent/80 text-white">
                {submitting ? "Creating..." : "Create Listing"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Bidding Listings ({listings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading listings...</div>
            ) : listings.length === 0 ? (
              <div className="text-sm text-muted-foreground">No bidding listings yet.</div>
            ) : (
              <div className="space-y-4">
                {listings.map((listing) => (
                  <div key={listing._id} className="rounded-xl border p-4 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-lg">{listing.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="outline">{listing.category || "General"}</Badge>
                          <Badge variant="outline">{listing.location || "Any location"}</Badge>
                          <Badge variant={listing.status === "live" ? "default" : "secondary"}>{listing.status}</Badge>
                          <Badge variant="outline">{listing.bidCount} bids</Badge>
                        </div>
                      </div>
                      <div className="text-sm space-y-1">
                        <p>Start: N{Number(listing.startPrice || 0).toLocaleString()}</p>
                        <p className="font-semibold">Current: N{Number(listing.currentBid || 0).toLocaleString()}</p>
                        <p className="text-muted-foreground">Ends: {new Date(listing.endsAt).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={listing.featured}
                          onCheckedChange={(checked) => updateListing(listing._id, { featured: checked })}
                        />
                        <Label>Featured</Label>
                      </div>

                      <select
                        value={listing.status}
                        onChange={(e) => updateListing(listing._id, { status: e.target.value })}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="draft">Draft</option>
                        <option value="live">Live</option>
                        <option value="closed">Closed</option>
                      </select>

                      <Button variant="destructive" onClick={() => deleteListing(listing._id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
