"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Header from "@/components/Header"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Clock3, Gavel, Trophy } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

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

const fallbackImage =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80"

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ended"
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

export default function BiddingPage() {
  const { user, userProfile } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"live" | "closed">("live")
  const [placing, setPlacing] = useState("")
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null)
  const [bidForms, setBidForms] = useState<Record<string, string>>({})
  const [now, setNow] = useState(Date.now())

  // Live countdown — ticks every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const loadListings = useCallback(async (status: "live" | "closed") => {
    setLoading(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/bidding?status=${status}`)
      const result = await res.json()
      if (!res.ok || !result?.success) throw new Error(result?.error || "Failed to load auctions")
      setListings(result.listings || [])
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to load auctions" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadListings(statusFilter)
  }, [statusFilter, loadListings])

  // Auto-refresh live listings every 30 s so new bids appear
  useEffect(() => {
    if (statusFilter !== "live") return
    const interval = setInterval(() => loadListings("live"), 30000)
    return () => clearInterval(interval)
  }, [statusFilter, loadListings])

  const placeBid = async (listing: Listing) => {
    if (!user) {
      setFeedback({ type: "error", message: "Please sign in to place a bid." })
      return
    }
    const amount = Number(bidForms[listing._id] || "")
    const minBid = (listing.currentBid || listing.startPrice) + (listing.minIncrement || 0)
    if (!amount || amount < minBid) {
      setFeedback({ type: "error", message: `Minimum bid is ₦${minBid.toLocaleString("en-NG")}` })
      return
    }
    setPlacing(listing._id)
    setFeedback(null)
    try {
      const res = await fetch(`/api/bidding/${listing._id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })
      const result = await res.json()
      if (!res.ok || !result?.success) throw new Error(result?.error || "Failed to place bid")
      setFeedback({
        type: "success",
        message: `Bid of ₦${amount.toLocaleString("en-NG")} placed on "${listing.title}"!`,
      })
      setBidForms((prev) => ({ ...prev, [listing._id]: "" }))
      await loadListings(statusFilter)
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to place bid" })
    } finally {
      setPlacing("")
    }
  }

  const withCountdown = useMemo(() => {
    return listings.map((l) => ({
      ...l,
      countdown: formatCountdown(new Date(l.endsAt).getTime() - now),
    }))
  }, [listings, now])

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-accent/5 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-8 sm:py-12 space-y-6 sm:space-y-8">
        {/* Hero */}
        <section className="space-y-2">
          <Badge className="bg-accent text-white hover:bg-accent uppercase tracking-wide">
            Live Marketplace Auctions
          </Badge>
          <h1 className="font-['Bebas_Neue'] text-5xl sm:text-7xl leading-none tracking-[0.06em] uppercase text-foreground">
            Bid. Win. Celebrate.
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Competitive auctions on products and collectibles. Each winning bid places a 100% wallet
            hold — released automatically if you&apos;re outbid.
          </p>
        </section>

        {/* Filter tabs — pill toggle matching site style */}
        <div className="mx-auto w-full max-w-xs rounded-full border border-accent/30 bg-muted/30 p-1">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter("live")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                statusFilter === "live"
                  ? "bg-accent text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🔴 Live
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("closed")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                statusFilter === "closed"
                  ? "bg-accent text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Closed
            </button>
          </div>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <Alert
            className={
              feedback.type === "error" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
            }
          >
            <AlertDescription
              className={feedback.type === "error" ? "text-red-700" : "text-green-700"}
            >
              {feedback.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Sign-in notice for guests browsing live auctions */}
        {!user && statusFilter === "live" && !loading && withCountdown.length > 0 && (
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-sm text-center">
            <Link href="/login" className="text-accent font-semibold hover:underline">
              Sign in
            </Link>{" "}
            to place bids.
          </div>
        )}

        {loading ? (
          /* Loading skeletons matching card shape */
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-neutral-200 animate-pulse">
                <div className="aspect-square bg-neutral-200" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-neutral-200 rounded w-3/4" />
                  <div className="h-4 bg-neutral-200 rounded w-1/2" />
                  <div className="h-8 bg-neutral-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : withCountdown.length === 0 ? (
          /* Empty state */
          <div className="rounded-2xl border border-dashed border-accent/30 bg-accent/5 py-20 text-center">
            <Gavel className="h-10 w-10 mx-auto text-accent/40 mb-4" />
            <p className="font-semibold text-foreground">
              No {statusFilter} auctions right now
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter === "live"
                ? "Check back soon — new auctions are added regularly."
                : "No completed auctions to show yet."}
            </p>
            {statusFilter === "closed" && (
              <button
                onClick={() => setStatusFilter("live")}
                className="mt-4 text-accent text-sm font-medium hover:underline"
              >
                View live auctions
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {withCountdown.map((listing) => {
              const isLive = statusFilter === "live"
              const bidAmount = bidForms[listing._id] || ""
              const minBid =
                (listing.currentBid || listing.startPrice) + (listing.minIncrement || 0)
              const parsedAmount = Number(bidAmount)

              return (
                <div
                  key={listing._id}
                  className="rounded-2xl overflow-hidden border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow bg-card"
                >
                  {/* Image with overlaid info */}
                  <div className="aspect-square relative overflow-hidden">
                    <img
                      src={listing.imageUrl || fallbackImage}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-transparent" />

                    {/* Top: category + status badges */}
                    <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1">
                      {listing.category && (
                        <Badge className="bg-black/50 backdrop-blur-sm border-0 text-white text-[10px] px-1.5 py-0.5 shrink-0">
                          {listing.category}
                        </Badge>
                      )}
                      <div className="flex flex-col items-end gap-1 ml-auto shrink-0">
                        {listing.featured && (
                          <Badge className="bg-accent text-white text-[10px] px-1.5 py-0.5">
                            Featured
                          </Badge>
                        )}
                        {isLive ? (
                          <span className="flex items-center gap-1 bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
                            LIVE
                          </span>
                        ) : (
                          <span className="bg-neutral-800/80 backdrop-blur-sm text-neutral-300 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                            ENDED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom overlay: title + current bid + countdown */}
                    <div className="absolute bottom-0 left-0 right-0 p-2.5 space-y-1">
                      <h3 className="text-white font-semibold text-xs sm:text-sm leading-snug line-clamp-2">
                        {listing.title}
                      </h3>
                      <div className="flex items-end justify-between gap-1">
                        <div>
                          <p className="text-white/60 text-[9px] sm:text-[10px] font-medium leading-none">
                            Current bid
                          </p>
                          <p className="text-white font-extrabold text-base sm:text-lg leading-tight">
                            ₦
                            {Number(
                              listing.currentBid || listing.startPrice || 0
                            ).toLocaleString("en-NG")}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-0.5 text-white/80 text-[10px] sm:text-xs justify-end">
                            <Clock3 className="h-3 w-3 shrink-0" />
                            <span className="font-mono font-semibold">{listing.countdown}</span>
                          </div>
                          <p className="text-white/50 text-[9px]">
                            <Trophy className="h-2.5 w-2.5 inline mr-0.5" />
                            {listing.bidCount} bid{listing.bidCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bid input (live) or closed notice */}
                  {isLive ? (
                    <div className="p-2.5 sm:p-3 space-y-1.5 border-t border-neutral-100">
                      <div className="flex gap-1.5">
                        <Input
                          type="number"
                          min={minBid}
                          placeholder={`Min ₦${minBid.toLocaleString("en-NG")}`}
                          value={bidAmount}
                          onChange={(e) =>
                            setBidForms((prev) => ({ ...prev, [listing._id]: e.target.value }))
                          }
                          className="h-8 text-xs flex-1 min-w-0"
                          disabled={!user}
                        />
                        <Button
                          size="sm"
                          className="h-8 px-2.5 bg-accent hover:bg-accent/90 text-white shrink-0 gap-1"
                          onClick={() => placeBid(listing)}
                          disabled={placing === listing._id || !user}
                        >
                          <Gavel className="h-3.5 w-3.5" />
                          {placing === listing._id ? "…" : user ? "Bid" : "Sign in"}
                        </Button>
                      </div>
                      {bidAmount && parsedAmount > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          Wallet hold: ₦{parsedAmount.toLocaleString("en-NG")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 sm:p-3 border-t border-neutral-100">
                      <p className="text-xs text-muted-foreground text-center">Auction ended</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
