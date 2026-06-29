"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Flame, Trophy } from "lucide-react"

interface StreakProgress {
  hasSetTarget: boolean
  targetOrderCount: number
  actualOrderCountThisMonth: number
  ordersRemaining: number
  currentStreak: number
  longestStreak: number
  nextMilestone: { monthsToGo: number; milestone: number; prize: number } | null
  floorOrderCount: number
}

export default function StreakWidget() {
  const [data, setData] = useState<StreakProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/vendor/streak/progress", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.hasSetTarget) setData(d)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) return null

  const pct = Math.min(100, Math.round((data.actualOrderCountThisMonth / data.targetOrderCount) * 100))
  const targetHit = data.ordersRemaining === 0

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-5 w-5 text-accent" />
          Monthly Streak
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Streak count */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{data.currentStreak}</p>
            <p className="text-xs text-muted-foreground">month{data.currentStreak !== 1 ? "s" : ""} streak</p>
          </div>
          {data.longestStreak > 0 && (
            <div className="text-right">
              <p className="text-sm font-medium">{data.longestStreak}</p>
              <p className="text-xs text-muted-foreground">best streak</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{data.actualOrderCountThisMonth} of {data.targetOrderCount} orders this month</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs mt-1.5">
            {targetHit ? (
              <span className="text-green-600 font-medium">Target hit ✓ Keep selling to strengthen your streak.</span>
            ) : (
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{data.ordersRemaining}</span> more order{data.ordersRemaining !== 1 ? "s" : ""} to hit your target this month
              </span>
            )}
          </p>
        </div>

        {/* Next milestone */}
        {data.nextMilestone && (
          <div className="flex items-center gap-2 rounded-lg bg-background border border-accent/20 px-3 py-2">
            <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {data.nextMilestone.monthsToGo} more month{data.nextMilestone.monthsToGo !== 1 ? "s" : ""}
              </span>
              {" "}= <span className="font-semibold text-foreground">
                ₦{data.nextMilestone.prize.toLocaleString("en-NG")} cash
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
