import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Truck, Clock, MapPin, Package, Globe, Zap } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

export default function ShippingPage() {
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
              <span>Shipping Information</span>
            </nav>
            <h1 className="text-3xl font-bold mb-4">Shipping Information</h1>
            <p className="text-muted-foreground">
              Fast, reliable shipping options to get your orders delivered quickly and safely.
            </p>
          </div>

          {/* Shipping Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="border-2 border-primary">
              <CardContent className="p-6 text-center">
                <Zap className="w-12 h-12 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Express Shipping</h3>
                <p className="text-2xl font-bold text-primary mb-2">1-2 Days</p>
                <p className="text-sm text-muted-foreground mb-3">Get your order fast</p>
                <Badge variant="secondary">₦5,000</Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <Truck className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Standard Shipping</h3>
                <p className="text-2xl font-bold text-blue-500 mb-2">3-5 Days</p>
                <p className="text-sm text-muted-foreground mb-3">Most popular option</p>
                <Badge variant="secondary">₦2,500</Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <Package className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Economy Shipping</h3>
                <p className="text-2xl font-bold text-green-500 mb-2">5-7 Days</p>
                <p className="text-sm text-muted-foreground mb-3">Budget-friendly</p>
                <Badge variant="secondary">Free over ₦25</Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Shipping Rates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Shipping Rates & Zones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-3">Domestic Shipping (Nigeria)</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="font-medium">Express (1-2 days)</span>
                          <p className="text-sm text-muted-foreground">Next business day delivery</p>
                        </div>
                        <Badge variant="outline">₦5,000</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="font-medium">Standard (3-5 days)</span>
                          <p className="text-sm text-muted-foreground">Business days delivery</p>
                        </div>
                        <Badge variant="outline">₦2,500</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="font-medium">Economy (5-7 days)</span>
                          <p className="text-sm text-muted-foreground">Free over ₦15,000</p>
                        </div>
                        <Badge variant="outline">₦1,000</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3">International Shipping</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="font-medium">West Africa</span>
                          <p className="text-sm text-muted-foreground">7-14 business days</p>
                        </div>
                        <Badge variant="outline">₦12,000</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="font-medium">International</span>
                          <p className="text-sm text-muted-foreground">14-21 business days</p>
                        </div>
                        <Badge variant="outline">₦18,000</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Policies */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Shipping Policies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Processing Time</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Orders placed before 2 PM EST ship same day</li>
                      <li>• Custom items may require 1-3 business days</li>
                      <li>• Weekends and holidays may extend processing</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Delivery Options</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Signature required for orders over ₦50,000</li>
                      <li>• P.O. Box delivery available</li>
                      <li>• Hold for pickup at carrier locations</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Special Items</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Large items may require freight shipping</li>
                      <li>• Hazardous materials have restrictions</li>
                      <li>• Perishables ship via expedited methods only</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Free Shipping */}
          <Card className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
            <CardContent className="p-8">
              <div className="text-center">
                <Package className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Free Shipping on Orders ₦15,000+</h3>
                <p className="text-muted-foreground mb-4">
                  Get free economy shipping on all domestic orders over ₦15,000. No code needed!
                </p>
                <div className="flex justify-center space-x-4 text-sm">
                  <div className="flex items-center text-green-600">
                    <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                    No minimum order for members
                  </div>
                  <div className="flex items-center text-green-600">
                    <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                    Automatic at checkout
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* International Shipping */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                International Shipping
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Available Countries</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    We ship to over 100 countries worldwide. International shipping rates 
                    and delivery times vary by destination.
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>• Canada & Mexico: 7-14 business days</li>
                    <li>• Europe: 10-16 business days</li>
                    <li>• Asia Pacific: 12-20 business days</li>
                    <li>• Other regions: 14-21 business days</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Important Notes</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Customs duties and taxes may apply</li>
                    <li>• Delivery times are estimates</li>
                    <li>• Some items cannot be shipped internationally</li>
                    <li>• Address verification required</li>
                    <li>• Restricted items list available</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tracking */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Order Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="font-bold">1</span>
                  </div>
                  <h5 className="font-medium mb-1">Order Confirmed</h5>
                  <p className="text-sm text-muted-foreground">You'll receive an email confirmation</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="font-bold">2</span>
                  </div>
                  <h5 className="font-medium mb-1">Order Shipped</h5>
                  <p className="text-sm text-muted-foreground">Tracking number provided via email</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="font-bold">3</span>
                  </div>
                  <h5 className="font-medium mb-1">Delivered</h5>
                  <p className="text-sm text-muted-foreground">Package arrives at your address</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <div className="mt-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Questions About Shipping?</h3>
            <p className="text-muted-foreground mb-4">
              Need help with shipping options or have a special request? We're here to help.
            </p>
            <Link href="/support">
              <button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                Contact Support
              </button>
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}