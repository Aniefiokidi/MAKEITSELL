import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Truck, Package, MapPin, Info, AlertCircle, CheckCircle } from "lucide-react"
import Header from "@/components/Header"

export default function ShippingPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <nav className="text-[9px] xs:text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
              <Link href="/" className="hover:text-primary">Home</Link>
              <span className="mx-1.5 sm:mx-2">/</span>
              <span>Shipping Information</span>
            </nav>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 sm:mb-4">Shipping Information</h1>
            <p className="text-muted-foreground text-[10px] xs:text-xs sm:text-sm">
              Learn how shipping works on Make It Sell marketplace.
            </p>
          </div>

          {/* Important Notice */}
          <Card className="mb-6 sm:mb-8 border-blue-200 bg-blue-50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <Info className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-sm sm:text-lg mb-2 text-blue-900">Vendor-Managed Shipping</h3>
                  <p className="text-blue-800 text-xs sm:text-sm">
                    Make It Sell is a marketplace platform connecting buyers with independent vendors. 
                    <strong> Each vendor manages their own shipping</strong> including rates, methods, and delivery times. 
                    We track all shipments to ensure transparency and accountability.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* How Shipping Works */}
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                  <Truck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  How Shipping Works
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">1</div>
                    <div>
                      <h5 className="font-medium text-sm sm:text-base">Shop from Vendors</h5>
                      <p className="text-xs sm:text-sm text-muted-foreground">Browse products from different vendors on our marketplace</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <div>
                      <h5 className="font-medium text-sm sm:text-base">Check Shipping Details</h5>
                      <p className="text-xs sm:text-sm text-muted-foreground">Each product shows vendor-specific shipping costs and estimated delivery</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">3</div>
                    <div>
                      <h5 className="font-medium text-sm sm:text-base">Vendor Ships Your Order</h5>
                      <p className="text-xs sm:text-sm text-muted-foreground">The vendor processes and ships your order using their preferred carrier</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">4</div>
                    <div>
                      <h5 className="font-medium text-sm sm:text-base">We Track Everything</h5>
                      <p className="text-xs sm:text-sm text-muted-foreground">Make It Sell monitors shipment status and keeps you updated</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Varies by Vendor */}
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  Shipping Details Vary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-xs sm:text-base mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      What Varies by Vendor
                    </h4>
                    <ul className="space-y-1 text-xs sm:text-sm text-muted-foreground pl-6">
                      <li>• Shipping costs and rates</li>
                      <li>• Delivery timeframes</li>
                      <li>• Available shipping methods</li>
                      <li>• Geographic coverage areas</li>
                      <li>• Free shipping thresholds (if any)</li>
                      <li>• Packaging and handling</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-xs sm:text-base mb-2 flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-600" />
                      Before You Order
                    </h4>
                    <ul className="space-y-1 text-xs sm:text-sm text-muted-foreground pl-6">
                      <li>• Review shipping costs during checkout</li>
                      <li>• Check estimated delivery dates</li>
                      <li>• Verify vendor ships to your location</li>
                      <li>• Contact vendor with shipping questions</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Platform Tracking */}
          <Card className="mt-6 sm:mt-8">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                Order Tracking on Make It Sell
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <div className="mb-4 sm:mb-6">
                <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                  While vendors handle shipping logistics, Make It Sell tracks all orders to ensure transparency 
                  and protect both buyers and sellers.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <span className="font-bold text-sm sm:text-base">1</span>
                  </div>
                  <h5 className="font-medium text-xs sm:text-sm mb-1">Order Placed</h5>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Confirmation email sent</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <span className="font-bold text-sm sm:text-base">2</span>
                  </div>
                  <h5 className="font-medium text-xs sm:text-sm mb-1">Vendor Processing</h5>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Preparing your order</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <span className="font-bold text-sm sm:text-base">3</span>
                  </div>
                  <h5 className="font-medium text-xs sm:text-sm mb-1">Shipped</h5>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Tracking number provided</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <span className="font-bold text-sm sm:text-base">4</span>
                  </div>
                  <h5 className="font-medium text-xs sm:text-sm mb-1">Delivered</h5>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Arrives at your door</p>
                </div>
              </div>
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <p className="text-xs sm:text-sm text-center">
                  <strong>Track your orders:</strong> View real-time updates in your{" "}
                  <Link href="/order" className="text-primary hover:underline">Order History</Link>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Common Shipping Info */}
          <Card className="mt-6 sm:mt-8">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">Common Shipping Information</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 text-sm sm:text-base">Typical Delivery Times (Nigeria)</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                    Most vendors shipping within Nigeria offer:
                  </p>
                  <ul className="text-xs sm:text-sm space-y-1.5">
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[9px] sm:text-xs shrink-0">Lagos</Badge>
                      <span className="text-muted-foreground">1-3 business days</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[9px] sm:text-xs shrink-0">Major Cities</Badge>
                      <span className="text-muted-foreground">2-5 business days</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[9px] sm:text-xs shrink-0">Other Areas</Badge>
                      <span className="text-muted-foreground">3-7 business days</span>
                    </li>
                  </ul>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-3 italic">
                    *Times vary by vendor and location
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 text-sm sm:text-base">Important Notes</h4>
                  <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                      <span>Shipping costs are calculated at checkout</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                      <span>Some vendors offer free shipping on orders above certain amounts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                      <span>International shipping availability varies by vendor</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                      <span>Contact vendors directly for bulk or custom shipping needs</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Issues */}
          <Card className="mt-6 sm:mt-8 border-orange-200 bg-orange-50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-sm sm:text-lg mb-2 text-orange-900">Shipping Problems?</h3>
                  <p className="text-orange-800 text-xs sm:text-sm mb-3">
                    If you experience issues with shipping such as delays, damage, or non-delivery:
                  </p>
                  <ul className="text-orange-800 text-xs sm:text-sm space-y-1 pl-4">
                    <li>1. First, contact the vendor directly through your order page</li>
                    <li>2. Check tracking information for updates</li>
                    <li>3. If unresolved, contact Make It Sell support for assistance</li>
                  </ul>
                  <p className="text-orange-800 text-xs sm:text-sm mt-3">
                    We monitor all shipments and will help mediate any shipping disputes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <div className="mt-6 sm:mt-8 text-center">
            <h3 className="text-base sm:text-lg font-semibold mb-2">Questions About Shipping?</h3>
            <p className="text-muted-foreground mb-4 text-xs sm:text-sm">
              For specific shipping information, contact the vendor. For general assistance, reach out to our support team.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/support">
                <button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm">
                  Contact Support
                </button>
              </Link>
              <Link href="/stores">
                <button className="bg-secondary text-secondary-foreground px-6 py-2 rounded-lg hover:bg-secondary/90 transition-colors text-sm">
                  Browse Vendors
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}