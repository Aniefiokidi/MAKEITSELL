"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"

interface Review {
  _id: string
  customerName: string
  rating: number
  comment: string
  createdAt: string
  reply?: string
}

interface ReviewsSectionProps {
  targetType: "product" | "service"
  targetId: string
}

export function ReviewsSection({ targetType, targetId }: ReviewsSectionProps) {
  const { user } = useAuth()
  const basePath = targetType === "product" ? `/api/products/${targetId}` : `/api/services/${targetId}`

  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [canReview, setCanReview] = useState(false)
  const [eligibilityKey, setEligibilityKey] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    fetch(`${basePath}/reviews`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.success) setReviews(Array.isArray(d.reviews) ? d.reviews : [])
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, targetType])

  useEffect(() => {
    if (!user) {
      setCanReview(false)
      return
    }
    let cancelled = false
    fetch(`${basePath}/can-review`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.success) return
        setCanReview(!!d.canReview)
        setEligibilityKey(targetType === "product" ? d.orderId || null : d.bookingId || null)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, targetId, targetType])

  const handleSubmit = async () => {
    if (!eligibilityKey) return
    setSubmitting(true)
    setError("")
    try {
      const body =
        targetType === "product"
          ? { orderId: eligibilityKey, rating, comment }
          : { bookingId: eligibilityKey, rating, comment }

      const res = await fetch(`${basePath}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || "Could not submit review")
        return
      }
      setReviews((prev) => [data.review, ...prev])
      setCanReview(false)
      setComment("")
      setRating(5)
    } catch {
      setError("Could not submit review")
    } finally {
      setSubmitting(false)
    }
  }

  const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Reviews {reviews.length > 0 && `(${reviews.length})`}</h3>
        {reviews.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold text-sm">{avgRating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">/ 5</span>
          </div>
        )}
      </div>

      {canReview && (
        <div className="rounded-xl border border-border/60 p-4 space-y-3">
          <p className="text-sm font-medium">Rate your {targetType === "product" ? "purchase" : "experience"}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)}>
                <svg
                  className={`w-7 h-7 ${n <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300 fill-gray-200"}`}
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z" />
                </svg>
              </button>
            ))}
          </div>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent"
            rows={3}
            placeholder={`Share your experience (optional)…`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button size="sm" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Submitting…" : "Submit Review"}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          reviews.map((review) => (
            <div key={review._id} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{review.customerName}</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`w-3.5 h-3.5 ${n <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                    />
                  ))}
                </div>
              </div>
              {review.comment && <p className="text-sm text-muted-foreground mt-1.5">{review.comment}</p>}
              <p className="text-xs text-muted-foreground/70 mt-1.5">
                {new Date(review.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              {review.reply && (
                <div className="mt-2 ml-3 pl-3 border-l-2 border-accent/30">
                  <p className="text-xs font-medium text-accent">Vendor reply</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{review.reply}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
