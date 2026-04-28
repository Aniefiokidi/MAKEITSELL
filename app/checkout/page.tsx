"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useCart } from "@/contexts/CartContext"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, CreditCard, Truck, Shield, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Image from "next/image"
import Link from "next/link"
import Header from "@/components/Header"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { trackFunnelEvent } from "@/lib/funnel-tracker"
import { NIGERIA_STATE_CITY_OPTIONS, NIGERIA_STATES } from "@/lib/nigeria-locations"

const COUNTRY_CODES = [
  { code: "+234", label: "NG (+234)" },
  { code: "+233", label: "GH (+233)" },
  { code: "+254", label: "KE (+254)" },
  { code: "+27", label: "ZA (+27)" },
  { code: "+1", label: "US/CA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+91", label: "IN (+91)" },
]

function formatPhoneWithCountryCode(countryCode: string, phoneInput: string): string {
  const raw = String(phoneInput || "").trim()
  if (!raw) return ""
  if (raw.startsWith("+")) return raw

  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""

  const localDigits = digits.startsWith("0") ? digits.slice(1) : digits
  return `${countryCode}${localDigits}`
}

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart()
  const { user, userProfile, refreshProfile } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [shippingLoading, setShippingLoading] = useState(false)
  const [error, setError] = useState("")
  const [shippingEstimate, setShippingEstimate] = useState<{ cost: number; hasTbd?: boolean; source?: string } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'checkout'>("wallet")
  const [checkoutTracked, setCheckoutTracked] = useState(false)
  const [showWalletTopupPrompt, setShowWalletTopupPrompt] = useState(false)
  const [quickTopupAmount, setQuickTopupAmount] = useState("")
  const [quickTopupLoading, setQuickTopupLoading] = useState(false)

  const [shippingInfo, setShippingInfo] = useState({
    firstName: "",
    lastName: "",
    email: user?.email || "",
    phoneCountryCode: "+234",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "Nigeria",
    deliveryInstructions: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setShippingInfo((prev) => ({ ...prev, [field]: value }))
  }

  const availableCities = useMemo(() => {
    return shippingInfo.state ? (NIGERIA_STATE_CITY_OPTIONS[shippingInfo.state] || []) : []
  }, [shippingInfo.state])

  // Calculate VAT at 7% of subtotal
  const calculateVAT = (amount: number) => {
    return Math.round(amount * 0.07)
  }

  // Format currency with commas
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-NG')
  }

  const subtotal = totalPrice
  const vat = calculateVAT(subtotal)
  const resolvedShipping = shippingEstimate && !shippingEstimate.hasTbd && Number.isFinite(Number(shippingEstimate.cost))
    ? Number(shippingEstimate.cost)
    : 0
  const shippingIsTbd = !shippingEstimate || Boolean(shippingEstimate.hasTbd)
  const total = subtotal + vat + resolvedShipping
  const checkoutPayableTotal = total
  const walletBalance = Number(userProfile?.walletBalance || 0)
  const walletShortfall = Math.max(0, Math.round((checkoutPayableTotal - walletBalance) * 100) / 100)
  const walletInsufficient = walletShortfall > 0

  const handleQuickWalletTopup = async () => {
    const amount = Math.round(Number(quickTopupAmount) * 100) / 100
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid top-up amount')
      return
    }

    try {
      setQuickTopupLoading(true)
      setError('')
      const response = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })

      const result = await response.json().catch(() => ({}))
      const authorizationUrl = result?.authorization_url || result?.authorizationUrl || result?.authorization_url_link
      if (!response.ok || !result?.success || !authorizationUrl) {
        throw new Error(result?.error || 'Unable to initialize wallet top-up')
      }

      window.location.href = String(authorizationUrl)
    } catch (err: any) {
      setError(err?.message || 'Failed to start wallet top-up')
    } finally {
      setQuickTopupLoading(false)
    }
  }

  useEffect(() => {
    if (checkoutTracked || items.length === 0) return
    setCheckoutTracked(true)

    const vendorIds = Array.from(new Set(items.map((item) => item.vendorId).filter(Boolean)))
    vendorIds.forEach((vendorId) => {
      void trackFunnelEvent(vendorId, "checkout_start", {
        itemCount: items.length,
        subtotal,
      })
    })
  }, [checkoutTracked, items, subtotal])

  useEffect(() => {
    const hasAddressFields = Boolean(
      shippingInfo.address.trim() &&
      shippingInfo.city.trim() &&
      shippingInfo.state.trim() &&
      shippingInfo.country.trim()
    )

    if (!hasAddressFields || items.length === 0) {
      setShippingEstimate(null)
      return
    }

    const timer = setTimeout(async () => {
      try {
        setShippingLoading(true)
        const response = await fetch('/api/delivery/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerAddress: {
              address: shippingInfo.address,
              city: shippingInfo.city,
              state: shippingInfo.state,
              country: shippingInfo.country,
            },
            items: items.map((item) => ({
              vendorId: item.vendorId,
              productId: item.productId,
            })),
          }),
        })

        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result?.success) {
          setShippingEstimate(null)
          return
        }

        const estimate = result?.estimate
        if (estimate && Number.isFinite(Number(estimate.cost))) {
          setShippingEstimate({
            cost: Number(estimate.cost),
            hasTbd: Boolean(estimate.hasTbd),
            source: String(estimate.source || ''),
          })
        } else {
          setShippingEstimate(null)
        }
      } catch {
        setShippingEstimate(null)
      } finally {
        setShippingLoading(false)
      }
    }, 450)

    return () => clearTimeout(timer)
  }, [items, shippingInfo.address, shippingInfo.city, shippingInfo.state, shippingInfo.country])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    console.log("Shipping info on submit:", shippingInfo)

    try {
      if (paymentMethod === 'wallet') {
        if (walletInsufficient) {
          setQuickTopupAmount(String(walletShortfall > 0 ? walletShortfall : checkoutPayableTotal))
          setShowWalletTopupPrompt(true)
          throw new Error('Insufficient wallet balance. Please top up your wallet to place this order.')
        }
      }

      // Validation with better error messages
      const requiredShippingFields = ["firstName", "lastName", "email", "phone", "address", "city", "state", "deliveryInstructions"]
      const missingFields = []
      
      for (const field of requiredShippingFields) {
        const value = shippingInfo[field as keyof typeof shippingInfo]
        if (!value || value.trim() === "") {
          missingFields.push(field.replace(/([A-Z])/g, " $1").toLowerCase())
        }
      }
      
      if (missingFields.length > 0) {
        throw new Error(`Please fill in the following required fields: ${missingFields.join(", ")}`)
      }

      // Validate cart and user
      if (!user) {
        throw new Error("Please login to continue with checkout")
      }

      if (items.length === 0) {
        throw new Error("Your cart is empty. Please add items before checking out.")
      }

      console.log("Cart items:", items)
      console.log("User:", user?.uid)

      const fullPhoneNumber = formatPhoneWithCountryCode(shippingInfo.phoneCountryCode, shippingInfo.phone)
      if (!fullPhoneNumber) {
        throw new Error("Please provide a valid phone number")
      }

      // Prepare order data for payment initialization
      const orderData = {
        customerId: user?.uid || '',
        customerEmail: shippingInfo.email || '',
        paymentMethod: paymentMethod || 'wallet',
        items: Array.isArray(items) && items.length > 0 ? items.map(item => ({
          productId: item.productId,
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          vendorId: item.vendorId,
          vendorName: item.vendorName
        })) : [],
        shippingInfo: {
          firstName: shippingInfo.firstName || '',
          lastName: shippingInfo.lastName || '',
          email: shippingInfo.email || '',
          phone: fullPhoneNumber || '',
          address: shippingInfo.address || '',
          city: shippingInfo.city || '',
          state: shippingInfo.state || '',
          zipCode: shippingInfo.zipCode || '',
          country: shippingInfo.country || '',
          deliveryInstructions: typeof shippingInfo.deliveryInstructions === 'string' ? shippingInfo.deliveryInstructions.trim() : '',
        },
        subtotal: subtotal || 0,
        vat: vat || 0,
        shipping: resolvedShipping || 0,
        totalAmount: total || 0
      }
      console.log('DEBUG orderData:', JSON.stringify(orderData, null, 2))

      // Initialize payment
      console.log('Sending order data:', orderData)
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      })

      const rawResult = await response.text()
      let result: any = {}

      if (rawResult) {
        try {
          result = JSON.parse(rawResult)
        } catch {
          result = { message: rawResult }
        }
      }

      console.log('Payment initialization result:', {
        status: response.status,
        ok: response.ok,
        result,
      })

      if (!response.ok) {
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          result,
        })

        const fallbackMessage = `Failed to initialize payment (HTTP ${response.status})`
        throw new Error(result.error || result.message || fallbackMessage)
      }
      
      if (paymentMethod === 'wallet') {
        if (!result.success) {
          throw new Error(result.error || 'Wallet payment failed')
        }
        await refreshProfile()
        await clearCart()
        router.push('/order-confirmation?orderId=' + encodeURIComponent(result.orderId || ''))
        return
      } else {
        // Normal checkout (e.g. card)
        const authorizationUrl = result?.authorization_url || result?.authorizationUrl || result?.authorization_url_link
      if (!authorizationUrl) {
          throw new Error('No authorization URL received from payment service')
        }
        const { authorization_url } = result
        window.location.href = authorization_url
        return
      }
    } catch (error: any) {
      console.error('Payment initialization error:', error)
      setError(error.message || "Failed to process order")
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 container mx-auto px-4 py-16">
            <div className="max-w-2xl mx-auto text-center">
              <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
              <p className="text-muted-foreground mb-8">Add some items to your cart before checking out.</p>
              <Button asChild size="lg" className="hover:bg-accent/90 hover:scale-105 transition-all">
                <Link href="/stores">Continue Shopping</Link>
              </Button>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 pb-28 md:pb-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-8 animate-fade-in">
              <Button variant="ghost" size="icon" asChild className="hover:scale-110 hover:bg-accent/10 transition-all">
                <Link href="/cart">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-3xl font-bold" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>Checkout</h1>
            </div>

            <form id="checkout-form" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Checkout Form */}
                <div className="space-y-6">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Shipping Information */}
                  <Card className="animate-scale-in" style={{ animationDelay: '0.1s' }}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-accent" />
                        1. Contact and Delivery Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name *</Label>
                          <Input
                            id="firstName"
                            value={shippingInfo.firstName}
                            onChange={(e) => handleInputChange("firstName", e.target.value)}
                            required
                            disabled={loading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name *</Label>
                          <Input
                            id="lastName"
                            value={shippingInfo.lastName}
                            onChange={(e) => handleInputChange("lastName", e.target.value)}
                            required
                            disabled={loading}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-1">
                        <div className="space-y-2 col-span-2 sm:col-span-1">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={shippingInfo.email}
                            onChange={(e) => handleInputChange("email", e.target.value)}
                            required
                            disabled={loading}
                          />
                        </div>
                        <div className="space-y-2 col-span-2 sm:col-span-1">
                          <Label htmlFor="phone">Phone *</Label>
                          <div className="grid grid-cols-[90px_1fr] gap-2 sm:grid-cols-[110px_1fr]">
                            <Select
                              value={shippingInfo.phoneCountryCode}
                              onValueChange={(value) => handleInputChange("phoneCountryCode", value)}
                              disabled={loading}
                            >
                              <SelectTrigger
                                id="phoneCountryCode"
                                className="min-w-0 w-full max-w-[90px] sm:max-w-[110px] text-[11px] sm:text-xs px-1 py-1"
                              >
                                <SelectValue placeholder="Code" />
                              </SelectTrigger>
                              <SelectContent>
                                {COUNTRY_CODES.map((item) => (
                                  <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              id="phone"
                              type="tel"
                              value={shippingInfo.phone}
                              onChange={(e) => handleInputChange("phone", e.target.value)}
                              required
                              disabled={loading}
                              className="min-w-0 w-full px-3 py-2 text-base tracking-widest"
                              inputMode="numeric"
                              maxLength={13}
                              style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.08em' }}
                              placeholder="8012345678"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="address">Address *</Label>
                        <Input
                          id="address"
                          value={shippingInfo.address}
                          onChange={(e) => handleInputChange("address", e.target.value)}
                          required
                          disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground">Type your full delivery address.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="state">State *</Label>
                          <Select
                            value={shippingInfo.state}
                            onValueChange={(value) => {
                              handleInputChange("state", value)
                              handleInputChange("city", "")
                            }}
                            disabled={loading}
                          >
                            <SelectTrigger id="state">
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
                          <Label htmlFor="city">City *</Label>
                          <Select
                            value={shippingInfo.city}
                            onValueChange={(value) => handleInputChange("city", value)}
                            disabled={loading || !shippingInfo.state}
                          >
                            <SelectTrigger id="city">
                              <SelectValue placeholder={shippingInfo.state ? "Select city" : "Select state first"} />
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
                        Select state first, then select city.
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="zipCode">ZIP Code (optional)</Label>
                          <Input
                            id="zipCode"
                            value={shippingInfo.zipCode}
                            onChange={(e) => handleInputChange("zipCode", e.target.value)}
                            disabled={loading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="country">Country *</Label>
                          <Select
                            value={shippingInfo.country}
                            onValueChange={(value) => handleInputChange("country", value)}
                            disabled
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Nigeria">Nigeria</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="deliveryInstructions">Delivery Instructions *</Label>
                        <Textarea
                          id="deliveryInstructions"
                          value={shippingInfo.deliveryInstructions}
                          onChange={(e) => handleInputChange("deliveryInstructions", e.target.value)}
                          disabled={loading}
                          rows={4}
                          placeholder="Landmark or drop-off note for rider"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Delivery instruction is required (use nearest landmark / gate note).
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Payment Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        2. Payment
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="mb-2">
                        <Label className="block mb-2 font-semibold text-base">Choose payment method</Label>
                        <div className="flex gap-4">
                          <button
                            type="button"
                            className={`flex-1 border rounded-lg p-4 flex flex-col items-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/60 focus:border-accent/60 shadow-sm
                              ${paymentMethod === 'wallet' ? 'border-accent bg-accent/10 ring-2 ring-accent/60' : 'border-muted bg-white hover:border-accent/40'}`}
                            onClick={() => setPaymentMethod('wallet')}
                            aria-pressed={paymentMethod === 'wallet'}
                          >
                            <Shield className="h-6 w-6 mb-1 text-accent" />
                            <span className="font-medium">Wallet</span>
                            <span className="text-xs text-muted-foreground mt-1">Pay instantly from your wallet balance</span>
                          </button>
                          <button
                            type="button"
                            className={`flex-1 border rounded-lg p-4 flex flex-col items-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/60 focus:border-accent/60 shadow-sm
                              ${paymentMethod === 'checkout' ? 'border-accent bg-accent/10 ring-2 ring-accent/60' : 'border-muted bg-white hover:border-accent/40'}`}
                            onClick={() => setPaymentMethod('checkout')}
                            aria-pressed={paymentMethod === 'checkout'}
                          >
                            <CreditCard className="h-6 w-6 mb-1 text-accent" />
                            <span className="font-medium">Card / Bank</span>
                            <span className="text-xs text-muted-foreground mt-1">Pay securely with card or bank</span>
                          </button>
                        </div>
                      </div>
                      {paymentMethod === 'wallet' && (
                        <div className="rounded-lg border border-accent/35 p-3 bg-accent/10 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-foreground">Wallet payment</p>
                            <Shield className="h-4 w-4 text-accent" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Available wallet balance: ₦{formatCurrency(walletBalance)}
                          </p>
                          {walletInsufficient ? (
                            <Alert variant="destructive" className="mt-3">
                              <AlertDescription>
                                Insufficient wallet balance. You need ₦{formatCurrency(walletShortfall)} more to place this order.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <p className="text-xs text-green-700 mt-2">Sufficient balance available for this order.</p>
                          )}
                        </div>
                      )}
                      {paymentMethod === 'checkout' && (
                        <div className="rounded-lg border border-accent/35 p-3 bg-accent/10 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-foreground">Pay with Card/Bank</p>
                            <CreditCard className="h-4 w-4 text-accent" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            You will be redirected to a secure payment page to complete your order.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Order Summary */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Order Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div key={item.productId} className="flex items-center space-x-3">
                            <div className="relative h-12 w-12 rounded-md overflow-hidden bg-muted">
                              <Image
                                src={item.image || "/placeholder.svg"}
                                alt={item.title}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium line-clamp-1">{item.title}</p>
                              <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                            </div>
                            <p className="text-sm font-medium">₦{formatCurrency(item.price * item.quantity)}</p>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>₦{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Shipping</span>
                          <span className="text-muted-foreground">
                            {shippingLoading
                              ? 'Calculating...'
                              : shippingIsTbd
                                ? 'TBD'
                                : `₦${formatCurrency(resolvedShipping)}`}
                          </span>
                        </div>
                        {shippingIsTbd ? (
                          <div className="text-xs text-muted-foreground mt-1">
                            *Delivery fee will be finalized for unmatched routes.
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground mt-1">
                            *Calculated from A&CO route rates via mapped address.
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>VAT</span>
                          <span>₦{formatCurrency(vat)}</span>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-1">
                        <div className="flex justify-between text-lg font-semibold">
                          <span>Total</span>
                          <span>₦{formatCurrency(total)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          {shippingIsTbd
                            ? '*Delivery fee not yet determined for at least one route.'
                            : '*Delivery fee included in total.'}
                        </div>
                      </div>

                      <div className="pt-4 hidden md:block">
                        <Button type="submit" className="w-full border border-accent/40 bg-white text-accent hover:bg-accent hover:text-white hover:scale-105 transition-all hover:shadow-lg" size="lg" disabled={loading}>
                          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {loading
                            ? "Processing..."
                            : paymentMethod === 'wallet'
                              ? `Pay with Wallet - ₦${formatCurrency(total)}`
                              : `Pay with Card/Bank - ₦${formatCurrency(total)}`}
                        </Button>
                      </div>

                      <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                        <Shield className="h-4 w-4" />
                        <span>Secure checkout with 256-bit SSL encryption</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.10)]">
                <div className="container mx-auto max-w-6xl flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Payable now</p>
                    <p className="text-base font-bold text-neutral-900">₦{formatCurrency(total)}</p>
                    <p className="text-[10px] text-muted-foreground">Wallet checkout</p>
                  </div>
                  <Button type="submit" className="h-10 px-4 shrink-0 shadow-sm" disabled={loading}>
                    {loading
                      ? "Processing..."
                      : paymentMethod === 'wallet'
                        ? `Pay with Wallet - ₦${formatCurrency(total)}`
                        : `Pay with Card/Bank - ₦${formatCurrency(total)}`}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </main>

        <Dialog open={showWalletTopupPrompt} onOpenChange={setShowWalletTopupPrompt}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Top up wallet to place order</DialogTitle>
              <DialogDescription>
                Your wallet is short by ₦{formatCurrency(walletShortfall)}. Top up now to continue checkout.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Alert>
                <AlertDescription>
                  Add funds to your wallet, then return to checkout to place this order.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="quickTopupAmount">Top-up amount</Label>
                <Input
                  id="quickTopupAmount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={quickTopupAmount}
                  onChange={(e) => setQuickTopupAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWalletTopupPrompt(false)} disabled={quickTopupLoading}>
                Close
              </Button>
              <Button onClick={handleQuickWalletTopup} disabled={quickTopupLoading}>
                {quickTopupLoading ? 'Redirecting...' : 'Top up wallet'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}
