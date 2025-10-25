import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Package, Clock, Shield, AlertCircle, CheckCircle } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

export default function ReturnsPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <nav className="text-sm text-muted-foreground mb-4">
              <Link href="/" className="hover:text-primary">Home</Link>
              <span className="mx-2">/</span>
              <span>Returns & Refunds</span>
            </nav>
            <h1 className="text-3xl font-bold mb-4">Returns & Refunds</h1>
            <p className="text-muted-foreground">
              We want you to be completely satisfied with your purchase. Learn about our hassle-free return policy.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6 text-center">
                <Clock className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">30-Day Returns</h3>
                <p className="text-sm text-muted-foreground">Return most items within 30 days of delivery</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <RefreshCw className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Free Returns</h3>
                <p className="text-sm text-muted-foreground">Free return shipping on eligible items</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Shield className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Buyer Protection</h3>
                <p className="text-sm text-muted-foreground">Your purchases are protected</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Return Policy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Return Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">What can be returned?</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>Most new, unopened items within 30 days</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>Items in original packaging</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>Items with all accessories and documentation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                      <span>Some items have different return policies (see exclusions)</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Return Timeline</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="text-sm">Request return</span>
                      <Badge variant="outline">Within 30 days</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="text-sm">Ship item back</span>
                      <Badge variant="outline">Within 5 days</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="text-sm">Refund processed</span>
                      <Badge variant="outline">3-5 business days</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* How to Return */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  How to Return Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">1</div>
                    <div>
                      <h5 className="font-medium">Start a Return Request</h5>
                      <p className="text-sm text-muted-foreground">Go to your order history and select "Return Item"</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <div>
                      <h5 className="font-medium">Print Return Label</h5>
                      <p className="text-sm text-muted-foreground">Print the prepaid return shipping label we provide</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">3</div>
                    <div>
                      <h5 className="font-medium">Pack and Ship</h5>
                      <p className="text-sm text-muted-foreground">Pack item securely and drop off at any carrier location</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">4</div>
                    <div>
                      <h5 className="font-medium">Get Refunded</h5>
                      <p className="text-sm text-muted-foreground">Refund issued once we receive and process your return</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t">
                  <Button className="w-full">
                    Start a Return
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Need help? Contact our support team
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Exclusions */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Return Exclusions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Items that cannot be returned:</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• Perishable goods (food, flowers, etc.)</li>
                    <li>• Personal care items</li>
                    <li>• Custom or personalized items</li>
                    <li>• Digital products and downloads</li>
                    <li>• Gift cards</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Special return policies:</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• Electronics: 15-day return window</li>
                    <li>• Clothing: Must have tags attached</li>
                    <li>• Jewelry: Special authentication required</li>
                    <li>• Large items: May require special pickup</li>
                    <li>• International orders: Extended processing time</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h5 className="font-medium mb-2">When will I receive my refund?</h5>
                  <p className="text-sm text-muted-foreground">
                    Refunds are typically processed within 3-5 business days after we receive your returned item. 
                    The refund will be issued to your original payment method.
                  </p>
                </div>
                <div>
                  <h5 className="font-medium mb-2">Can I exchange an item instead of returning it?</h5>
                  <p className="text-sm text-muted-foreground">
                    Yes! During the return process, you can choose to exchange for a different size, color, or model 
                    instead of receiving a refund.
                  </p>
                </div>
                <div>
                  <h5 className="font-medium mb-2">What if my item arrived damaged?</h5>
                  <p className="text-sm text-muted-foreground">
                    If your item arrived damaged or defective, please contact us immediately. We'll provide a 
                    prepaid return label and expedite your replacement or refund.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Section */}
          <div className="mt-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Need Help with Your Return?</h3>
            <p className="text-muted-foreground mb-4">
              Our customer service team is here to help you with any questions about returns or refunds.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="outline" asChild>
                <Link href="/support">Contact Support</Link>
              </Button>
              <Button asChild>
                <Link href="/order">View My Orders</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}