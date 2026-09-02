"use client"

import { useSearchParams } from "next/navigation"
import SignupForm from "@/components/auth/SignupForm"
import { AuthShell } from "@/components/auth/AuthShell"

export default function SignupPage() {
  const searchParams = useSearchParams()
  const isVendorSignup = searchParams.get("type") === "vendor"

  return (
    <AuthShell variant={isVendorSignup ? "vendor-signup" : "signup"}>
      <SignupForm />
    </AuthShell>
  )
}
