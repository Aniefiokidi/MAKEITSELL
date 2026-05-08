"use client"

import { useState } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2, Copy, Mail, Search } from 'lucide-react'

type UserResult = {
  id: string
  email: string
  name: string
  role: string
  temporaryPassword: string
  emailSent: boolean
  emailError: string | null
}

type ApiResult = {
  success: boolean
  found?: number
  results?: UserResult[]
  message?: string
  error?: string
}

export default function SetTempPasswordPage() {
  const [query, setQuery] = useState('')
  const [createName, setCreateName] = useState('')
  const [createRole, setCreateRole] = useState('vendor')
  const [sendEmail, setSendEmail] = useState(true)
  const [forceCreate, setForceCreate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiResult | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/set-temp-passwords', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), sendEmail, forceCreate, createName: createName.trim(), createRole }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setResult({ success: false, error: err?.message || 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Set Temporary Password</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Find a user by name or email, set a temporary password, and notify them to log in and change it.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Find User</CardTitle>
            <CardDescription>
              Search by full name, partial name, or email. Multiple matches will all be updated — review results before confirming if unsure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="query">Name or Email</Label>
                <div className="flex gap-2">
                  <Input
                    id="query"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setResult(null) }}
                    placeholder="e.g. nnaji  or  seun ogunwemimo  or  user@email.com"
                  />
                  <Button type="submit" disabled={!query.trim() || loading}>
                    <Search className="h-4 w-4 mr-2" />
                    {loading ? 'Working…' : 'Set & Send'}
                  </Button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="rounded"
                />
                Send notification email to user(s)
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forceCreate}
                  onChange={(e) => setForceCreate(e.target.checked)}
                  className="rounded"
                />
                Create account if not found (enter email address above)
              </label>

              {forceCreate && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="createName">Display name for new account (optional)</Label>
                    <Input
                      id="createName"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="e.g. Orah Logistics"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="createRole">Account role</Label>
                    <select
                      id="createRole"
                      value={createRole}
                      onChange={(e) => setCreateRole(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="vendor">Vendor</option>
                      <option value="customer">Customer</option>
                      <option value="csa">Logistics / CSA</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              )}
            </form>
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
            <CardContent className="space-y-4 text-sm">
              {result.error && (
                <Alert variant="destructive">
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              )}

              {result.success && result.found === 0 && (
                <Alert>
                  <AlertDescription>No users found matching &quot;{query}&quot;. Try a different name or email.</AlertDescription>
                </Alert>
              )}

              {result.results && result.results.length > 0 && (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    {result.results.length} user{result.results.length > 1 ? 's' : ''} updated.
                  </p>

                  {result.results.map((user) => (
                    <div key={user.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{user.name || '(no name)'}</p>
                          <p className="text-muted-foreground text-xs">{user.email}</p>
                          <p className="text-muted-foreground text-xs capitalize">{user.role}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Mail className={`h-4 w-4 ${user.emailSent ? 'text-green-500' : 'text-muted-foreground'}`} />
                          <span className={`text-xs ${user.emailSent ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {user.emailSent ? 'Email sent' : 'Email not sent'}
                          </span>
                        </div>
                      </div>

                      {user.emailError && (
                        <p className="text-destructive text-xs">Email error: {user.emailError}</p>
                      )}

                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm tracking-widest select-all">
                          {user.temporaryPassword}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copy(user.temporaryPassword, user.id)}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                          {copiedId === user.id ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>

                      <p className="text-muted-foreground text-xs">
                        Share this password with the user. They will be required to set a new password on their first login.
                      </p>
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
