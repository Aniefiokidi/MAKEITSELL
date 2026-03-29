"use client"

import { useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [allowlistText, setAllowlistText] = useState("")
  const [testEmail, setTestEmail] = useState("arnoldeee123@gmail.com")
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true)
      setFeedback(null)
      try {
        const response = await fetch('/api/admin/phone-verification-settings', {
          method: 'GET',
          credentials: 'include',
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || 'Failed to load settings')
        }

        const allowedEmails = Array.isArray(result?.settings?.allowedEmails) ? result.settings.allowedEmails : []
        setEnabled(!!result?.settings?.enabled)
        setAllowlistText(allowedEmails.join('\n'))
        setTestEmail(String(result?.testEmail || testEmail))
      } catch (error: any) {
        setFeedback({ type: 'error', message: error?.message || 'Failed to load settings' })
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const parsedEmails = useMemo(() => {
    return Array.from(
      new Set(
        allowlistText
          .split(/[\n,]/)
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      )
    )
  }, [allowlistText])

  const saveSettings = async () => {
    setSaving(true)
    setFeedback(null)

    try {
      const response = await fetch('/api/admin/phone-verification-settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          allowedEmails: parsedEmails,
        }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to save settings')
      }

      setFeedback({ type: 'success', message: 'Phone verification settings saved.' })
    } catch (error: any) {
      setFeedback({ type: 'error', message: error?.message || 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm lg:text-base">Configure admin preferences and controls.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Phone Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading settings...
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Enable Additional Users</Label>
                    <p className="text-xs text-muted-foreground">
                      Keep this on to allow users in your list below to receive phone OTP verification.
                    </p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone-allowlist">Allowed Emails (one per line)</Label>
                  <Textarea
                    id="phone-allowlist"
                    value={allowlistText}
                    onChange={(event) => setAllowlistText(event.target.value)}
                    rows={6}
                    placeholder="user1@example.com\nuser2@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Always enabled test user: <span className="font-medium text-foreground">{testEmail}</span>
                  </p>
                </div>

                {feedback && (
                  <Alert className={feedback.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    <AlertDescription className={feedback.type === 'success' ? 'text-green-700' : 'text-red-700'}>
                      {feedback.message}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center gap-3">
                  <Button onClick={saveSettings} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                  <p className="text-xs text-muted-foreground">{parsedEmails.length} additional email(s) configured</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
