"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Package, Truck, CreditCard } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useCart } from "@/contexts/CartContext"

export default function OrderConfirmationPage() {
  const { clearCart, items } = useCart()
  const router = useRouter()

  useEffect(() => {
    // Clear the cart when landing on order confirmation page
    const clearCartAsync = async () => {
      console.log('Order confirmation page loaded, clearing cart...')
      console.log('Current cart items:', items)
      console.log('Available clearCart function:', typeof clearCart)
      try {
        await clearCart()
        console.log('Cart cleared successfully from order confirmation page')
        console.log('Cart items after clearing:', items)
      } catch (error) {
        console.error('Error clearing cart from order confirmation page:', error)
      }
    }
    
    // Add a small delay to ensure all contexts are loaded
    setTimeout(clearCartAsync, 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearCart])

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
            <Button asChild className="hover:bg-accent/50 hover:text-white hover:scale-105 transition-all hover:shadow-lg">
              <Link href="/order">View Order Status</Link>
            </Button>
            <Button variant="outline" asChild className="hover:bg-accent/10 hover:text-accent transition-all">
              <Link href="/stores">Continue Shopping</Link>
            </Button>
            {/* Debug button - remove in production */}
            <Button 
              onClick={async () => {
                console.log('Manual cart clear triggered, current items:', items)
                await clearCart()
                console.log('Manual cart clear completed, items now:', items)
              }}
              variant="ghost" 
              size="sm"
              className="text-xs opacity-50"
            >
              Clear Cart (Debug)
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
