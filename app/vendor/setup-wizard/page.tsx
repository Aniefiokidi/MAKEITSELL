"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import VendorLayout from "@/components/vendor/VendorLayout"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { Loader2 } from "lucide-react"

type WizardSettings = {
  storeName: string
  storeDescription: string
  category: string
  profileImage: string
  storeImage: string
  address: string
  phone: string
  email: string
  deliveryTime: string
  deliveryFee: number
  minimumOrder: number
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  accountVerified: boolean
  returnPolicy: string
  shippingPolicy: string
  acceptReturns: boolean
  acceptExchanges: boolean
}

type StepKey = "branding" | "catalog" | "shipping" | "payment" | "policies"

const stepOrder: Array<{ key: StepKey; title: string; description: string }> = [
  { key: "branding", title: "Branding", description: "Store name, category, description, visuals" },
  { key: "catalog", title: "Categories", description: "Add products and organize categories" },
  { key: "shipping", title: "Shipping", description: "Address, delivery windows, fee settings" },
  { key: "payment", title: "Payment", description: "Bank account and verification" },
  { key: "policies", title: "Policies", description: "Return and shipping policy basics" },
]

const initialSettings: WizardSettings = {
  storeName: "",
  storeDescription: "",
  category: "",
  profileImage: "",
  storeImage: "",
  address: "",
  phone: "",
  email: "",
  deliveryTime: "30-60 min",
  deliveryFee: 500,
  minimumOrder: 2000,
  bankCode: "",
  bankName: "",
  accountNumber: "",
  accountName: "",
  accountVerified: false,
  returnPolicy: "",
  shippingPolicy: "",
  acceptReturns: true,
  acceptExchanges: true,
}

export default function VendorSetupWizardPage() {
  const { user, userProfile } = useAuth()
  const [stepIndex, setStepIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [storeId, setStoreId] = useState<string | null>(null)
  const [productsCount, setProductsCount] = useState(0)
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([])
  const [banksLoading, setBanksLoading] = useState(false)
  const [verifyingAccount, setVerifyingAccount] = useState(false)
  const [profileUploading, setProfileUploading] = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [settings, setSettings] = useState<WizardSettings>(initialSettings)

  const isPdfAsset = (value?: string) => {
    if (!value) return false
    return /\.pdf(\?|#|$)/i.test(value)
  }

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) return
      setLoading(true)
      setBanksLoading(true)
      try {
        const [storeRes, productsRes, banksRes] = await Promise.all([
          fetch(`/api/database/stores?vendorId=${user.uid}`),
          fetch(`/api/database/products?vendorId=${user.uid}&limit=100`),
          fetch("/api/vendor/banks"),
        ])

        const [storeJson, productsJson, banksJson] = await Promise.all([
          storeRes.json(),
          productsRes.json(),
          banksRes.json(),
        ])

        const vendorStore = Array.isArray(storeJson?.data) ? storeJson.data[0] : null
        if (vendorStore?._id || vendorStore?.id) {
          setStoreId(String(vendorStore._id || vendorStore.id))
          setSettings((prev) => ({
            ...prev,
            storeName: vendorStore.storeName || "",
            storeDescription: vendorStore.storeDescription || "",
            category: vendorStore.category || "",
            profileImage: vendorStore.profileImage || "",
            storeImage: vendorStore.storeImage || "",
            address: vendorStore.address || "",
            phone: vendorStore.phone || "",
            email: vendorStore.email || userProfile?.email || "",
            deliveryTime: vendorStore.deliveryTime || "30-60 min",
            deliveryFee: vendorStore.deliveryFee || 500,
            minimumOrder: vendorStore.minimumOrder || 2000,
            bankCode: vendorStore.bankCode || "",
            bankName: vendorStore.bankName || "",
            accountNumber: vendorStore.accountNumber || "",
            accountName: vendorStore.accountName || "",
            accountVerified: Boolean(vendorStore.accountVerified),
            returnPolicy: vendorStore.returnPolicy || "",
            shippingPolicy: vendorStore.shippingPolicy || "",
            acceptReturns: vendorStore.acceptReturns ?? true,
            acceptExchanges: vendorStore.acceptExchanges ?? true,
          }))
        } else {
          setSettings((prev) => ({
            ...prev,
            storeName: userProfile?.displayName || "",
            email: userProfile?.email || "",
          }))
        }

        const count = Array.isArray(productsJson?.data) ? productsJson.data.length : 0
        setProductsCount(count)

        if (banksJson?.success && Array.isArray(banksJson.banks)) {
          const uniqueBanks = new Map<string, { name: string; code: string }>()
          banksJson.banks.forEach((raw: any) => {
            const code = String(raw.code ?? raw.id ?? "").trim()
            const name = String(raw.name ?? "").trim()
            if (code && name && !uniqueBanks.has(code)) {
              uniqueBanks.set(code, { name, code })
            }
          })
          setBanks(Array.from(uniqueBanks.values()))
        } else {
          setBanks([])
        }
      } catch (err) {
        console.error("Failed to load setup wizard data", err)
        setBanks([])
      } finally {
        setLoading(false)
        setBanksLoading(false)
      }
    }

    load()
  }, [user?.uid, userProfile?.displayName, userProfile?.email])

  const stepCompletion = useMemo(() => {
    return {
      branding:
        settings.storeName.trim().length > 2 &&
        settings.storeDescription.trim().length > 10 &&
        settings.category.trim().length > 0,
      catalog: productsCount > 0,
      shipping:
        settings.address.trim().length > 5 &&
        settings.phone.trim().length > 7 &&
        settings.deliveryTime.trim().length > 0 &&
        settings.deliveryFee >= 0 &&
        settings.minimumOrder >= 0,
      payment:
        settings.bankCode.trim().length > 0 &&
        settings.accountNumber.trim().length === 10 &&
        settings.accountName.trim().length > 2 &&
        settings.accountVerified,
      policies:
        settings.returnPolicy.trim().length > 10 && settings.shippingPolicy.trim().length > 10,
    }
  }, [settings, productsCount])

  const completedCount = Object.values(stepCompletion).filter(Boolean).length
  const progressPercent = Math.round((completedCount / stepOrder.length) * 100)

  const activeStep = stepOrder[stepIndex]

  const saveStore = async () => {
    if (!user?.uid) return false

    const payload = {
      vendorId: user.uid,
      storeName: settings.storeName || userProfile?.displayName || "My Store",
      storeDescription: settings.storeDescription || "Welcome to our store.",
      category: settings.category || "other",
      profileImage: settings.profileImage,
      storeImage: settings.storeImage || settings.profileImage || "/placeholder.svg",
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      deliveryTime: settings.deliveryTime,
      deliveryFee: settings.deliveryFee,
      minimumOrder: settings.minimumOrder,
      bankCode: settings.bankCode,
      bankName: settings.bankName,
      accountNumber: settings.accountNumber,
      accountName: settings.accountName,
      accountVerified: settings.accountVerified,
      returnPolicy: settings.returnPolicy,
      shippingPolicy: settings.shippingPolicy,
      acceptReturns: settings.acceptReturns,
      acceptExchanges: settings.acceptExchanges,
      isOpen: true,
    }

    const endpoint = storeId ? `/api/database/stores/${storeId}` : `/api/database/stores`
    const method = storeId ? "PATCH" : "POST"

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const result = await res.json()

    if (!res.ok || !result.success) {
      throw new Error(result.error || "Unable to save setup step")
    }

    if (!storeId && result.id) {
      setStoreId(String(result.id))
    }

    return true
  }

  const saveCurrentStep = async () => {
    setSaving(true)
    setMessage("")
    try {
      await saveStore()
      setMessage("Step saved")
      return true
    } catch (err: any) {
      setMessage(err?.message || "Unable to save step")
      return false
    } finally {
      setSaving(false)
    }
  }

  const verifyAccount = async () => {
    if (!settings.bankCode || settings.accountNumber.length !== 10) {
      setMessage("Select bank and enter a valid 10-digit account number first")
      return
    }

    setVerifyingAccount(true)
    setMessage("")
    try {
      const response = await fetch("/api/vendor/resolve-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankCode: settings.bankCode,
          accountNumber: settings.accountNumber,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.success || !result.accountName) {
        throw new Error(result.error || "Account verification failed")
      }

      setSettings((prev) => ({
        ...prev,
        accountName: result.accountName,
        accountVerified: true,
      }))
      setMessage("Account verified")
    } catch (err: any) {
      setSettings((prev) => ({ ...prev, accountVerified: false }))
      setMessage(err?.message || "Account verification failed")
    } finally {
      setVerifyingAccount(false)
    }
  }

  const handleContinue = async () => {
    const ok = await saveCurrentStep()
    if (!ok) return
    if (stepIndex < stepOrder.length - 1) {
      setStepIndex((prev) => prev + 1)
    }
  }

  const handleBrandingUpload = async (file: File | null, target: "profileImage" | "storeImage") => {
    if (!file) return

    const setUploading = target === "profileImage" ? setProfileUploading : setBannerUploading
    const assetName = target === "profileImage" ? "Profile image" : "Store banner"

    setUploading(true)
    setMessage("")
    try {
      const uploadedUrl = await uploadToCloudinary(file)
      setSettings((prev) => {
        const nextSettings = {
          ...prev,
          [target]: uploadedUrl,
        }

        if (target === "profileImage" && !prev.storeImage) {
          nextSettings.storeImage = uploadedUrl
        }

        return nextSettings
      })
      setMessage(`${assetName} uploaded successfully`)
    } catch (error: any) {
      setMessage(error?.message || `Failed to upload ${assetName.toLowerCase()}`)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <VendorLayout>
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading setup wizard...
        </div>
      </VendorLayout>
    )
  }

  return (
    <VendorLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Store Setup Wizard</h1>
          <p className="text-muted-foreground">Complete these 5 steps to launch and optimize your store.</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 flex items-center justify-between text-sm">
              <span>{completedCount} of {stepOrder.length} steps complete</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-5">
              {stepOrder.map((step, index) => (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={`rounded border px-3 py-2 text-left text-xs transition ${index === stepIndex ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <p className="font-semibold">{index + 1}. {step.title}</p>
                  <p className="text-muted-foreground">{stepCompletion[step.key] ? "Complete" : "Pending"}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{activeStep.title}</CardTitle>
            <CardDescription>{activeStep.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeStep.key === "branding" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="storeName">Store Name</Label>
                    <Input id="storeName" value={settings.storeName} onChange={(e) => setSettings((prev) => ({ ...prev, storeName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={settings.category || undefined} onValueChange={(value) => setSettings((prev) => ({ ...prev, category: value }))}>
                      <SelectTrigger id="category"><SelectValue placeholder="Select a category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="electronics">Electronics</SelectItem>
                        <SelectItem value="fashion">Fashion</SelectItem>
                        <SelectItem value="food">Food</SelectItem>
                        <SelectItem value="beauty">Beauty</SelectItem>
                        <SelectItem value="home">Home</SelectItem>
                        <SelectItem value="services">Services</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storeDescription">Store Description</Label>
                  <Textarea id="storeDescription" rows={4} value={settings.storeDescription} onChange={(e) => setSettings((prev) => ({ ...prev, storeDescription: e.target.value }))} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profileImage">Profile Image Upload</Label>
                    <Input
                      id="profileImage"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0] || null
                        await handleBrandingUpload(file, "profileImage")
                        e.target.value = ""
                      }}
                    />
                    {profileUploading ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Uploading profile image...
                      </p>
                    ) : null}
                    {settings.profileImage ? (
                      isPdfAsset(settings.profileImage) ? (
                        <a href={settings.profileImage} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-4">
                          View uploaded profile PDF
                        </a>
                      ) : (
                        <img src={settings.profileImage} alt="Profile preview" className="h-16 w-16 rounded object-cover border" />
                      )
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="storeImage">Store Banner Upload</Label>
                    <Input
                      id="storeImage"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0] || null
                        await handleBrandingUpload(file, "storeImage")
                        e.target.value = ""
                      }}
                    />
                    {bannerUploading ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Uploading store banner...
                      </p>
                    ) : null}
                    {settings.storeImage ? (
                      isPdfAsset(settings.storeImage) ? (
                        <a href={settings.storeImage} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-4">
                          View uploaded banner PDF
                        </a>
                      ) : (
                        <img src={settings.storeImage} alt="Store banner preview" className="h-16 w-full max-w-60 rounded object-cover border" />
                      )
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            {activeStep.key === "catalog" ? (
              <>
                <div className="rounded-md border p-4">
                  <p className="text-sm">Current products: <span className="font-semibold">{productsCount}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">Smart collections work best once you publish at least 3 products across categories.</p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline">
                    <Link href="/vendor/products/new">Add Product</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/vendor/products">Manage Products</Link>
                  </Button>
                </div>
              </>
            ) : null}

            {activeStep.key === "shipping" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="address">Business Address</Label>
                  <Input id="address" value={settings.address} onChange={(e) => setSettings((prev) => ({ ...prev, address: e.target.value }))} />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={settings.phone} onChange={(e) => setSettings((prev) => ({ ...prev, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Contact Email</Label>
                    <Input id="email" type="email" value={settings.email} onChange={(e) => setSettings((prev) => ({ ...prev, email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deliveryTime">Delivery Time</Label>
                    <Input id="deliveryTime" value={settings.deliveryTime} onChange={(e) => setSettings((prev) => ({ ...prev, deliveryTime: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="deliveryFee">Delivery Fee (Naira)</Label>
                    <Input id="deliveryFee" type="number" min={0} value={settings.deliveryFee} onChange={(e) => setSettings((prev) => ({ ...prev, deliveryFee: Number(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minimumOrder">Minimum Order (Naira)</Label>
                    <Input id="minimumOrder" type="number" min={0} value={settings.minimumOrder} onChange={(e) => setSettings((prev) => ({ ...prev, minimumOrder: Number(e.target.value) || 0 }))} />
                  </div>
                </div>
              </>
            ) : null}

            {activeStep.key === "payment" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bankCode">Bank</Label>
                    <Select
                      value={settings.bankCode || undefined}
                      disabled={banksLoading}
                      onValueChange={(value) => {
                        const selectedBank = banks.find((bank) => bank.code === value)
                        setSettings((prev) => ({
                          ...prev,
                          bankCode: value,
                          bankName: selectedBank?.name || "",
                          accountVerified: false,
                          accountName: "",
                        }))
                      }}
                    >
                      <SelectTrigger id="bankCode"><SelectValue placeholder={banksLoading ? "Loading banks..." : "Select bank"} /></SelectTrigger>
                      <SelectContent>
                        {banks.map((bank) => (
                          <SelectItem key={`${bank.code}-${bank.name}`} value={bank.code}>{bank.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      maxLength={10}
                      value={settings.accountNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 10)
                        setSettings((prev) => ({ ...prev, accountNumber: value, accountVerified: false, accountName: "" }))
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={verifyAccount} disabled={verifyingAccount}>
                    {verifyingAccount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Verify Account
                  </Button>
                  <p className="text-sm text-muted-foreground">{settings.accountName || "Account name will appear after verification"}</p>
                </div>
              </>
            ) : null}

            {activeStep.key === "policies" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="returnPolicy">Return Policy</Label>
                  <Textarea id="returnPolicy" rows={4} value={settings.returnPolicy} onChange={(e) => setSettings((prev) => ({ ...prev, returnPolicy: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shippingPolicy">Shipping Policy</Label>
                  <Textarea id="shippingPolicy" rows={4} value={settings.shippingPolicy} onChange={(e) => setSettings((prev) => ({ ...prev, shippingPolicy: e.target.value }))} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="acceptReturns"
                      checked={settings.acceptReturns}
                      onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, acceptReturns: Boolean(checked) }))}
                    />
                    <Label htmlFor="acceptReturns">Accept returns</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="acceptExchanges"
                      checked={settings.acceptExchanges}
                      onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, acceptExchanges: Boolean(checked) }))}
                    />
                    <Label htmlFor="acceptExchanges">Accept exchanges</Label>
                  </div>
                </div>
              </>
            ) : null}

            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))} disabled={stepIndex === 0 || saving || profileUploading || bannerUploading}>
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={saveCurrentStep} disabled={saving || profileUploading || bannerUploading}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Step
                </Button>
                <Button type="button" onClick={handleContinue} disabled={saving || profileUploading || bannerUploading || stepIndex === stepOrder.length - 1}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save & Continue
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {completedCount === stepOrder.length ? (
          <Card>
            <CardContent className="pt-6">
              <p className="font-semibold">Your store setup is complete.</p>
              <p className="text-sm text-muted-foreground">You can now focus on growth insights, smart collections, and conversions.</p>
              <div className="mt-3 flex gap-2">
                <Button asChild><Link href="/vendor/dashboard">Go to Dashboard</Link></Button>
                <Button asChild variant="outline"><Link href="/vendor/products">Manage Products</Link></Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </VendorLayout>
  )
}
