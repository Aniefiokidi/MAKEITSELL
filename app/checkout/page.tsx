"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useCart } from "@/contexts/CartContext"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, CreditCard, Truck, Shield, Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import Header from "@/components/Header"
import ProtectedRoute from "@/components/auth/ProtectedRoute"

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart()
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [paymentMethod] = useState("paystack") // Default to Paystack for Nigerian marketplace

  const [shippingInfo, setShippingInfo] = useState({
    firstName: "",
    lastName: "",
    email: user?.email || "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "Nigeria",
  })

  const handleInputChange = (field: string, value: string) => {
    setShippingInfo((prev) => ({ ...prev, [field]: value }))
  }

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
  const shipping = 0 // Free shipping
  const total = subtotal + vat + shipping

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    console.log("Shipping info on submit:", shippingInfo)

    try {
      // Validation with better error messages
      const requiredShippingFields = ["firstName", "lastName", "email", "phone", "address", "city", "state", "zipCode"]
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

      // Prepare order data for payment initialization
      const orderData = {
        customerId: user?.uid!,
        customerEmail: shippingInfo.email,
        paymentMethod,
        items: items.map(item => ({
          productId: item.productId,
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          vendorId: item.vendorId,
          vendorName: item.vendorName
        })),
        shippingInfo: {
          firstName: shippingInfo.firstName,
          lastName: shippingInfo.lastName,
          email: shippingInfo.email,
          phone: shippingInfo.phone,
          address: shippingInfo.address,
          city: shippingInfo.city,
          state: shippingInfo.state,
          zipCode: shippingInfo.zipCode,
          country: shippingInfo.country
        },
        subtotal,
        vat,
        shipping,
        totalAmount: total
      }

      // Initialize payment
      console.log('Sending order data:', orderData)
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('API Error Response:', errorData)
        throw new Error(errorData.error || 'Failed to initialize payment')
      }

      const result = await response.json()
      console.log('Payment initialization result:', result)
      console.log('Authorization URL:', result.authorization_url)
      
      if (!result.authorization_url) {
        throw new Error('No authorization URL received from payment service')
      }
      
      const { authorization_url } = result

      console.log('Redirecting to:', authorization_url)
      // Redirect to Paystack payment page
      window.location.href = authorization_url
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
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-8 animate-fade-in">
              <Button variant="ghost" size="icon" asChild className="hover:scale-110 hover:bg-accent/10 transition-all">
                <Link href="/cart">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-3xl font-bold" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>Checkout</h1>
            </div>

            <form onSubmit={handleSubmit}>
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
                        Shipping Information
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

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
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
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone *</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={shippingInfo.phone}
                            onChange={(e) => handleInputChange("phone", e.target.value)}
                            required
                            disabled={loading}
                          />
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
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">City *</Label>
                          <Input
                            id="city"
                            value={shippingInfo.city}
                            onChange={(e) => handleInputChange("city", e.target.value)}
                            required
                            disabled={loading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State *</Label>
                          <Input
                            id="state"
                            value={shippingInfo.state}
                            onChange={(e) => handleInputChange("state", e.target.value)}
                            required
                            disabled={loading}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="zipCode">ZIP Code *</Label>
                          <Input
                            id="zipCode"
                            value={shippingInfo.zipCode}
                            onChange={(e) => handleInputChange("zipCode", e.target.value)}
                            required
                            disabled={loading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="country">Country *</Label>
                          <Select
                            value={shippingInfo.country}
                            onValueChange={(value) => handleInputChange("country", value)}
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
                    </CardContent>
                  </Card>

                  {/* Payment Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Payment Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                        <Shield className="h-4 w-4 text-green-600" />
                        <div className="text-center">
                          <p className="font-medium text-foreground">Secure Payment with Paystack</p>
                          <p className="text-xs">You will be redirected to complete your payment securely</p>
                        </div>
                      </div>
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
                          <span className="text-muted-foreground">TBD</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          *Rider will inform you of delivery cost
                        </div>
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
                          *Excluding delivery fee (to be determined by rider)
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button type="submit" className="w-full hover:bg-accent/80 hover:scale-105 transition-all hover:shadow-lg" size="lg" disabled={loading}>
                          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {loading ? "Processing..." : `Place Order - ₦${formatCurrency(total)}`}
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
            </form>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
