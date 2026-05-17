"use client"

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, ShoppingBag, Store } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function CompleteSetupPage() {
  const router = useRouter()
  const { user, userProfile } = useAuth()

  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Role picker — only shown when user has an orphaned store
  const [hasOrphanedStore, setHasOrphanedStore] = useState(false)
  const [chosenRole, setChosenRole] = useState<'vendor' | 'customer' | null>(null)

  // Pre-fill email from session if available
  useEffect(() => {
    if (user?.email && !email) setEmail(user.email)
  }, [user])

  // Check if this user has a store (orphaned store scenario)
  useEffect(() => {
    const uid = user?.uid
    if (!uid) return
    fetch(`/api/database/stores?vendorId=${encodeURIComponent(uid)}&limit=1`)
      .then(r => r.json())
      .then(data => {
        const stores = Array.isArray(data?.data) ? data.data : []
        if (stores.length > 0) {
          setHasOrphanedStore(true)
          // Default choice: vendor (they have a store)
          setChosenRole('vendor')
        }
      })
      .catch(() => {})
  }, [user])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email || !currentPassword || !newPassword || !confirmPassword) {
      setError('Please complete all fields.')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    if (hasOrphanedStore && !chosenRole) {
      setError('Please choose how you want to continue.')
      return
    }

    setLoading(true)
    try {
      const body: Record<string, any> = { email, currentPassword, newPassword }
      if (hasOrphanedStore && chosenRole) body.role = chosenRole

      const response = await fetch('/api/auth/complete-setup-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()
      if (!result.success) {
        setError(result.error || 'Failed to update password')
        return
      }

      setSuccess('Password updated. Redirecting...')
      const finalRole = result.role || chosenRole || userProfile?.role || 'customer'
      const logisticsRoutes: Record<string, string> = {
        'a&co@makeitselll.org': '/logistics',
        'orahlogistics@gmail.com': '/logistics/abuja',
      }
      const logisticsRoute = logisticsRoutes[email.toLowerCase()]
      setTimeout(() => {
        if (logisticsRoute) router.push(logisticsRoute)
        else if (finalRole === 'vendor') router.push('/vendor/dashboard')
        else if (finalRole === 'admin') router.push('/admin/dashboard')
        else if (finalRole === 'csa') router.push('/logistics')
        else router.push('/')
      }, 1000)
    } catch (err: any) {
      setError(err?.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Image
            src="https://res.cloudinary.com/dgqxt06km/image/upload/q_auto/f_auto/v1778221830/logo_2_ovdgjg.png"
            alt="Make It Sell"
            width={80}
            height={80}
            className="mx-auto mb-3 rounded-full object-contain"
            priority
          />
          <CardTitle>Set Your New Password</CardTitle>
          <CardDescription>
            A temporary password was set for your account. Enter it below along with a new password of your choice to secure your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentPassword">Temporary Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowCurrentPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowNewPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowConfirmPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Role picker — only shown when user has an orphaned store */}
            {hasOrphanedStore && (
              <div className="space-y-3 pt-2">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-800">We found a store linked to this account.</p>
                  <p className="text-xs text-amber-700 mt-1">Choose how you want to continue:</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setChosenRole('vendor')}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                      chosenRole === 'vendor'
                        ? 'border-accent bg-accent/5 text-accent'
                        : 'border-border hover:border-accent/50'
                    }`}
                  >
                    <Store className="h-6 w-6" />
                    <span className="text-sm font-semibold">Continue as Vendor</span>
                    <span className="text-xs text-muted-foreground text-center">Keep your store and manage products</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChosenRole('customer')}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                      chosenRole === 'customer'
                        ? 'border-accent bg-accent/5 text-accent'
                        : 'border-border hover:border-accent/50'
                    }`}
                  >
                    <ShoppingBag className="h-6 w-6" />
                    <span className="text-sm font-semibold">Continue as Customer</span>
                    <span className="text-xs text-muted-foreground text-center">Shop and browse the marketplace</span>
                  </button>
                </div>
              </div>
            )}

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? 'Updating Password...' : 'Update Password & Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
