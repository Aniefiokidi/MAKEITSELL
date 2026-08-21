"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Header from "@/components/Header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, UserCheck, Eye, EyeOff } from "lucide-react"

export default function ClaimAccountPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [checking, setChecking] = useState(true)
  const [valid, setValid] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    if (!token) {
      setChecking(false)
      setMessage({ type: "error", text: "This link is missing a token." })
      return
    }

    fetch(`/api/auth/claim-account?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setValid(true)
          setMaskedPhone(data.maskedPhone || "")
          setName(data.name || "")
        } else {
          setMessage({ type: "error", text: data.error || "This link is invalid or has expired." })
        }
      })
      .catch(() => setMessage({ type: "error", text: "Couldn't check this link. Please try again." }))
      .finally(() => setChecking(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" })
      return
    }
    if (password.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch("/api/auth/claim-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password, name }),
      })
      const data = await response.json()

      if (data.success) {
        setDone(true)
        setMessage({ type: "success", text: "Your account is ready! Redirecting..." })
        // Full reload rather than router.push — the session cookie was just set by the
        // API response, and a fresh load is the simplest way to have every context
        // (AuthContext included) pick it up correctly.
        setTimeout(() => {
          window.location.href = "/"
        }, 1500)
      } else {
        setMessage({ type: "error", text: data.error || "Failed to set up account" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center bg-muted/30 px-4 py-12">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-4">
              <UserCheck className="w-8 h-8 text-accent" />
            </div>
            <CardTitle className="text-2xl font-bold">Set Up Your Account</CardTitle>
            <CardDescription className="text-center">
              {valid && maskedPhone
                ? `Finish setting up the account linked to ${maskedPhone} — log in on the website or app anytime after this.`
                : "Verifying your link..."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {message && (
              <Alert className={message.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                {message.type === "success" ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className={message.type === "success" ? "text-green-800" : "text-red-800"}>
                  <p>{message.text}</p>
                </AlertDescription>
              </Alert>
            )}

            {checking ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              </div>
            ) : valid && !done ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-12 pr-11"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-12 pr-11"
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-lg bg-accent text-white hover:bg-accent/90 transition-all"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Setting Up...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-5 h-5 mr-2" />
                      Set Up Account
                    </>
                  )}
                </Button>
              </form>
            ) : !valid && !checking ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Reply "claim account" to the Make It Sell WhatsApp number to get a fresh link.
                </p>
                <a href="/login" className="text-accent hover:underline font-semibold text-sm">
                  Already have an account? Sign in
                </a>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
