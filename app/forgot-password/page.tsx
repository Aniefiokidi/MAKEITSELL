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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { AlertCircle, CheckCircle, Mail, Lock } from "lucide-react"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<"email" | "reset">("email")
  const [email, setEmail] = useState("")
  const [resetCode, setResetCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Preserve legacy support if a token exists in URL while moving users to OTP flow.
  useEffect(() => {
    const token = searchParams.get('token')
    const emailParam = searchParams.get('email')

    if (emailParam) {
      setEmail(decodeURIComponent(emailParam).trim())
    }

    if (token && emailParam) {
      setResetCode(token.trim().replace(/\D/g, '').slice(0, 6))
      setStep('reset')
      setMessage({
        type: 'success',
        text: 'Password reset code loaded. Enter your new password below.'
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
          text: data.code
            ? `Password reset code sent to ${email}. Check your inbox and enter the OTP below.`
            : "If an account exists, a password reset code has been sent.",
        })
        if (data.code) {
          setResetCode(String(data.code).replace(/\D/g, '').slice(0, 6))
        }
        setStep("reset")
      } else {
        setMessage({ type: "error", text: data.error || "Failed to send reset code" })
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
          resetCode,
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
          ? "This reset code has expired. Please request a new code below."
          : data.error || "Failed to reset password"
        
        setMessage({ type: "error", text: errorMessage })
        
        // If token expired, switch back to email step after a short delay
        if (isExpiredToken) {
          setTimeout(() => {
            setStep("email")
            setResetCode("")
            setMessage({ type: "error", text: "Your previous reset code expired. Enter your email below to get a new one." })
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
                ? "Enter your email address and we'll send a 6-digit code to reset your password" 
                : "Enter the OTP code and your new password"}
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
                  {message.type === "success" && resetCode && process.env.NODE_ENV === "development" && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                      <p className="font-medium mb-1">🛠️ Development Mode</p>
                      <p>Code auto-filled below for testing.</p>
                    </div>
                  )}
                </AlertDescription>
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
                      Sending Reset Code...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 mr-2" />
                      Send Reset Code
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
                <div className="space-y-2">
                  <Label>Reset Code</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={resetCode}
                      onChange={(value) => setResetCode(value.replace(/\D/g, "").slice(0, 6))}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="border-accent/40" />
                        <InputOTPSlot index={1} className="border-accent/40" />
                        <InputOTPSlot index={2} className="border-accent/40" />
                        <InputOTPSlot index={3} className="border-accent/40" />
                        <InputOTPSlot index={4} className="border-accent/40" />
                        <InputOTPSlot index={5} className="border-accent/40" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

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
                      setResetCode("")
                      setNewPassword("")
                      setConfirmPassword("")
                      setMessage({ type: "error", text: "Requesting a new reset code. Enter your email below." })
                      // Clear URL params
                      router.replace('/forgot-password')
                    }}
                    disabled={loading}
                  >
                    ← Request New Code
                  </Button>
                </div>
              </form>
            )}

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center mb-4">
                <strong>Instructions:</strong> Enter your email above and check both your inbox and spam folder for the 6-digit reset code.
              </p>
              
              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  Need help? Contact{" "}
                  <a href="mailto:support@makeitsell.org" className="text-accent hover:underline font-semibold">
                    support@makeitsell.org
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
