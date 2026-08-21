"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Package, Truck, CreditCard } from "lucide-react"
import Header from "@/components/Header"
import { useCart } from "@/contexts/CartContext"

export default function OrderConfirmationPage() {
  const { clearCart, removeItems } = useCart()
  const router = useRouter()

  useEffect(() => {
    // A card/Paystack payment is an off-site redirect — checkout/page.tsx stashes which
    // product ids were actually being purchased in sessionStorage before leaving, since
    // no in-memory cart-selection state survives that round trip (see
    // app/checkout/page.tsx's window.location.href branch). Remove only those, leaving
    // anything the buyer deliberately left unchecked still in their cart. Falls back to
    // a full clearCart() when that key is missing — e.g. a stale bookmark, or a payment
    // path that doesn't set it — matching this page's old unconditional behavior.
    const cleanUpCartAsync = async () => {
      let purchasedProductIds: string[] | null = null
      try {
        const raw = sessionStorage.getItem('makeitsell_last_checkout_product_ids')
        if (raw) {
          purchasedProductIds = JSON.parse(raw)
          sessionStorage.removeItem('makeitsell_last_checkout_product_ids')
        }
      } catch {}

      try {
        if (purchasedProductIds && purchasedProductIds.length > 0) {
          await removeItems(purchasedProductIds)
        } else {
          await clearCart()
        }
      } catch (error) {
        console.error('Error cleaning up cart from order confirmation page:', error)
      }
    }

    // Add a small delay to ensure all contexts are loaded
    setTimeout(cleanUpCartAsync, 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Order Confirmed!</h1>
            <p className="text-muted-foreground text-lg">
              Thank you for your purchase. Your order has been successfully placed and is being processed.
            </p>
          </div>

          <Card className="text-left mb-8">
            <CardHeader>
              <CardTitle>What happens next?</CardTitle>
              <CardDescription>Here's what you can expect</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                  <CreditCard className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">Payment Processed</h3>
                  <p className="text-sm text-muted-foreground">Your payment has been securely processed</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                  <Package className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">Order Processing</h3>
                  <p className="text-sm text-muted-foreground">Vendors are preparing your items for shipment</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">Shipping Updates</h3>
                  <p className="text-sm text-muted-foreground">You'll receive tracking information via email</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild variant="outline" className="border-accent/60 text-accent hover:bg-accent hover:text-accent-foreground hover:scale-105 transition-all hover:shadow-lg">
              <Link href="/order">View Order Status</Link>
            </Button>
            <Button variant="outline" asChild className="border-accent/60 text-accent hover:bg-accent hover:text-accent-foreground hover:scale-105 transition-all hover:shadow-lg">
              <Link href="/stores">Continue Shopping</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
