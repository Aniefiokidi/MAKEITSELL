"use client"

import { useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Mail, Send, Search, AlertTriangle } from "lucide-react"

type PreviewResponse = {
  success: boolean
  totalMatching: number
  selected: number
  skip: number
  limit: number
  hasMore: boolean
  sample?: Array<{
    id: string
    email: string
    name: string
    role: string
    isEmailVerified: boolean
  }>
  error?: string
}

type SendResponse = {
  success: boolean
  processed: number
  sent: number
  failed: number
  totalMatching: number
  skip: number
  limit: number
  hasMore: boolean
  nextSkip: number
  failedEmails?: string[]
  error?: string
}

export default function AdminBroadcastEmailPage() {
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingSend, setLoadingSend] = useState(false)

  const [adminKey, setAdminKey] = useState("")
  const [emailFilter, setEmailFilter] = useState("")
  const [limit, setLimit] = useState(200)
  const [skip, setSkip] = useState(0)
  const [delayMs, setDelayMs] = useState(350)
  const [onlyUnverified, setOnlyUnverified] = useState(false)
  const [includeAdmins, setIncludeAdmins] = useState(false)

  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [result, setResult] = useState<SendResponse | null>(null)

  const makeHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (adminKey.trim()) {
      headers.Authorization = `Bearer ${adminKey.trim()}`
    }

    return headers
  }

  const buildPayload = () => ({
    emailFilter: emailFilter.trim() || undefined,
    limit,
    skip,
    delayMs,
    onlyUnverified,
    includeAdmins,
  })

  const runPreview = async () => {
    setLoadingPreview(true)
    setResult(null)

    try {
      const response = await fetch("/api/admin/broadcast-email", {
        method: "POST",
        credentials: "include",
        headers: makeHeaders(),
        body: JSON.stringify({
          action: "preview",
          ...buildPayload(),
        }),
      })

      const data = await response.json()
      setPreview(data)

      if (!data.success) {
        alert(data.error || "Failed to preview recipients")
      }
    } catch (error) {
      console.error("[admin/broadcast-email] Preview error:", error)
      alert("Failed to preview recipients")
    } finally {
      setLoadingPreview(false)
    }
  }

  const runSend = async () => {
    if (!confirm("Send registration-issue announcement to this batch now?")) {
      return
    }

    setLoadingSend(true)

    try {
      const response = await fetch("/api/admin/broadcast-email", {
        method: "POST",
        credentials: "include",
        headers: makeHeaders(),
        body: JSON.stringify({
          action: "send",
          ...buildPayload(),
        }),
      })

      const data = await response.json()
      setResult(data)

      if (!data.success) {
        alert(data.error || "Broadcast failed")
        return
      }

      if (typeof data.nextSkip === "number") {
        setSkip(data.nextSkip)
      }
    } catch (error) {
      console.error("[admin/broadcast-email] Send error:", error)
      alert("Broadcast failed")
    } finally {
      setLoadingSend(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Broadcast Email</h1>
          <p className="text-muted-foreground text-sm lg:text-base">
            Send a platform-wide announcement about the registration link issue in controlled batches.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Broadcast Settings
            </CardTitle>
            <CardDescription>
              Use preview first, then send in batches to avoid SMTP throttling.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admin-key">Admin Key (Optional)</Label>
                <Input
                  id="admin-key"
                  type="password"
                  placeholder="Use if not logged in as admin"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-filter">Email Filter (Optional)</Label>
                <Input
                  id="email-filter"
                  placeholder="e.g. @icloud.com"
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="limit">Batch Size</Label>
                <Input
                  id="limit"
                  type="number"
                  min={1}
                  max={1000}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value || 200))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="skip">Skip</Label>
                <Input
                  id="skip"
                  type="number"
                  min={0}
                  value={skip}
                  onChange={(e) => setSkip(Number(e.target.value || 0))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delay">Delay (ms)</Label>
                <Input
                  id="delay"
                  type="number"
                  min={0}
                  max={2000}
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value || 350))}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyUnverified}
                  onChange={(e) => setOnlyUnverified(e.target.checked)}
                />
                Only unverified users
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeAdmins}
                  onChange={(e) => setIncludeAdmins(e.target.checked)}
                />
                Include admins
              </label>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={runPreview} disabled={loadingPreview || loadingSend}>
                {loadingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Preview Recipients
              </Button>
              <Button onClick={runSend} disabled={loadingSend || loadingPreview} className="bg-orange-600 hover:bg-orange-700">
                {loadingSend ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send This Batch
              </Button>
            </div>
          </CardContent>
        </Card>

        {preview && (
          <Card>
            <CardHeader>
              <CardTitle>Preview Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">Total matching: {preview.totalMatching}</Badge>
                <Badge variant="outline">Selected batch: {preview.selected}</Badge>
                <Badge variant="outline">Skip: {preview.skip}</Badge>
                <Badge variant="outline">Limit: {preview.limit}</Badge>
                <Badge variant="outline">Has more: {preview.hasMore ? "Yes" : "No"}</Badge>
              </div>

              <div className="space-y-2">
                {(preview.sample || []).map((u) => (
                  <div key={u.id} className="text-sm border rounded-md p-2 flex flex-wrap gap-2 items-center">
                    <Badge variant="outline">{u.email}</Badge>
                    <span>{u.name}</span>
                    <span className="text-muted-foreground">role: {u.role}</span>
                    <span className="text-muted-foreground">verified: {u.isEmailVerified ? "yes" : "no"}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Alert className={result.failed > 0 ? "border-yellow-300 bg-yellow-50" : "border-green-300 bg-green-50"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-2">Batch Completed</div>
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="outline">Processed: {result.processed}</Badge>
                <Badge variant="outline">Sent: {result.sent}</Badge>
                <Badge variant="outline">Failed: {result.failed}</Badge>
                <Badge variant="outline">Next skip: {result.nextSkip}</Badge>
                <Badge variant="outline">Has more: {result.hasMore ? "Yes" : "No"}</Badge>
              </div>
              {!!result.failedEmails?.length && (
                <div className="text-sm">Failed samples: {result.failedEmails.slice(0, 10).join(", ")}</div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AdminLayout>
  )
}
