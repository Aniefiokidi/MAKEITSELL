"use client"

import { useState } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2, FlaskConical, Mail, Send, Truck } from 'lucide-react'

type SendResult = {
  type: string
  email: string
  sent: boolean
  error?: string
}

type ApiResult = {
  success: boolean
  testOnly?: boolean
  sent?: number
  failed?: number
  results?: SendResult[]
  error?: string
}

export default function CampaignEmailPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiResult | null>(null)

  async function send(action: 'vendor' | 'logistics' | 'both', testOnly: boolean) {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/campaign-email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, testOnly }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setResult({ success: false, error: err?.message || 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campaign Email</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Send the test-phase announcement to vendors and/or logistics partners. Always send a test first.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-yellow-600" />
              Step 1 — Send Test Emails
            </CardTitle>
            <CardDescription>
              Both test emails go to <strong>arnoldeee123@gmail.com</strong>. Review them before sending live.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" disabled={loading} onClick={() => send('vendor', true)}>
              <Mail className="h-4 w-4 mr-2" />
              Test Vendor Email
            </Button>
            <Button variant="outline" disabled={loading} onClick={() => send('logistics', true)}>
              <Truck className="h-4 w-4 mr-2" />
              Test Logistics Email
            </Button>
            <Button variant="outline" disabled={loading} onClick={() => send('both', true)}>
              <Send className="h-4 w-4 mr-2" />
              Test Both
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4 text-destructive" />
              Step 2 — Send Live Campaign
            </CardTitle>
            <CardDescription>
              Vendor email goes to all vendors with stores. Logistics email goes to A&CO and Orah.
              <span className="block mt-1 text-destructive font-medium">Only do this after confirming the test emails look correct.</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button disabled={loading} onClick={() => send('vendor', false)}>
              <Mail className="h-4 w-4 mr-2" />
              {loading ? 'Sending…' : 'Send to All Vendors'}
            </Button>
            <Button disabled={loading} onClick={() => send('logistics', false)}>
              <Truck className="h-4 w-4 mr-2" />
              {loading ? 'Sending…' : 'Send to Logistics Partners'}
            </Button>
            <Button disabled={loading} onClick={() => send('both', false)}>
              <Send className="h-4 w-4 mr-2" />
              {loading ? 'Sending…' : 'Send Both'}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className={result.success ? '' : 'border-destructive'}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {result.success ? (
                  <><CheckCircle2 className="h-5 w-5 text-green-500" /> Done</>
                ) : (
                  <><AlertCircle className="h-5 w-5 text-destructive" /> Error</>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {result.error && (
                <Alert variant="destructive">
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              )}

              {result.success && (
                <p className="text-muted-foreground">
                  {result.testOnly ? 'Test send complete. ' : ''}
                  Sent: <strong className="text-green-600">{result.sent}</strong> &nbsp;|&nbsp;
                  Failed: <strong className={result.failed ? 'text-destructive' : ''}>{result.failed}</strong>
                </p>
              )}

              {result.results && result.results.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2">Type</th>
                        <th className="text-left px-3 py-2">Email</th>
                        <th className="text-left px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 text-muted-foreground capitalize">{r.type}</td>
                          <td className="px-3 py-2">{r.email}</td>
                          <td className="px-3 py-2">
                            {r.sent ? (
                              <span className="text-green-600 font-medium">Sent</span>
                            ) : (
                              <span className="text-destructive">{r.error || 'Failed'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
