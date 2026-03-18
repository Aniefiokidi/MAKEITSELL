"use client"

import { useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Clock3, Database } from "lucide-react"

type PerfLog = {
  id: string
  route: string
  method: string
  statusCode: number
  durationMs: number
  cacheHit: boolean
  createdAt: string
}

export default function AdminPerformancePage() {
  const [logs, setLogs] = useState<PerfLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchLogs = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const response = await fetch('/api/admin/performance-logs?limit=200', {
        credentials: 'include',
      })
      const result = await response.json()
      if (result?.success && Array.isArray(result.data)) {
        setLogs(result.data)
      } else {
        setLogs([])
      }
    } catch {
      setLogs([])
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const stats = useMemo(() => {
    if (!logs.length) {
      return {
        total: 0,
        avgDuration: 0,
        p95Duration: 0,
        cacheHitRate: 0,
      }
    }

    const durations = logs.map((l) => l.durationMs).sort((a, b) => a - b)
    const totalDuration = durations.reduce((acc, val) => acc + val, 0)
    const p95Index = Math.min(durations.length - 1, Math.floor(durations.length * 0.95))
    const cacheHits = logs.filter((l) => l.cacheHit).length

    return {
      total: logs.length,
      avgDuration: Math.round(totalDuration / logs.length),
      p95Duration: durations[p95Index],
      cacheHitRate: Math.round((cacheHits / logs.length) * 100),
    }
  }, [logs])

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Performance Logs</h1>
            <p className="text-muted-foreground text-sm lg:text-base">
              API latency, cache hit rate, and request status tracking.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Requests Logged</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgDuration}ms</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">P95 Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.p95Duration}ms</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.cacheHitRate}%</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent API Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-muted-foreground">Loading performance logs...</div>
            ) : logs.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">No performance logs recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Route</th>
                      <th className="py-2 pr-3">Method</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Duration</th>
                      <th className="py-2 pr-3">Cache</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {log.route}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline">{log.method}</Badge>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant={log.statusCode >= 400 ? "destructive" : "secondary"}>
                            {log.statusCode}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {log.durationMs}ms
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant={log.cacheHit ? "secondary" : "outline"}>
                            {log.cacheHit ? "HIT" : "MISS"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
