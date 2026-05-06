"use client"

import { useState } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2, Copy, Search, UserPlus } from 'lucide-react'

type LookupResult = {
  found: boolean
  store?: {
    storeId: string
    storeName: string
    email: string
    phone: string
    vendorId: string
    category: string
  }
  userExists?: boolean
  error?: string
}

type RestoreResult = {
  success: boolean
  message?: string
  error?: string
  temporaryPassword?: string
  restoredUser?: {
    id: string
    email: string
    name: string
    role: string
  }
  storeLinked?: {
    storeId: string
    storeName: string
    vendorId: string
  }
}

export default function RestoreVendorPage() {
  const [query, setQuery] = useState('')
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const isVendorId = /^[a-f0-9]{24}$/i.test(query.trim())

  async function handleLookup() {
    const trimmed = query.trim()
    if (!trimmed) return

    setLookupLoading(true)
    setLookupResult(null)
    setRestoreResult(null)

    try {
      // We hit the restore endpoint in a "dry-run" sense by checking the store
      // directly via the vendors admin endpoint.
      const body = isVendorId ? { vendorId: trimmed } : { email: trimmed }
      const res = await fetch('/api/admin/lookup-orphaned-store', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setLookupResult(data)
    } catch (err: any) {
      setLookupResult({ found: false, error: err?.message || 'Request failed' })
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleRestore() {
    const trimmed = query.trim()
    if (!trimmed) return

    setRestoreLoading(true)
    setRestoreResult(null)

    try {
      const body = isVendorId ? { vendorId: trimmed } : { email: trimmed }
      const res = await fetch('/api/admin/restore-vendor-account', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setRestoreResult(data)
    } catch (err: any) {
      setRestoreResult({ success: false, error: err?.message || 'Request failed' })
    } finally {
      setRestoreLoading(false)
    }
  }

  function copyPassword() {
    if (!restoreResult?.temporaryPassword) return
    navigator.clipboard.writeText(restoreResult.temporaryPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canRestore =
    lookupResult?.found && !lookupResult.userExists && !restoreResult?.success

  return (
    <AdminLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Restore Deleted Vendor Account</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Rebuild a missing user document from an orphaned store so the vendor can log back in.
          </p>
        </div>

        {/* Step 1 — Find the store */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 1 — Find the orphaned store</CardTitle>
            <CardDescription>
              Enter the vendor&apos;s email address or their 24-character vendor ID.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="query">Email or Vendor ID</Label>
              <div className="flex gap-2">
                <Input
                  id="query"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setLookupResult(null)
                    setRestoreResult(null)
                  }}
                  placeholder="e.g. vendor@email.com or 69b873c6f2f6d91c92466c32"
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                />
                <Button onClick={handleLookup} disabled={!query.trim() || lookupLoading}>
                  <Search className="h-4 w-4 mr-2" />
                  {lookupLoading ? 'Looking up…' : 'Look up'}
                </Button>
              </div>
            </div>

            {lookupResult && (
              <>
                {lookupResult.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{lookupResult.error}</AlertDescription>
                  </Alert>
                )}

                {!lookupResult.found && !lookupResult.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>No store found for that email / vendor ID.</AlertDescription>
                  </Alert>
                )}

                {lookupResult.found && lookupResult.userExists && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      A user account already exists for this store — no restore needed.
                    </AlertDescription>
                  </Alert>
                )}

                {lookupResult.found && !lookupResult.userExists && lookupResult.store && (
                  <div className="rounded-lg border p-4 space-y-2 text-sm bg-muted/40">
                    <p className="font-medium text-base">{lookupResult.store.storeName}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                      <span>Email</span>
                      <span className="text-foreground">{lookupResult.store.email}</span>
                      <span>Phone</span>
                      <span className="text-foreground">{lookupResult.store.phone || '—'}</span>
                      <span>Category</span>
                      <span className="text-foreground capitalize">{lookupResult.store.category || '—'}</span>
                      <span>Vendor ID</span>
                      <span className="text-foreground font-mono text-xs">{lookupResult.store.vendorId}</span>
                    </div>
                    <Alert className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No user account found for this store. Proceed to Step 2 to restore it.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Step 2 — Restore */}
        {canRestore && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Step 2 — Restore the account</CardTitle>
              <CardDescription>
                This will recreate the user document with the original vendor ID, set a temporary password,
                and require the vendor to change it on first login.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  The vendor&apos;s store, products, and order history will remain untouched — only the
                  missing user account is recreated.
                </AlertDescription>
              </Alert>
              <Button onClick={handleRestore} disabled={restoreLoading}>
                <UserPlus className="h-4 w-4 mr-2" />
                {restoreLoading ? 'Restoring…' : 'Restore vendor account'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {restoreResult && (
          <Card className={restoreResult.success ? 'border-green-500' : 'border-destructive'}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {restoreResult.success ? (
                  <><CheckCircle2 className="h-5 w-5 text-green-500" /> Account Restored</>
                ) : (
                  <><AlertCircle className="h-5 w-5 text-destructive" /> Restore Failed</>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {restoreResult.error && (
                <Alert variant="destructive">
                  <AlertDescription>{restoreResult.error}</AlertDescription>
                </Alert>
              )}

              {restoreResult.success && restoreResult.restoredUser && (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                    <span>Name</span>
                    <span className="text-foreground">{restoreResult.restoredUser.name}</span>
                    <span>Email</span>
                    <span className="text-foreground">{restoreResult.restoredUser.email}</span>
                    <span>Role</span>
                    <span className="text-foreground capitalize">{restoreResult.restoredUser.role}</span>
                    <span>User ID</span>
                    <span className="text-foreground font-mono text-xs">{restoreResult.restoredUser.id}</span>
                  </div>

                  {restoreResult.temporaryPassword && (
                    <div className="rounded-lg border p-4 space-y-2 bg-muted/40">
                      <p className="font-medium">Temporary Password</p>
                      <p className="text-muted-foreground text-xs">
                        Share this with the vendor. They will be forced to set a new password immediately after logging in.
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="rounded bg-background border px-3 py-2 text-base font-mono tracking-widest select-all">
                          {restoreResult.temporaryPassword}
                        </code>
                        <Button size="sm" variant="outline" onClick={copyPassword}>
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                          {copied ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
