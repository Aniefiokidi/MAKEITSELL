"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

export default function UpgradeToVendor() {
  const { user, userProfile } = useAuth()
  const [vendorType, setVendorType] = useState<"goods" | "services" | "both">("both")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleUpgrade = async () => {
    if (!user) {
      setError("You must be logged in to upgrade")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch('/api/auth/update-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          role: 'vendor',
          vendorType
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(true)
        // Force a page reload to update the auth context
        setTimeout(() => {
          window.location.href = '/vendor/dashboard'
        }, 2000)
      } else {
        setError(result.error || 'Failed to upgrade account')
      }
    } catch (error: any) {
      setError('Network error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <p>Please log in to upgrade your account.</p>
        </CardContent>
      </Card>
    )
  }

  if (user.role === "vendor" || userProfile?.role === "vendor") {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <p className="text-green-600">You are already a vendor!</p>
          <Button className="mt-4" onClick={() => window.location.href = '/vendor/dashboard'}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (success) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-green-600 text-lg font-medium mb-2">Success!</div>
            <p className="text-sm text-muted-foreground mb-4">
              Your account has been upgraded to vendor status.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting to vendor dashboard...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>Upgrade to Vendor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">What will you sell?</label>
          <Select value={vendorType} onValueChange={(value: any) => setVendorType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="goods">Physical Products</SelectItem>
              <SelectItem value="services">Services</SelectItem>
              <SelectItem value="both">Both Products & Services</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">
          Current role: {user.role}
          <br />
          Email: {user.email}
        </div>

        <Button 
          onClick={handleUpgrade} 
          className="w-full" 
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Upgrade to Vendor
        </Button>
      </CardContent>
    </Card>
  )
}