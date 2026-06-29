"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"

interface StreakTargetModalProps {
  floorOrderCount: number
  isDefaultFloor: boolean
  onSuccess: () => void
}

const PRIZES = [
  { months: 3, amount: "₦15,000" },
  { months: 6, amount: "₦40,000" },
  { months: 12, amount: "₦150,000" },
]

export default function StreakTargetModal({ floorOrderCount, isDefaultFloor, onSuccess }: StreakTargetModalProps) {
  const { logout, userProfile } = useAuth()
  const [target, setTarget] = useState(String(floorOrderCount))
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const vendorName = userProfile?.vendorInfo?.businessName || userProfile?.displayName || "your store"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const val = Number(target)
    if (!Number.isFinite(val) || val < floorOrderCount) {
      setError(`Your minimum target is ${floorOrderCount} orders based on your lowest-priced product.`)
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/vendor/streak/set-target", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetOrderCount: val }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to save. Please try again.")
        return
      }
      onSuccess()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    // Full-screen fixed overlay — no click-outside dismiss, no close button
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-accent/30 overflow-hidden">
        {/* Header band */}
        <div className="bg-accent px-6 py-5">
          <h2 className="text-xl font-bold text-white">Set Your Monthly Sales Target</h2>
          <p className="text-white/80 text-sm mt-1">One-time setup — takes 30 seconds</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Context */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            Based on your products, your minimum target is{" "}
            <span className="font-semibold text-foreground">{floorOrderCount} orders per month</span>.
            Set a target you can realistically hit every month. Changing your target resets your streak to zero.
          </p>

          {/* Prize callouts */}
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-2">
            <p className="text-xs font-semibold text-accent uppercase tracking-wide">Streak Prizes</p>
            {PRIZES.map(p => (
              <div key={p.months} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Hit target {p.months} months in a row</span>
                <span className="font-bold text-foreground">{p.amount} cash</span>
              </div>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="streak-target" className="block text-sm font-medium text-foreground mb-1.5">
                My monthly target <span className="text-muted-foreground font-normal">(minimum {floorOrderCount} orders)</span>
              </label>
              <input
                id="streak-target"
                type="number"
                min={floorOrderCount}
                value={target}
                onChange={e => { setTarget(e.target.value); setError("") }}
                placeholder={String(floorOrderCount)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                required
              />
              {isDefaultFloor && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  You have no active products yet. This minimum is based on our platform average and will update automatically when you list your first product.
                </p>
              )}
              {error && (
                <p className="text-xs text-destructive mt-1.5">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-white font-semibold py-3 rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-60"
            >
              {loading ? "Saving…" : "Set My Target and Start My Streak"}
            </button>
          </form>

          {/* Logout escape — small and secondary */}
          <div className="text-center pt-1">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              {loggingOut ? "Logging out…" : "Not ready? Log out and return later"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
