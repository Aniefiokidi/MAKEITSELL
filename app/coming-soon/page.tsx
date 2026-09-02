"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Loader2, Lock } from "lucide-react"

export default function ComingSoonPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/site-lock/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const result = await response.json()

      if (result.success) {
        const redirectTo = searchParams.get("redirect") || "/"
        router.push(redirectTo)
        router.refresh()
      } else {
        setError(result.error || "Incorrect password.")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent to-[oklch(0.16_0.06_15)] px-4 py-12 relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-white/5 blur-3xl"
      />

      <div className="relative w-full max-w-md space-y-8 text-center">
        <div className="space-y-4">
          <span className="inline-block text-2xl font-black italic tracking-tight text-white">
            MAKEITSELL
          </span>
          <h1 className="text-3xl font-bold text-white text-balance">Something great is on the way</h1>
          <p className="text-white/80 leading-relaxed">
            We're putting the finishing touches on Make It Sell. Check back soon.
          </p>
        </div>

        <Image
          src="/images/cart-mascot-icon.png"
          alt=""
          width={160}
          height={110}
          className="mx-auto opacity-90"
        />

        <Card className="text-left animate-scale-in">
          <CardHeader className="space-y-1.5">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Admin access
            </CardTitle>
            <CardDescription>Enter the password to preview the site.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="site-lock-password">Password</Label>
                <div className="relative">
                  <Input
                    id="site-lock-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full bg-accent text-white hover:bg-accent/90" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enter site
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  )
}
