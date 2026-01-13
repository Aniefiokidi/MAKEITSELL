"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle } from "lucide-react"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<"email" | "reset">("email")
  const [email, setEmail] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({
          type: "success",
          text: data.token
            ? `Reset token: ${data.token} (Save this for the next step)`
            : "Check your email for password reset instructions",
        })
        if (data.token) {
          setTimeout(() => setStep("reset"), 2000)
        }
      } else {
        setMessage({ type: "error", text: data.error || "Failed to send reset email" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" })
      return
    }

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          resetToken,
          newPassword,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: "success", text: "Password reset successfully! Redirecting to login..." })
        setTimeout(() => router.push("/login"), 2000)
      } else {
        setMessage({ type: "error", text: data.error || "Failed to reset password" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>
              {step === "email" ? "Enter your email to receive reset instructions" : "Enter your new password"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {message && (
              <Alert className={message.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                <div className="flex gap-2">
                  {message.type === "success" ? (
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  )}
                  <AlertDescription className={message.type === "success" ? "text-green-800" : "text-red-800"}>
                    {message.text}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {step === "email" ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
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
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full hover:bg-accent/80 hover:scale-105 transition-all"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Remember your password?{" "}
                    <a href="/login" className="text-accent hover:underline font-semibold">
                      Sign In
                    </a>
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {/* Development: Show token input field */}
                {process.env.NODE_ENV === "development" && (
                  <div className="space-y-2">
                    <Label htmlFor="token">Reset Token</Label>
                    <Input
                      id="token"
                      placeholder="Paste the token from the confirmation message"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full hover:bg-accent/80 hover:scale-105 transition-all"
                  disabled={loading}
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setStep("email")
                    setResetToken("")
                    setNewPassword("")
                    setConfirmPassword("")
                    setMessage(null)
                  }}
                  disabled={loading}
                >
                  Back
                </Button>
              </form>
            )}

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center">
                Need help? Contact{" "}
                <a href="/support" className="text-accent hover:underline">
                  support
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  )
}
