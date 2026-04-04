"use client"

import { useState } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

type RecoveryResult = {
  success: boolean
  action?: string
  totalMatching?: number
  processed?: number
  prepared?: number
  smsRequested?: boolean
  smsSent?: number
  smsFailed?: number
  hasMore?: boolean
  nextSkip?: number
  note?: string
  message?: string
  error?: string
  sample?: Array<{
    id: string
    email: string
    name: string
    phone: string | null
    hasValidPhone: boolean
    isEmailVerified: boolean
    mustChangePassword: boolean
  }>
}

export default function AdminUnverifiedRecoveryPage() {
  const [adminKey, setAdminKey] = useState('')
  const [emailFilter, setEmailFilter] = useState('')
  const [limit, setLimit] = useState(50)
  const [skip, setSkip] = useState(0)
  const [includeAlreadyPrepared, setIncludeAlreadyPrepared] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RecoveryResult | null>(null)

  const makeHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (adminKey.trim()) {
      headers.Authorization = `Bearer ${adminKey.trim()}`
    }
    return headers
  }

  const callApi = async (action: 'preview' | 'prepare', sendSms: boolean) => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/unverified-account-recovery', {
        method: 'POST',
        credentials: 'include',
        headers: makeHeaders(),
        body: JSON.stringify({
          action,
          sendSms,
          emailFilter: emailFilter.trim() || undefined,
          limit,
          skip,
          includeAlreadyPrepared,
        }),
      })

      const data = await response.json()
      setResult(data)

      if (data.success && typeof data.nextSkip === 'number') {
        setSkip(data.nextSkip)
      }
    } catch (error: any) {
      setResult({ success: false, error: error?.message || 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Unverified Users Recovery (SMS + Temporary Password)</CardTitle>
            <CardDescription>
              Prepare unverified users with a temporary password and forced password change. SMS sending is optional and can be blocked until deployment is complete.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminKey">Admin Bearer Key (optional)</Label>
              <Input id="adminKey" type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="emailFilter">Email Filter</Label>
                <Input id="emailFilter" value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} placeholder="optional filter" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limit">Batch Limit</Label>
                <Input id="limit" type="number" min={1} max={300} value={limit} onChange={(e) => setLimit(Number(e.target.value || 50))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skip">Skip</Label>
                <Input id="skip" type="number" min={0} value={skip} onChange={(e) => setSkip(Number(e.target.value || 0))} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeAlreadyPrepared}
                onChange={(e) => setIncludeAlreadyPrepared(e.target.checked)}
              />
              Include users already prepared before
            </label>

            <Alert>
              <AlertDescription>
                Safe flow: run Preview, then Prepare Without SMS. After push and Vercel deploy, set ALLOW_UNVERIFIED_RECOVERY_SMS_SEND=true and use Prepare + Send SMS.
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-3">
              <Button disabled={loading} onClick={() => callApi('preview', false)}>Preview</Button>
              <Button disabled={loading} variant="secondary" onClick={() => callApi('prepare', false)}>
                Prepare Without SMS
              </Button>
              <Button disabled={loading} variant="destructive" onClick={() => callApi('prepare', true)}>
                Prepare + Send SMS
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Run Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>Success: {String(result.success)}</div>
              {result.error && <div>Error: {result.error}</div>}
              {typeof result.totalMatching === 'number' && <div>Total matching: {result.totalMatching}</div>}
              {typeof result.processed === 'number' && <div>Processed: {result.processed}</div>}
              {typeof result.prepared === 'number' && <div>Prepared: {result.prepared}</div>}
              {typeof result.smsSent === 'number' && <div>SMS sent: {result.smsSent}</div>}
              {typeof result.smsFailed === 'number' && <div>SMS failed: {result.smsFailed}</div>}
              {result.message && <div>Message: {result.message}</div>}
              {result.note && <div>Note: {result.note}</div>}
              {result.sample && result.sample.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="font-medium">Preview sample</div>
                  {result.sample.slice(0, 10).map((item) => (
                    <div key={item.id}>
                      {item.email} | phone: {item.phone || 'N/A'} | valid phone: {String(item.hasValidPhone)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
