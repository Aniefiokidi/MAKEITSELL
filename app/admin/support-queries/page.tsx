"use client"

import { useEffect, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, MessageCircleQuestion } from "lucide-react"

type UnmatchedRow = {
  normalizedQuery: string
  count: number
  lastQuery: string
  lastLang: string
  lastSeenAt: string
}

type TopMatchedRow = {
  entryId: string
  count: number
}

export default function AdminSupportQueriesPage() {
  const [unmatched, setUnmatched] = useState<UnmatchedRow[]>([])
  const [topMatched, setTopMatched] = useState<TopMatchedRow[]>([])
  const [totals, setTotals] = useState({ total: 0, unmatchedTotal: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const response = await fetch("/api/admin/support-queries?limit=100", { credentials: "include" })
      const result = await response.json()
      if (result?.success) {
        setUnmatched(Array.isArray(result.unmatched) ? result.unmatched : [])
        setTopMatched(Array.isArray(result.topMatched) ? result.topMatched : [])
        setTotals(result.totals || { total: 0, unmatchedTotal: 0 })
      }
    } catch {
      setUnmatched([])
      setTopMatched([])
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Support Bot — Query Gaps</h1>
            <p className="text-muted-foreground text-sm lg:text-base">
              Real questions the FAQ bot couldn't answer, grouped by how often they come up — use this to decide what to add next.
            </p>
          </div>
          <Button variant="outline" onClick={() => fetchData(true)} disabled={refreshing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Questions Asked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Fell Through to Fallback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.unmatchedTotal}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Answer Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totals.total > 0 ? Math.round(((totals.total - totals.unmatchedTotal) / totals.total) * 100) : 100}%
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircleQuestion className="h-5 w-5" /> Unanswered Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : unmatched.length === 0 ? (
              <p className="text-sm text-muted-foreground">No gaps logged yet — every question so far has matched an FAQ entry.</p>
            ) : (
              unmatched.map((row) => (
                <div key={row.normalizedQuery} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{row.lastQuery}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Last asked {new Date(row.lastSeenAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">{row.lastLang === "pcm" ? "Pidgin" : "English"}</Badge>
                    <Badge>{row.count}x</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Most-Asked Topics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topMatched.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matched questions logged yet.</p>
            ) : (
              topMatched.map((row) => (
                <div key={row.entryId} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">{row.entryId}</span>
                  <Badge>{row.count}x</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
