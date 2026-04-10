"use client"

import { useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShieldCheck, RefreshCw, Search, CalendarClock, UserCog } from "lucide-react"

type AuditRow = {
  id: string
  action: string
  actorUserId: string
  actorEmail?: string
  targetUserId: string
  targetUserEmail?: string
  changes?: Record<string, any>
  metadata?: Record<string, any>
  createdAt: string
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [action, setAction] = useState("all")
  const [actor, setActor] = useState("")
  const [target, setTarget] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const fetchLogs = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams()
      params.set("limit", "200")
      if (action !== "all") params.set("action", action)
      if (actor.trim()) params.set("actor", actor.trim())
      if (target.trim()) params.set("target", target.trim())
      if (from) params.set("from", from)
      if (to) params.set("to", to)

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        credentials: "include",
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
    const roleChanges = logs.filter((log) => log.action === "admin_user_role_updated").length
    const uniqueActors = new Set(logs.map((log) => log.actorUserId)).size
    const uniqueTargets = new Set(logs.map((log) => log.targetUserId)).size

    return {
      total: logs.length,
      roleChanges,
      uniqueActors,
      uniqueTargets,
    }
  }, [logs])

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Admin Audit Logs</h1>
            <p className="text-muted-foreground text-sm lg:text-base">
              Track who changed user roles and vendor types, including before/after values.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Role/Type Updates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.roleChanges}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Unique Admin Actors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniqueActors}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Users Affected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniqueTargets}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
              <div className="lg:col-span-2">
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    <SelectItem value="admin_user_role_updated">User role/vendor type update</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input placeholder="Actor email" value={actor} onChange={(e) => setActor(e.target.value)} />
              </div>
              <div>
                <Input placeholder="Target email" value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
              <div>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => fetchLogs(true)} className="gap-2">
                <Search className="h-4 w-4" />
                Apply Filters
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAction("all")
                  setActor("")
                  setTarget("")
                  setFrom("")
                  setTo("")
                }}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Audit Events</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-muted-foreground">Loading audit logs...</div>
            ) : logs.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">No audit events found for current filters.</div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const roleFrom = log?.changes?.role?.from
                  const roleTo = log?.changes?.role?.to
                  const vendorTypeFrom = log?.changes?.vendorType?.from
                  const vendorTypeTo = log?.changes?.vendorType?.to

                  return (
                    <div key={log.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{log.action}</Badge>
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">ID: {log.id}</span>
                      </div>

                      <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-2 text-sm">
                        <div className="rounded-md bg-muted/40 p-2">
                          <p className="text-xs text-muted-foreground">Actor</p>
                          <p className="font-medium inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> {log.actorEmail || "Unknown"}</p>
                        </div>
                        <div className="rounded-md bg-muted/40 p-2">
                          <p className="text-xs text-muted-foreground">Target User</p>
                          <p className="font-medium inline-flex items-center gap-1"><UserCog className="h-3.5 w-3.5" /> {log.targetUserEmail || "Unknown"}</p>
                        </div>
                        <div className="rounded-md bg-muted/40 p-2">
                          <p className="text-xs text-muted-foreground">Request Meta</p>
                          <p className="font-medium text-xs">{String(log.metadata?.method || "")} {String(log.metadata?.route || "")}</p>
                        </div>
                      </div>

                      <div className="mt-2 text-sm">
                        <p>
                          <span className="text-muted-foreground">Role:</span>{" "}
                          <Badge variant="outline" className="mr-1">{roleFrom || "-"}</Badge>
                          <span className="text-muted-foreground">to</span>{" "}
                          <Badge>{roleTo || "-"}</Badge>
                        </p>
                        <p className="mt-1">
                          <span className="text-muted-foreground">Vendor Type:</span>{" "}
                          <Badge variant="outline" className="mr-1">{vendorTypeFrom || "-"}</Badge>
                          <span className="text-muted-foreground">to</span>{" "}
                          <Badge>{vendorTypeTo || "-"}</Badge>
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
