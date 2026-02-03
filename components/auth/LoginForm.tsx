"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/AuthContext"
import { Eye, EyeOff, Loader2 } from "lucide-react"

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth() // Add auth context hook
  
  const verified = searchParams.get("verified")
  const showVerifiedMessage = verified === "true"
  const isEmailVerificationError = error.includes("verify your email")
  const isLegacyUserError = error === "EMAIL_NOT_VERIFIED_LEGACY"

  const resendVerificationEmail = async () => {
    if (!email) {
      alert("Please enter your email address first")
      return
    }

    setResendLoading(true)
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      })
      const result = await response.json()

      if (result.success) {
        alert("Verification email sent! Please check your inbox.")
      } else {
        alert(result.error || "Failed to send verification email")
      }
    } catch (error) {
      alert("An error occurred while sending the email")
    } finally {
      setResendLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    console.log('Login attempt:', { email })

    try {
      const result = await login(email, password) // Use AuthContext login instead

      console.log('Login successful:', result)

      const redirectTo = searchParams.get("redirect")

      if (redirectTo) {
        router.push(redirectTo)
      } else {
        // Default redirects based on user role
        if (result.userProfile?.role === "vendor") {
          router.push("/vendor/dashboard")
        } else if (result.userProfile?.role === "admin") {
          router.push("/admin/dashboard")
        } else {
          // Customers go to shop page
          router.push("/stores")
        }
      }
    } catch (error: any) {
      console.error('Login error:', error)
      
      // Handle legacy users automatically
      if (error.message === 'EMAIL_NOT_VERIFIED_LEGACY') {
        console.log('Legacy user detected, sending verification email...')
        try {
          const response = await fetch("/api/auth/verify-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
          })
          const result = await response.json()
          
          if (result.success) {
            setError(`We've sent a verification email to ${email}. Please check your inbox and click the verification link to complete your account setup.`)
          } else {
            setError('Your account needs email verification. Please contact support for assistance.')
          }
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError)
          setError('Your account needs email verification. Please contact support for assistance.')
        }
      } else {
        setError(error.message || "Failed to sign in. Please check your credentials.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto animate-scale-in">
      <CardHeader className="text-center animate-fade-in">
        <CardTitle className="text-2xl font-bold" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>Welcome Back</CardTitle>
        <CardDescription>Sign in to your Make It Sell account</CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {showVerifiedMessage && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                ✅ Email verified successfully! You can now sign in to your account.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant={isLegacyUserError ? "default" : "destructive"} className={isLegacyUserError ? "border-blue-200 bg-blue-50" : ""}>
              <AlertDescription className={isLegacyUserError ? "text-blue-800" : ""}>
                {isLegacyUserError ? (
                  <>
                    <div className="font-semibold mb-2">📧 Email Verification Required</div>
                    <div>{error}</div>
                  </>
                ) : error}
                {(isEmailVerificationError && !isLegacyUserError) && (
                  <div className="mt-2">
                    <Button
                      onClick={resendVerificationEmail}
                      disabled={resendLoading}
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                    >
                      {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {resendLoading ? "Sending..." : "Resend Verification Email"}
                    </Button>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
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

          <div className="flex items-center justify-between">
            <Link href="/forgot-password" className="text-sm text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-accent hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
