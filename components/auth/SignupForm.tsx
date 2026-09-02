"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/contexts/AuthContext"
import { createStore } from "@/lib/database-client"
import { ChevronLeft, Eye, EyeOff, Loader2 } from "lucide-react"
import LocationPicker from "@/components/LocationPicker"
import { NIGERIA_STATE_CITY_OPTIONS, NIGERIA_STATES } from "@/lib/nigeria-locations"
import { trackReferralClick } from "@/lib/referral-attribution"

const COUNTRY_CODES = [
  { code: "+234", label: "Nigeria (+234)" },
  { code: "+233", label: "Ghana (+233)" },
  { code: "+254", label: "Kenya (+254)" },
  { code: "+27", label: "South Africa (+27)" },
  { code: "+1", label: "US/Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+91", label: "India (+91)" },
]

type StepKey = "info" | "contact" | "offer" | "store" | "location" | "storeContact" | "security" | "finish"
type StepDef = { key: StepKey; title: string }

function isValidContactPhone(phoneInput: string): boolean {
  const raw = String(phoneInput || '').trim()
  if (!raw) return false
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return false
  if (/^(\d)\1+$/.test(digits)) return false
  if (digits === '0000000000') return false
  return true
}

function getPasswordStrength(password: string): { label: string; score: number; color: string } {
  if (!password) return { label: "", score: 0, color: "bg-muted" }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { label: "Weak", score: 1, color: "bg-destructive" }
  if (score <= 2) return { label: "Fair", score: 2, color: "bg-orange-500" }
  if (score <= 3) return { label: "Good", score: 3, color: "bg-yellow-500" }
  return { label: "Strong", score: 4, color: "bg-green-600" }
}

function formatPhoneWithCountryCode(countryCode: string, phoneInput: string): string {
  const raw = String(phoneInput || '').trim()
  if (!raw) return ''
  if (raw.startsWith('+')) return raw

  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''

  const localDigits = digits.startsWith('0') ? digits.slice(1) : digits
  return `${countryCode}${localDigits}`
}

export default function SignupForm() {
  const searchParams = useSearchParams()
  const isVendorSignup = searchParams.get("type") === "vendor"
  const signupError = searchParams.get("error")
  // ?ref=CODE in URL = vendor referral code shared as a link
  const urlRefCode = (searchParams.get("ref") || "").trim().toUpperCase() || undefined
  const { register } = useAuth() // Add auth context hook

  type RoleType = "customer" | "vendor" | "admin";
  const [formData, setFormData] = useState<{
    email: string
    customerPhone: string
    customerCountryCode: string
    verificationMethod: "email"
    password: string
    confirmPassword: string
    displayName: string
    role: RoleType
    vendorType: "" | "goods" | "services" | "both"
    storeName: string
    storeDescription: string
    storeCategory: string
    storeAddress: string
    storeState: string
    storeCity: string
    storePhone: string
    storeCountryCode: string
  }>({
    email: "",
    customerPhone: "",
    customerCountryCode: "+234",
    verificationMethod: "email",
    password: "",
    confirmPassword: "",
    displayName: "",
    role: (isVendorSignup ? "vendor" : "customer"),
    vendorType: "",
    // Store-specific fields
    storeName: "",
    storeDescription: "",
    storeCategory: "",
    storeAddress: "",
    storeState: "",
    storeCity: "",
    storePhone: "",
    storeCountryCode: "+234",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pendingReferralVendorId, setPendingReferralVendorId] = useState<string | undefined>(undefined)
  const [stepIndex, setStepIndex] = useState(0)

  // Read referral attribution from localStorage (set when visiting a vendor store page)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('misReferralVendorId')
      if (stored) setPendingReferralVendorId(stored)
    } catch {}
  }, [])

  // Track the referral link click itself (separate from attribution, which is only
  // recorded once the referred person actually signs up)
  useEffect(() => {
    trackReferralClick(urlRefCode)
  }, [urlRefCode])
  const [error, setError] = useState(
    signupError ? "Your signup session could not be completed. Please try again." :
    ""
  )
  const [storeCoordinates, setStoreCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [detectedStoreCity, setDetectedStoreCity] = useState<string | null>(null)
  const [detectedStoreState, setDetectedStoreState] = useState<string | null>(null)
  const router = useRouter()

  const availableCities = formData.storeState ? (NIGERIA_STATE_CITY_OPTIONS[formData.storeState] || []) : []

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // The account-type choice on step 1 decides whether the remaining steps walk
  // through store setup (vendor) or stay a short two-step form (customer/admin) —
  // mirrors the section this replaces, which showed/hid the same fields inline.
  const steps: StepDef[] = useMemo(() => {
    const s: StepDef[] = [{ key: "info", title: "Your info" }]
    if (formData.role === "vendor") {
      s.push({ key: "offer", title: "What you'll offer" })
      s.push({ key: "store", title: "Store details" })
      s.push({ key: "location", title: "Store location" })
      s.push({ key: "storeContact", title: "Store contact" })
    } else {
      s.push({ key: "contact", title: "Contact info" })
    }
    s.push({ key: "security", title: "Secure your account" })
    s.push({ key: "finish", title: "Finish up" })
    return s
  }, [formData.role])

  const currentStep = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1
  const progressPercent = Math.round(((stepIndex + 1) / steps.length) * 100)

  function validateStep(key: StepKey): string {
    switch (key) {
      case "info": {
        if (!formData.displayName.trim()) return "Please enter your full name"
        if (!formData.email.trim()) return "Please enter your email"
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) return "Please enter a valid email address"
        return ""
      }
      case "contact": {
        // Optional field — only validate format once the user has actually typed something.
        if (formData.customerPhone.trim() && !isValidContactPhone(formatPhoneWithCountryCode(formData.customerCountryCode, formData.customerPhone))) {
          return "Enter a valid phone number (10-15 digits, no repeated digits)"
        }
        return ""
      }
      case "offer": {
        if (!formData.vendorType) return "Please choose what you want to offer: goods, services, or both"
        return ""
      }
      case "store": {
        if (!formData.storeName.trim()) return "Store name is required for vendor signup"
        if (!formData.storeDescription.trim()) return "Store description is required for vendor signup"
        if (!formData.storeCategory) return "Store category is required for vendor signup"
        return ""
      }
      case "location": {
        if (!formData.storeAddress.trim()) return "Store address is required for vendor signup"
        if (!formData.storeState.trim()) return "Store state is required for vendor signup"
        if (!formData.storeCity.trim()) return "Store city is required for vendor signup"
        return ""
      }
      case "storeContact": {
        if (!formData.storePhone.trim()) return "Store phone number is required for vendor signup"
        if (!isValidContactPhone(formatPhoneWithCountryCode(formData.storeCountryCode, formData.storePhone))) {
          return "Enter a valid store phone number (10-15 digits, no repeated digits)"
        }
        return ""
      }
      case "security": {
        if (formData.password.length < 8) return "Password must be at least 8 characters"
        if (formData.password !== formData.confirmPassword) return "Passwords do not match"
        return ""
      }
      case "finish": {
        if (!acceptTerms) return "Please accept the terms and conditions"
        return ""
      }
      default:
        return ""
    }
  }

  const handleBack = () => {
    setError("")
    setStepIndex((i) => Math.max(0, i - 1))
  }

  const handleNext = () => {
    const validationError = validateStep(currentStep.key)
    if (validationError) {
      setError(validationError)
      return
    }
    setError("")
    if (isLastStep) {
      handleSubmit()
    } else {
      setStepIndex((i) => i + 1)
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setError("")

    console.log("=== SIGNUP FORM SUBMIT STARTED ===")
    console.log("Email:", formData.email)
    console.log("Role:", formData.role)

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters")
      setLoading(false)
      return
    }

    if (!acceptTerms) {
      setError("Please accept the terms and conditions")
      setLoading(false)
      return
    }

    const customerPhoneWithCode = formatPhoneWithCountryCode(formData.customerCountryCode, formData.customerPhone)
    const storePhoneWithCode = formatPhoneWithCountryCode(formData.storeCountryCode, formData.storePhone)
    const verificationPhone = (customerPhoneWithCode || storePhoneWithCode || "").trim()
    // Additional validation for vendors
    if (formData.role === "vendor") {
      if (!formData.vendorType) {
        setError("Please choose what you want to offer: goods, services, or both")
        setLoading(false)
        return
      }
      if (!formData.storeName.trim()) {
        setError("Store name is required for vendor signup")
        setLoading(false)
        return
      }
      if (!formData.storeDescription.trim()) {
        setError("Store description is required for vendor signup")
        setLoading(false)
        return
      }
      if (!formData.storeCategory) {
        setError("Store category is required for vendor signup")
        setLoading(false)
        return
      }
      if (!formData.storeAddress.trim()) {
        setError("Store address is required for vendor signup")
        setLoading(false)
        return
      }
      if (!formData.storePhone.trim()) {
        setError("Store phone number is required for vendor signup")
        setLoading(false)
        return
      }
      if (!isValidContactPhone(storePhoneWithCode || formData.storePhone)) {
        setError("Enter a valid store phone number (10-15 digits, no repeated digits)")
        setLoading(false)
        return
      }
      if (!formData.storeState.trim()) {
        setError("Store state is required for vendor signup")
        setLoading(false)
        return
      }
      if (!formData.storeCity.trim()) {
        setError("Store city is required for vendor signup")
        setLoading(false)
        return
      }
    }

    try {
      console.log("=== SIGNUP FLOW DEBUG ===")
      console.log("Form data role:", formData.role)
      console.log("isVendorSignup:", isVendorSignup)
      console.log("URL search params:", window.location.search)

      // Vendor signup is now free and creates the account directly.
      if (formData.role === "vendor") {
        console.log("Step 1: Creating vendor account via AuthContext...")
        const result = await register(
          formData.email,
          formData.password,
          formData.displayName,
          "vendor",
          verificationPhone || undefined,
          formData.vendorType as "goods" | "services" | "both",
          formData.verificationMethod,
          urlRefCode,
          pendingReferralVendorId,
        )
        try { localStorage.removeItem('misReferralVendorId') } catch {}

        const vendorId = result?.user?.uid
        const shouldCreateStore = formData.vendorType === "goods" || formData.vendorType === "both"

        if (shouldCreateStore) {
          const resolvedState = formData.storeState || detectedStoreState || "Lagos"
          const resolvedCity = formData.storeCity || detectedStoreCity || formData.storeAddress.split(',')[0]?.trim() || "Lagos"
          const addressParts = [formData.storeAddress]
          if (resolvedCity && !formData.storeAddress.toLowerCase().includes(resolvedCity.toLowerCase())) {
            addressParts.push(resolvedCity)
          }
          if (resolvedState && !formData.storeAddress.toLowerCase().includes(resolvedState.toLowerCase())) {
            addressParts.push(resolvedState)
          }
          if (!formData.storeAddress.toLowerCase().includes("nigeria")) {
            addressParts.push("Nigeria")
          }
          const normalizedAddress = addressParts.join(", ")

          try {
            await createStore({
              vendorId,
              storeName: formData.storeName,
              storeDescription: formData.storeDescription,
              storeImage: "/placeholder.svg",
              category: formData.storeCategory,
              address: normalizedAddress,
              location: normalizedAddress,
              city: resolvedCity,
              state: resolvedState,
              storePhone: storePhoneWithCode || formData.storePhone,
              email: formData.email,
              deliveryTime: "1-3 days",
              deliveryFee: 0,
              minimumOrder: 0,
              latitude: storeCoordinates?.lat,
              longitude: storeCoordinates?.lng,
            })
            console.log("Step 2: Vendor store created successfully")
          } catch (storeError) {
            console.error("Step 2: Store setup failed, continuing with account creation:", storeError)
          }
        }

        console.log("Step 3: Redirecting to OTP verification...")
        router.push(`/verify-email?email=${encodeURIComponent(formData.email)}&channel=email`)
        return
      }

      // Create customer/admin account
      if (formData.role === "customer" || formData.role === "admin") {
        console.log("Step 1: Creating customer/admin account via AuthContext...")
        await register(
          formData.email,
          formData.password,
          formData.displayName,
          formData.role === "admin" ? "customer" : formData.role,
          verificationPhone,
          undefined,
          formData.verificationMethod,
          urlRefCode,
          pendingReferralVendorId,
        )
        try { localStorage.removeItem('misReferralVendorId') } catch {}
        console.log("Step 1: Customer/admin account created successfully")

        console.log("Step 2: Redirecting to OTP verification...")
        router.push(`/verify-email?email=${encodeURIComponent(formData.email)}&channel=email`)
        return
      }

      console.log("Step 3: Redirecting user...")
      // This should not be reached anymore for customers
      console.log("=== SIGNUP FORM SUBMIT COMPLETED ===")
    } catch (error: any) {
      console.error("=== SIGNUP FORM ERROR ===", error)
      const errorMessage = String(error?.message || "")
      if (errorMessage.includes('VERIFICATION_EMAIL_SEND_FAILED')) {
        router.push(`/verify-email?email=${encodeURIComponent(formData.email)}&delivery=failed&channel=email`)
        return
      }

      setError(error.message || "Failed to create account")
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto animate-scale-in">
      <CardHeader className="text-center animate-fade-in space-y-3">
        <Link href="/" className="inline-block md:hidden">
          <Image
            src="/images/logo (2).png"
            alt="Make It Sell"
            width={180}
            height={36}
            className="mx-auto h-8 w-auto object-contain"
            priority
          />
        </Link>
        <div className="space-y-1.5">
          <CardTitle className="text-2xl font-bold text-foreground">
            {isVendorSignup || formData.role === "vendor" ? "Create seller account" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {isVendorSignup || formData.role === "vendor" ? (
              "Start selling on Make It Sell marketplace for free"
            ) : (
              "Join Make It Sell marketplace today"
            )}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Step {stepIndex + 1} of {steps.length}: {currentStep.title}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {currentStep.key === "info" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="displayName">Full Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Enter your full name"
                value={formData.displayName}
                onChange={(e) => handleInputChange("displayName", e.target.value)}
                disabled={loading}
                autoComplete="name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
            </div>

            {!isVendorSignup && (
              <div className="space-y-2">
                <Label htmlFor="role">Account Type</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: "customer" | "vendor" | "admin") => handleInputChange("role", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer - Buy products</SelectItem>
                    <SelectItem value="vendor">Vendor - Sell products</SelectItem>
                    {formData.email === "admin@makeitsell.com" && (
                      <SelectItem value="admin">Admin - Platform management</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}

        {currentStep.key === "contact" && (
          <div className="space-y-2">
            <Label htmlFor="customerPhone">Phone Number (optional)</Label>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <Select
                value={formData.customerCountryCode}
                onValueChange={(value) => handleInputChange("customerCountryCode", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Code" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((item) => (
                    <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="customerPhone"
                type="tel"
                placeholder="Phone number"
                value={formData.customerPhone}
                onChange={(e) => handleInputChange("customerPhone", e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
          </div>
        )}

        {currentStep.key === "offer" && (
          <div className="space-y-2">
            <Label htmlFor="vendorType">What will you offer? *</Label>
            <p className="text-xs text-muted-foreground">
              Choose this carefully. Your seller dashboard and setup steps will match this selection.
            </p>
            <Select
              value={formData.vendorType || undefined}
              onValueChange={(value: "goods" | "services" | "both") => handleInputChange("vendorType", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select what you want to offer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="goods">Goods Only - Physical products</SelectItem>
                <SelectItem value="services">Services Only - Professional services</SelectItem>
                <SelectItem value="both">Both - Goods & Services</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {!formData.vendorType && "Select one to continue"}
              {formData.vendorType === "goods" && "You'll sell physical products"}
              {formData.vendorType === "services" && "You'll offer professional services"}
              {formData.vendorType === "both" && "You'll sell both products and services"}
            </p>
          </div>
        )}

        {currentStep.key === "store" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="storeName">Store Name *</Label>
              <Input
                id="storeName"
                type="text"
                placeholder="Enter your store/brand name"
                value={formData.storeName}
                onChange={(e) => handleInputChange("storeName", e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeDescription">Store Description *</Label>
              <textarea
                id="storeDescription"
                placeholder="Describe what your store sells and what makes it unique"
                value={formData.storeDescription}
                onChange={(e) => handleInputChange("storeDescription", e.target.value)}
                disabled={loading}
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {formData.storeDescription.length}/500 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeCategory">Store Category *</Label>
              <Select
                value={formData.storeCategory}
                onValueChange={(value) => handleInputChange("storeCategory", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your store category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="fashion">Fashion & Clothing</SelectItem>
                  <SelectItem value="food">Food & Beverage</SelectItem>
                  <SelectItem value="home">Home & Garden</SelectItem>
                  <SelectItem value="beauty">Beauty & Health</SelectItem>
                  <SelectItem value="sports">Sports & Fitness</SelectItem>
                  <SelectItem value="books">Books & Media</SelectItem>
                  <SelectItem value="automotive">Automotive</SelectItem>
                  <SelectItem value="toys">Toys & Games</SelectItem>
                  <SelectItem value="art">Arts & Crafts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {currentStep.key === "location" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="storeAddress">Store Address *</Label>
              <LocationPicker
                onLocationSelect={(location) => {
                  handleInputChange("storeAddress", location.address)
                  setStoreCoordinates(location.coordinates || null)
                  setDetectedStoreCity(location.city || null)
                  setDetectedStoreState(location.state || null)
                  if (location.state && NIGERIA_STATES.includes(location.state)) {
                    handleInputChange("storeState", location.state)
                    const cityCandidates = NIGERIA_STATE_CITY_OPTIONS[location.state] || []
                    if (location.city && cityCandidates.includes(location.city)) {
                      handleInputChange("storeCity", location.city)
                    }
                  }
                }}
                initialAddress={formData.storeAddress}
                placeholder="Search for your store location..."
              />
              {storeCoordinates && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  Location set: {detectedStoreCity || 'Selected'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="storeState">Store State *</Label>
                <Select
                  value={formData.storeState}
                  onValueChange={(value) => {
                    handleInputChange("storeState", value)
                    handleInputChange("storeCity", "")
                  }}
                >
                  <SelectTrigger id="storeState">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {NIGERIA_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeCity">Store City *</Label>
                <Select
                  value={formData.storeCity}
                  onValueChange={(value) => handleInputChange("storeCity", value)}
                  disabled={!formData.storeState}
                >
                  <SelectTrigger id="storeCity">
                    <SelectValue placeholder={formData.storeState ? "Select city" : "Select state first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCities.map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              If map lookup fails, select state and city manually so shipping pricing can be calculated.
            </p>
          </>
        )}

        {currentStep.key === "storeContact" && (
          <div className="space-y-2">
            <Label htmlFor="storePhone">Store Phone *</Label>
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <Select
                value={formData.storeCountryCode}
                onValueChange={(value) => handleInputChange("storeCountryCode", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Code" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((item) => (
                    <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="storePhone"
                type="tel"
                placeholder="Store contact number"
                value={formData.storePhone}
                onChange={(e) => handleInputChange("storePhone", e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
          </div>
        )}

        {currentStep.key === "security" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
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
              {formData.password && (
                <div className="space-y-1 pt-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((segment) => (
                      <div
                        key={segment}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          segment <= getPasswordStrength(formData.password).score
                            ? getPasswordStrength(formData.password).color
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Strength: {getPasswordStrength(formData.password).label} · Use 8+ characters with a mix of letters, numbers, and symbols
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {currentStep.key === "finish" && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{formData.displayName || "Your account"}</p>
              <p className="text-muted-foreground">{formData.email}</p>
              {formData.role === "vendor" && formData.storeName && (
                <p className="text-muted-foreground">Store: {formData.storeName}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                disabled={loading}
                className="border-2 border-[oklch(0.21_0.194_29.234)] data-[state=checked]:bg-[oklch(0.21_0.194_29.234)] data-[state=checked]:border-[oklch(0.21_0.194_29.234)]"
              />
              <Label htmlFor="terms" className="text-xs sm:text-sm md:text-sm cursor-pointer leading-relaxed whitespace-nowrap">
                I agree to the{" "}
                <Link href="/terms" className="text-accent hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-accent hover:underline">
                  Privacy Policy
                </Link>
              </Label>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          {stepIndex > 0 && (
            <Button type="button" variant="outline" onClick={handleBack} disabled={loading} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          <Button
            type="button"
            onClick={handleNext}
            className="flex-1 bg-accent text-white hover:bg-accent/90 transition-all"
            disabled={loading || (isLastStep && !acceptTerms)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading
              ? "Creating Account..."
              : isLastStep
                ? (isVendorSignup || formData.role === "vendor" ? "Create Seller Account" : "Create Account")
                : "Continue"
            }
          </Button>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col space-y-4">
        <Link href="/" className="w-full">
          <Button type="button" variant="outline" className="w-full">
            Back to Home
          </Button>
        </Link>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
