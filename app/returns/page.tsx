import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, ShieldAlert, Package, Info } from "lucide-react"
import Header from "@/components/Header"

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
            <h1 className="text-3xl font-bold mb-4">Returns & Refunds Policy</h1>
            <p className="text-muted-foreground">
              Please read our policy carefully before making a purchase.
            </p>
          </div>

          {/* Alert Banner */}
          <Card className="mb-8 border-yellow-200 bg-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <ShieldAlert className="w-8 h-8 text-yellow-600 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-lg mb-2 text-yellow-900">No Return Policy</h3>
                  <p className="text-yellow-800">
                    Make It Sell operates under a <strong>strict no-return policy</strong>. All sales are final. 
                    Please ensure you carefully review product details, specifications, and images before completing your purchase.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Policy Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Our Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-3">Why No Returns?</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    As a marketplace connecting multiple vendors with customers, we maintain a no-return policy to ensure:
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                      <span>Competitive pricing by reducing logistics costs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                      <span>Product authenticity and quality control</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                      <span>Fair treatment for all vendors on our platform</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                      <span>Faster delivery times and better service</span>
                    </li>
                  </ul>
                </div>
                
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Important Notice</h4>
                  <p className="text-sm text-muted-foreground">
                    By completing a purchase on Make It Sell, you acknowledge and agree to this no-return policy. 
                    We encourage you to contact vendors directly if you have questions about products before purchasing.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Exceptions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Limited Exceptions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-3">We will ONLY accept returns for:</h4>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-red-900">Damaged Items</strong>
                        <p className="text-red-800 mt-1">Items that arrive physically damaged during shipping</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-red-900">Defective Products</strong>
                        <p className="text-red-800 mt-1">Items that are proven to be defective or not working as described</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-red-900">Wrong Item Received</strong>
                        <p className="text-red-800 mt-1">If you received a completely different item than what was ordered</p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Claim Process</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    For damage or defect claims, you must:
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>1. Contact us within <strong>24 hours</strong> of delivery</li>
                    <li>2. Provide clear photos of the damage/defect</li>
                    <li>3. Include your order number and description</li>
                    <li>4. Keep all original packaging</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* What You Cannot Return */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                What Cannot Be Returned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">No returns accepted for:</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• Change of mind or buyer's remorse</li>
                    <li>• Wrong size or color selection</li>
                    <li>• Items not matching personal expectations</li>
                    <li>• Price differences after purchase</li>
                    <li>• Items purchased during sales or promotions</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Absolutely no returns on:</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• Personal care and hygiene products</li>
                    <li>• Perishable goods</li>
                    <li>• Custom or personalized items</li>
                    <li>• Digital products and downloads</li>
                    <li>• Gift cards or vouchers</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips for Shopping */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Shop Smart - Tips Before You Buy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h5 className="font-semibold mb-2 text-blue-900">Read Descriptions</h5>
                  <p className="text-sm text-blue-800">
                    Carefully review all product details, specifications, and sizing information
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h5 className="font-semibold mb-2 text-green-900">Check Images</h5>
                  <p className="text-sm text-green-800">
                    View all product images and zoom in to see details clearly
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h5 className="font-semibold mb-2 text-purple-900">Contact Vendor</h5>
                  <p className="text-sm text-purple-800">
                    Ask vendors questions before purchasing if you're uncertain about anything
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Section */}
          <div className="mt-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Received a Damaged or Defective Item?</h3>
            <p className="text-muted-foreground mb-4">
              Contact our support team within 24 hours with photos and your order details.
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
    </>
  )
}