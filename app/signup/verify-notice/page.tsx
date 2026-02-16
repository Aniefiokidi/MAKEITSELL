"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, CheckCircle, RefreshCw, Loader2 } from "lucide-react"

export default function VerifyNoticePage() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  const resendVerificationEmail = async () => {
    if (!email) return

    setResendLoading(true)
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      })
      const result = await response.json()

      if (result.success) {
        setResendSuccess(true)
        setTimeout(() => setResendSuccess(false), 5000)
      } else {
        alert(result.error || "Failed to send verification email")
      }
    } catch (error) {
      alert("An error occurred while sending the email")
    } finally {
      setResendLoading(false)
    }
  }

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8">
        <Card className="max-w-md w-full shadow-lg border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-foreground">Invalid Request</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="bg-accent hover:bg-accent/90 text-white">
              <Link href="/signup">Go to Signup</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="shadow-lg border-2">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-accent/10 mb-4">
              <Mail className="h-8 w-8 text-accent" />
            </div>
            
            <CardTitle className="text-2xl text-foreground">Check Your Email</CardTitle>
            <CardDescription className="text-muted-foreground">
              We've sent a verification link to your email address
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Alert className="border-accent/20 bg-accent/5">
              <CheckCircle className="h-4 w-4 text-accent" />
              <AlertDescription className="text-foreground">
                <strong>Account created successfully!</strong><br />
                A verification email has been sent to:
                <div className="mt-2 font-semibold break-all text-accent">
                  {email}
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="bg-muted/30 p-4 rounded-lg border">
                <h3 className="font-medium text-foreground mb-2">What's next?</h3>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  <li>Check your email inbox (including spam/junk folder)</li>
                  <li>Click the verification link in the email</li>
                  <li>You'll be redirected back to sign in</li>
                  <li>Start using your Make It Sell account!</li>
                </ol>
              </div>

              {resendSuccess && (
                <Alert className="border-green-500/20 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Verification email sent successfully!
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the email?
                </p>
                <Button
                  onClick={resendVerificationEmail}
                  disabled={resendLoading}
                  variant="outline"
                  className="w-full border-accent/30 text-accent hover:bg-accent/10"
                >
                  {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {resendLoading ? "Sending..." : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
              </div>

              <div className="pt-4 border-t border-border space-y-2">
                <Button variant="ghost" asChild className="w-full hover:bg-accent/10">
                  <Link href="/login">
                    Go to Login Page
                  </Link>
                </Button>
                <Button variant="ghost" asChild className="w-full hover:bg-accent/10">
                  <Link href="/">
                    Back to Homepage
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            Need help? Contact us at{" "}
            <a href="mailto:noreply@makeitsell.org" className="text-accent hover:underline font-medium">
              noreply@makeitsell.org
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}