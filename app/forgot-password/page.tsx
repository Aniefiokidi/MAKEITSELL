"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, Mail, Lock } from "lucide-react"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<"email" | "reset">("email")
  const [email, setEmail] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Check URL params for token and email (from email link)
  useEffect(() => {
    const token = searchParams.get('token')
    const emailParam = searchParams.get('email')
    
    console.log('[forgot-password] URL params:', { token: token?.substring(0, 20) + '...', email: emailParam, tokenLength: token?.length })
    
    if (token && emailParam) {
      setResetToken(token.trim())
      setEmail(decodeURIComponent(emailParam).trim())
      setStep('reset')
      setMessage({
        type: 'success',
        text: `✅ Password reset link loaded! Token length: ${token.length} characters. Enter your new password below.`
      })
    }
  }, [searchParams])

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
            ? `✅ Password reset email sent to ${email}! Check your inbox (and spam folder).`
            : "✅ Password reset email sent! Check your inbox and spam folder.",
        })
        if (data.token) {
          // Auto-fill the token and switch to reset step in dev mode
          setResetToken(data.token)
          setTimeout(() => setStep("reset"), 3000)
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
        // Check if it's an expired token error
        const isExpiredToken = data.error?.toLowerCase().includes('expired')
        const errorMessage = isExpiredToken 
          ? "⏰ This reset link has expired (links expire after 30 minutes). Please request a new password reset link below."
          : data.error || "Failed to reset password"
        
        setMessage({ type: "error", text: errorMessage })
        
        // If token expired, switch back to email step after a short delay
        if (isExpiredToken) {
          setTimeout(() => {
            setStep("email")
            setResetToken("")
            setMessage({ type: "error", text: "Your previous reset link expired. Enter your email below to get a new one." })
          }, 3000)
        }
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
              {step === "email" ? (
                <Mail className="w-8 h-8 text-accent" />
              ) : (
                <Lock className="w-8 h-8 text-accent" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription className="text-center">
              {step === "email" 
                ? "Enter your email address and we'll send you a secure link to reset your password (expires in 30 minutes)" 
                : "Enter your new password below"}
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
                  <div className="flex-1">
                    <AlertDescription className={message.type === "success" ? "text-green-800" : "text-red-800"}>
                      {message.text}
                    </AlertDescription>
                    {/* Show token info separately in development mode */}
                    {message.type === "success" && resetToken && process.env.NODE_ENV === "development" && (
                      <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                        <p className="font-medium mb-1">🛠️ Development Mode</p>
                        <p>Token auto-filled below. Switching to reset form in 3 seconds...</p>
                      </div>
                    )}
                  </div>
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
                    className="h-12"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-lg hover:bg-accent/80 hover:scale-105 transition-all"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Sending Reset Link...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 mr-2" />
                      Send Reset Link
                    </>
                  )}
                </Button>

                <div className="text-center pt-4 border-t">
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
                {/* Always show token input field for development and if user doesn't have email link */}
                {(process.env.NODE_ENV === "development" || !searchParams.get('token')) && (
                  <div className="space-y-2">
                    <Label htmlFor="token">Reset Token</Label>
                    <Input
                      id="token"
                      placeholder="Enter the token from your email or the confirmation message"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      required
                      disabled={loading}
                      className="h-12 font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Check your email for the reset token or click the link in the email instead.
                    </p>
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
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm New Password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-lg hover:bg-accent/80 hover:scale-105 transition-all"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Resetting Password...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5 mr-2" />
                      Reset Password
                    </>
                  )}
                </Button>

                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12"
                    onClick={() => {
                      setStep("email")
                      setResetToken("")
                      setNewPassword("")
                      setConfirmPassword("")
                      setMessage({ type: "error", text: "Requesting a new reset link. Enter your email below." })
                      // Clear URL params
                      router.replace('/forgot-password')
                    }}
                    disabled={loading}
                  >
                    ← Request New Link
                  </Button>
                </div>
              </form>
            )}

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center mb-4">
                📝 <strong>Instructions:</strong> Enter your email above and check both your inbox and spam folder for the reset link. 
                The link will take you directly to the password reset form.
              </p>
              
              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  Need help? Contact{" "}
                  <a href="mailto:support@makeitsell.com" className="text-accent hover:underline font-semibold">
                    support@makeitsell.com
                  </a>
                </p>
                
                <div className="flex justify-center space-x-4 text-xs">
                  <a href="/" className="text-muted-foreground hover:text-accent flex items-center">
                    ← Home
                  </a>
                  <span className="text-muted-foreground">•</span>
                  <a href="/signup" className="text-muted-foreground hover:text-accent">
                    Create Account
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  )
}
