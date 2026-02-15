"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, Loader2, Mail, RefreshCw } from "lucide-react"

export default function VerifyEmailPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [resendLoading, setResendLoading] = useState(false)

  const handleVerifyCode = async () => {
    if (!email || !code) {
      setStatus("error")
      setMessage("Please enter your email and the code you received.")
      return
    }
    setStatus("loading")
    setMessage("")
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      })
      const result = await response.json()
      if (result.success) {
        setStatus("success")
        setMessage("Your email has been verified successfully!")
        setTimeout(() => {
          router.push(result.redirectUrl || "/stores")
        }, 3000)
      } else {
        setStatus("error")
        setMessage(result.error || "Verification failed")
      }
    } catch (error) {
      setStatus("error")
      setMessage("An error occurred during verification")
    }
  }

  const resendVerificationEmail = async () => {
    if (!email) {
      alert("Please enter your email address")
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
        alert("Verification code sent! Please check your inbox.")
      } else {
        alert(result.error || "Failed to send verification code")
      }
    } catch (error) {
      alert("An error occurred while sending the code")
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-gray-100 mb-4">
              {status === "loading" && <Loader2 className="h-8 w-8 animate-spin text-blue-500" />}
              {status === "success" && <CheckCircle className="h-8 w-8 text-green-500" />}
              {status === "error" && <XCircle className="h-8 w-8 text-red-500" />}
            </div>
            <CardTitle className="text-2xl">
              {status === "loading" && "Verifying..."}
              {status === "success" && "Email Verified!"}
              {status === "error" && "Verification Failed"}
              {status === "idle" && "Verify Your Email"}
            </CardTitle>
            <CardDescription>
              {status === "loading" && "Please wait while we verify your code"}
              {status === "success" && "Your account is now active"}
              {status === "error" && message}
              {status === "idle" && "Enter the code sent to your email address"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(status === "idle" || status === "error") && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleVerifyCode();
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your-email@example.com"
                      className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700">Verification Code</label>
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="Enter the 6-digit code"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={status === "loading"}>
                  {status === "loading" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Verify
                </Button>
                <div className="flex items-center justify-between mt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={resendVerificationEmail} disabled={resendLoading}>
                    {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {resendLoading ? "Sending..." : <RefreshCw className="h-4 w-4" />} Resend Code
                  </Button>
                </div>
              </form>
            )}
            {status === "success" && (
              <div className="space-y-4">
                <div className="text-center text-sm text-gray-600">
                  <p>You will be redirected to the stores page in a few seconds...</p>
                </div>
                <div className="space-y-2">
                  <Button asChild className="w-full">
                    <Link href="/login">
                      Continue to Login
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/">
                      Go to Homepage
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="text-center text-sm text-gray-500">
          <p>
            Need help? Contact us at{" "}
            <a href="mailto:noreply@makeitsell.org" className="text-blue-600 hover:underline">
              noreply@makeitsell.org
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}