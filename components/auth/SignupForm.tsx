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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { signUp } from "@/lib/auth"
import { createStore } from "@/lib/firestore"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { Eye, EyeOff, Loader2, Upload, X } from "lucide-react"

export default function SignupForm() {
  const searchParams = useSearchParams()
  const isVendorSignup = searchParams.get("type") === "vendor"

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
    role: (isVendorSignup ? "vendor" : "customer") as "customer" | "vendor" | "admin",
    vendorType: "both" as "goods" | "services" | "both",
    // Store-specific fields
    storeName: "",
    storeDescription: "",
    storeCategory: "",
    storeAddress: "",
    storePhone: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [storeLogoFile, setStoreLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const router = useRouter()

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError("Logo file size must be less than 5MB")
        return
      }
      if (!file.type.startsWith('image/')) {
        setError("Please select a valid image file")
        return
      }
      setStoreLogoFile(file)
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setError("") // Clear any previous errors
    }
  }

  const removeLogo = () => {
    setStoreLogoFile(null)
    setLogoPreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters")
      setLoading(false)
      return
    }

    if (!acceptTerms) {
      setError("Please accept the terms and conditions")
      setLoading(false)
      return
    }

    // Additional validation for vendors
    if (formData.role === "vendor") {
      if (!formData.storeName.trim()) {
        setError("Store name is required for sellers")
        setLoading(false)
        return
      }
      if (!formData.storeDescription.trim()) {
        setError("Store description is required for sellers")
        setLoading(false)
        return
      }
      if (!formData.storeCategory) {
        setError("Store category is required for sellers")
        setLoading(false)
        return
      }
      if (!formData.storeAddress.trim()) {
        setError("Store address is required for sellers")
        setLoading(false)
        return
      }
    }

    try {
      // Create user account first
      console.log("Step 1: Creating user account...")
      const result = await signUp(
        formData.email, 
        formData.password, 
        formData.displayName, 
        formData.role,
        formData.role === "vendor" ? formData.vendorType : undefined
      )
      console.log("Step 1: User account created successfully")

      // If vendor, create store
      if (formData.role === "vendor" && result.user) {
        console.log("Step 2: Vendor detected, creating store...")
        let storeLogoUrl = "/placeholder.svg" // Default logo
        
        // Upload logo if provided
        if (storeLogoFile) {
          setUploadingLogo(true)
          console.log("Step 2a: Uploading logo to Cloudinary...")
          try {
            storeLogoUrl = await uploadToCloudinary(storeLogoFile)
            console.log("Step 2a: Logo uploaded successfully")
          } catch (uploadError) {
            console.error("Step 2a: Failed to upload logo:", uploadError)
            // Continue with default logo if upload fails
          }
          setUploadingLogo(false)
        }

        // Create store
        console.log("Step 2b: Creating store document...")
        try {
          await createStore({
            vendorId: result.user.uid,
            storeName: formData.storeName.trim(),
            storeDescription: formData.storeDescription.trim(),
            storeImage: storeLogoUrl,
            category: formData.storeCategory,
            rating: 5.0, // Default rating
            reviewCount: 0,
            isOpen: true,
            deliveryTime: "30-60 min", // Default delivery time
            deliveryFee: 500, // Default delivery fee in Naira
            minimumOrder: 2000, // Default minimum order in Naira
            address: formData.storeAddress.trim(),
            phone: formData.storePhone.trim(),
            email: formData.email,
          })
          console.log("Step 2b: Store created successfully")
        } catch (storeError: any) {
          console.error("Step 2b: Store creation failed:", storeError)
          // Don't block signup if store creation fails
          setError("Account created but store setup failed. Please complete setup in dashboard.")
        }
      }

      console.log("Step 3: Redirecting user...")
      // Redirect based on role
      if (formData.role === "vendor") {
        console.log("Redirecting to vendor dashboard...")
        router.push("/vendor/dashboard")
      } else if (formData.role === "admin") {
        console.log("Redirecting to admin dashboard...")
        router.push("/admin/dashboard")
      } else {
        console.log("Redirecting to home...")
        router.push("/")
      }
      console.log("=== SIGNUP FORM SUBMIT COMPLETED ===")
    } catch (error: any) {
      console.error("=== SIGNUP FORM ERROR ===", error)
      setError(error.message || "Failed to create account")
      setLoading(false)
      setUploadingLogo(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto animate-scale-in">
      <CardHeader className="text-center animate-fade-in">
        <CardTitle className="text-2xl font-bold" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>
          {isVendorSignup ? "Create Seller Account" : "Create Account"}
        </CardTitle>
        <CardDescription>
          {isVendorSignup ? "Start selling on BRANDA marketplace" : "Join BRANDA marketplace today"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="displayName">Full Name</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Enter your full name"
              value={formData.displayName}
              onChange={(e) => handleInputChange("displayName", e.target.value)}
              required
              disabled={loading}
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
              required
              disabled={loading}
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
                  {formData.email === "admin@branda.com" && (
                    <SelectItem value="admin">Admin - Platform management</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Store Information Section - Only show for vendors */}
          {(formData.role === "vendor" || isVendorSignup) && (
            <>
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Store Information</h3>
                
                {/* Vendor Type Selection */}
                <div className="space-y-2 mb-4">
                  <Label htmlFor="vendorType">What will you offer? *</Label>
                  <Select
                    value={formData.vendorType}
                    onValueChange={(value: "goods" | "services" | "both") => handleInputChange("vendorType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select offering type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="goods">Goods Only - Physical products</SelectItem>
                      <SelectItem value="services"> Services Only - Professional services</SelectItem>
                      <SelectItem value="both"> Both - Goods & Services</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.vendorType === "goods" && "You'll sell physical products"}
                    {formData.vendorType === "services" && "You'll offer professional services"}
                    {formData.vendorType === "both" && "You'll sell both products and services"}
                  </p>
                </div>

                {/* Store Logo Upload */}
                <div className="space-y-2 mb-4">
                  <Label htmlFor="storeLogo">Store Logo</Label>
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <div className="relative">
                        <img
                          src={logoPreview}
                          alt="Store logo preview"
                          className="w-20 h-20 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={removeLogo}
                          disabled={loading}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center">
                        <Upload className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        id="storeLogo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        disabled={loading || uploadingLogo}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('storeLogo')?.click()}
                        disabled={loading || uploadingLogo}
                        className="w-full"
                      >
                        {uploadingLogo ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Choose Store Logo
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG or GIF (max 5MB)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Store Name */}
                <div className="space-y-2">
                  <Label htmlFor="storeName">Store Name *</Label>
                  <Input
                    id="storeName"
                    type="text"
                    placeholder="Enter your store/brand name"
                    value={formData.storeName}
                    onChange={(e) => handleInputChange("storeName", e.target.value)}
                    required={formData.role === "vendor"}
                    disabled={loading}
                  />
                </div>

                {/* Store Description */}
                <div className="space-y-2">
                  <Label htmlFor="storeDescription">Store Description *</Label>
                  <textarea
                    id="storeDescription"
                    placeholder="Describe what your store sells and what makes it unique"
                    value={formData.storeDescription}
                    onChange={(e) => handleInputChange("storeDescription", e.target.value)}
                    required={formData.role === "vendor"}
                    disabled={loading}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.storeDescription.length}/500 characters
                  </p>
                </div>

                {/* Store Category */}
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

                {/* Store Address */}
                <div className="space-y-2">
                  <Label htmlFor="storeAddress">Store Address *</Label>
                  <Input
                    id="storeAddress"
                    type="text"
                    placeholder="Enter your store location/address"
                    value={formData.storeAddress}
                    onChange={(e) => handleInputChange("storeAddress", e.target.value)}
                    required={formData.role === "vendor"}
                    disabled={loading}
                  />
                </div>

                {/* Store Phone */}
                <div className="space-y-2">
                  <Label htmlFor="storePhone">Store Phone (Optional)</Label>
                  <Input
                    id="storePhone"
                    type="tel"
                    placeholder="Enter store contact number"
                    value={formData.storePhone}
                    onChange={(e) => handleInputChange("storePhone", e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
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

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                required
                disabled={loading}
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={acceptTerms}
              onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
              disabled={loading}
              className="border-2 border-[oklch(0.21_0.194_29.234)] data-[state=checked]:bg-[oklch(0.21_0.194_29.234)] data-[state=checked]:border-[oklch(0.21_0.194_29.234)]"
            />
            <Label htmlFor="terms" className="text-sm cursor-pointer">
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
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={loading || uploadingLogo || !acceptTerms}>
            {(loading || uploadingLogo) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {uploadingLogo 
              ? "Uploading Logo..." 
              : loading 
                ? "Creating Account..." 
                : isVendorSignup 
                  ? "Create Seller Account & Store" 
                  : "Create Account"
            }
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
