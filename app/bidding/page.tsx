"use client"

import { useEffect, useMemo, useState } from "react"
import Header from "@/components/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Clock3, Gavel, Trophy } from "lucide-react"

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

const fallbackImage = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80"

export default function BiddingPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"live" | "closed">("live")
  const [placing, setPlacing] = useState<string>("")
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null)
  const [bidForms, setBidForms] = useState<Record<string, { bidderName: string; bidderEmail: string; amount: string }>>({})

  const loadListings = async (status: "live" | "closed") => {
    setLoading(true)
    setFeedback(null)
    try {
      const response = await fetch(`/api/bidding?status=${status}`)
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to load bidding products")
      }
      setListings(result.listings || [])
    } catch (error: any) {
      setFeedback({ type: "error", message: error?.message || "Failed to load bidding products" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadListings(statusFilter)
  }, [statusFilter])

  const onBidInputChange = (id: string, field: "bidderName" | "bidderEmail" | "amount", value: string) => {
    setBidForms((prev) => ({
      ...prev,
      [id]: {
        bidderName: prev[id]?.bidderName || "",
        bidderEmail: prev[id]?.bidderEmail || "",
        amount: prev[id]?.amount || "",
        [field]: value,
      },
    }))
  }

  const placeBid = async (listing: Listing) => {
    const form = bidForms[listing._id] || { bidderName: "", bidderEmail: "", amount: "" }
    setPlacing(listing._id)
    setFeedback(null)

    try {
      const response = await fetch(`/api/bidding/${listing._id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bidderName: form.bidderName,
          bidderEmail: form.bidderEmail,
          amount: Number(form.amount),
        }),
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to place bid")
      }

      setFeedback({ type: "success", message: `Bid placed successfully on ${listing.title}.` })
      await loadListings(statusFilter)
      setBidForms((prev) => ({
        ...prev,
        [listing._id]: {
          bidderName: form.bidderName,
          bidderEmail: form.bidderEmail,
          amount: "",
        },
      }))
    } catch (error: any) {
      setFeedback({ type: "error", message: error?.message || "Failed to place bid" })
    } finally {
      setPlacing("")
    }
  }

  const now = Date.now()
  const withCountdown = useMemo(() => {
    return listings.map((listing) => {
      const end = new Date(listing.endsAt).getTime()
      const remainingMs = Math.max(end - now, 0)
      const hours = Math.floor(remainingMs / (1000 * 60 * 60))
      const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))
      return {
        ...listing,
        countdown: `${hours}h ${minutes}m`,
      }
    })
  }, [listings, now])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fff7ed_0%,#fff_45%,#f5f3ff_100%)]">
      <Header />
      <main className="container mx-auto px-3 sm:px-4 py-8 sm:py-12 space-y-8">
        <section className="rounded-3xl border border-accent/20 bg-white/70 backdrop-blur p-5 sm:p-8 shadow-sm">
          <div className="space-y-3">
            <Badge className="bg-accent text-white hover:bg-accent uppercase tracking-wide">Live Marketplace Auctions</Badge>
            <h1
              className="font-['Bebas_Neue'] text-5xl sm:text-7xl leading-none tracking-[0.06em] uppercase text-accent"
              style={{ textShadow: "0 0 10px hsl(var(--accent)/0.38), 0 0 24px hsl(var(--accent)/0.28)" }}
            >
              BID. WIN. CELEBRATE.
            </h1>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => setStatusFilter("live")}
            className={`uppercase tracking-wide ${statusFilter === "live" ? "bg-accent text-white hover:bg-accent/85" : "border-accent/40 text-accent hover:bg-accent hover:text-white"}`}
            variant={statusFilter === "live" ? "default" : "outline"}
          >
            Live Auctions
          </Button>
          <Button
            onClick={() => setStatusFilter("closed")}
            className={`uppercase tracking-wide ${statusFilter === "closed" ? "bg-accent text-white hover:bg-accent/85" : "border-accent/40 text-accent hover:bg-accent hover:text-white"}`}
            variant={statusFilter === "closed" ? "default" : "outline"}
          >
            Closed Auctions
          </Button>
        </div>

        {feedback && (
          <Alert className={feedback.type === "error" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
            <AlertDescription className={feedback.type === "error" ? "text-red-700" : "text-green-700"}>
              {feedback.message}
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading bidding products...</div>
        ) : withCountdown.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No auctions found for this filter.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {withCountdown.map((listing) => {
              const form = bidForms[listing._id] || { bidderName: "", bidderEmail: "", amount: "" }
              const minBid = Number(listing.currentBid || listing.startPrice) + Number(listing.minIncrement || 0)
              const isLive = statusFilter === "live"

              return (
                <Card key={listing._id} className="overflow-hidden border-accent/20 shadow-sm hover:shadow-md transition-shadow">
                  <div className="h-44 w-full relative overflow-hidden">
                    <img
                      src={listing.imageUrl || fallbackImage}
                      alt={listing.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <Badge className="bg-white/90 text-black">{listing.category || "General"}</Badge>
                      {listing.featured ? <Badge className="bg-accent text-white">Featured</Badge> : null}
                    </div>
                  </div>

                  <CardHeader className="space-y-2">
                    <CardTitle className="line-clamp-1">{listing.title}</CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg border p-2">
                        <p className="text-muted-foreground text-xs">Current Bid</p>
                        <p className="font-semibold">N{Number(listing.currentBid || 0).toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border p-2">
                        <p className="text-muted-foreground text-xs">Bids</p>
                        <p className="font-semibold flex items-center gap-1"><Trophy className="h-4 w-4 text-accent" />{listing.bidCount}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock3 className="h-4 w-4" /> Ends in
                      </span>
                      <span className="font-semibold">{listing.countdown}</span>
                    </div>

                    {isLive ? (
                      <div className="space-y-2 pt-2 border-t">
                        <Input
                          placeholder="Your name"
                          value={form.bidderName}
                          onChange={(e) => onBidInputChange(listing._id, "bidderName", e.target.value)}
                        />
                        <Input
                          type="email"
                          placeholder="Email (optional)"
                          value={form.bidderEmail}
                          onChange={(e) => onBidInputChange(listing._id, "bidderEmail", e.target.value)}
                        />
                        <Input
                          type="number"
                          min={minBid}
                          placeholder={`Minimum bid: N${minBid.toLocaleString()}`}
                          value={form.amount}
                          onChange={(e) => onBidInputChange(listing._id, "amount", e.target.value)}
                        />
                        <Button
                          className="w-full bg-accent hover:bg-accent/85 text-white uppercase tracking-wide"
                          onClick={() => placeBid(listing)}
                          disabled={placing === listing._id}
                        >
                          <Gavel className="h-4 w-4 mr-2" />
                          {placing === listing._id ? "Placing Bid..." : "Place Bid"}
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-muted p-3 text-sm text-muted-foreground">
                        This auction has ended.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
