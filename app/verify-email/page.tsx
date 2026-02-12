"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, Loader2, Mail, RefreshCw } from "lucide-react"

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)

  useEffect(() => {
    if (token) {
      verifyEmail(token)
    } else {
      setStatus("error")
      setMessage("No verification token provided")
    }
  }, [token])

  const verifyEmail = async (verificationToken: string) => {
    try {
      const response = await fetch(`/api/auth/verify-email?token=${verificationToken}`)
      const result = await response.json()

      if (result.success) {
        setStatus("success")
        setMessage("Your email has been verified successfully!")
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/login?verified=true")
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
              {status === "loading" && "Verifying Email..."}
              {status === "success" && "Email Verified!"}
              {status === "error" && "Verification Failed"}
            </CardTitle>
            
            <CardDescription>
              {status === "loading" && "Please wait while we verify your email address"}
              {status === "success" && "Your account is now active"}
              {status === "error" && "There was a problem verifying your email"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Alert className={`${
              status === "success" ? "border-green-200 bg-green-50" : 
              status === "error" ? "border-red-200 bg-red-50" : 
              "border-blue-200 bg-blue-50"
            }`}>
              <AlertDescription className={`${
                status === "success" ? "text-green-800" : 
                status === "error" ? "text-red-800" : 
                "text-blue-800"
              }`}>
                {message}
              </AlertDescription>
            </Alert>

            {status === "success" && (
              <div className="space-y-4">
                <div className="text-center text-sm text-gray-600">
                  <p>You will be redirected to the login page in a few seconds...</p>
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

            {status === "error" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Enter your email to resend verification:
                  </label>
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your-email@example.com"
                        className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <Button
                      onClick={resendVerificationEmail}
                      disabled={resendLoading}
                      size="sm"
                    >
                      {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {resendLoading ? "Sending..." : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="space-y-2">
                    <Button variant="outline" asChild className="w-full">
                      <Link href="/login">
                        Back to Login
                      </Link>
                    </Button>
                    <Button variant="ghost" asChild className="w-full">
                      <Link href="/">
                        Go to Homepage
                      </Link>
                    </Button>
                  </div>
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