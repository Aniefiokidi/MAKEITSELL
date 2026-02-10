import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Scale, Shield, AlertTriangle, Users, FileText, Gavel, Building, ShoppingCart, Truck, CreditCard, Home, ArrowLeft } from "lucide-react"
import Header from "@/components/Header"

export default function TermsPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8 max-w-5xl">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <nav className="text-[9px] xs:text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
              <Link href="/" className="hover:text-primary">Home</Link>
              <span className="mx-1 sm:mx-2">/</span>
              <span>Terms of Service</span>
            </nav>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4">
                  MAKE IT SELL — TERMS OF SERVICE
                </h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[8px] xs:text-[9px] sm:text-xs text-muted-foreground">
                  <span className="px-2 py-1 bg-muted/50 rounded text-[7px] xs:text-[8px] sm:text-xs">
                    Effective Date: 10 February 2026
                  </span>
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded text-[7px] xs:text-[8px] sm:text-xs">
                    Last Updated: 10 February 2026
                  </span>
                </div>
              </div>
              <Link href="/">
                <Button variant="outline" className="flex items-center gap-2 text-xs sm:text-sm">
                  <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>

          {/* Welcome Notice */}
          <Card className="mb-6 sm:mb-8 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <CardContent className="p-4 sm:p-6">
              <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground mb-3">
                Welcome to Make It Sell! These Terms of Service govern your use of our marketplace platform.
                By using our services, you agree to these terms.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[9px] xs:text-[10px] sm:text-xs text-blue-700">
                📋 <strong>Quick Summary:</strong> Make It Sell connects buyers and vendors. We facilitate transactions 
                but don't own most products. Users must comply with our rules and Nigerian law.
              </div>
            </CardContent>
          </Card>

          {/* Quick Navigation */}
          <Card className="mb-6 sm:mb-8">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-xl">Quick Navigation</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                <Link href="#definitions" className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <FileText className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs">Definitions</span>
                </Link>
                <Link href="#marketplace-role" className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Building className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs">Our Role</span>
                </Link>
                <Link href="#eligibility" className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs">Eligibility</span>
                </Link>
                <Link href="#vendor-requirements" className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Gavel className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs">Vendors</span>
                </Link>
                <Link href="#prohibited-items" className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs">Prohibited</span>
                </Link>
                <Link href="#payments" className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs">Payments</span>
                </Link>
                <Link href="#delivery" className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Truck className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs">Delivery</span>
                </Link>
                <Link href="#liability" className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs">Liability</span>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* 1. DEFINITIONS */}
          <Card className="mb-6" id="definitions">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                1. DEFINITIONS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground mb-4">For clarity:</p>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] xs:text-xs sm:text-sm"><strong>Customer</strong> means any person who browses, buys, or attempts to buy items on the Platform.</p>
                </div>
                <div>
                  <p className="text-[10px] xs:text-xs sm:text-sm"><strong>Vendor</strong> means any person or business selling products or services on the Platform.</p>
                </div>
                <div>
                  <p className="text-[10px] xs:text-xs sm:text-sm"><strong>User</strong> means any Customer or Vendor.</p>
                </div>
                <div>
                  <p className="text-[10px] xs:text-xs sm:text-sm"><strong>Listing</strong> means any product or service posted for sale on the Platform.</p>
                </div>
                <div>
                  <p className="text-[10px] xs:text-xs sm:text-sm"><strong>Transaction</strong> means any purchase, payment, order, delivery, return, refund, or dispute.</p>
                </div>
                <div>
                  <p className="text-[10px] xs:text-xs sm:text-sm"><strong>Verified Reseller</strong> means a Vendor who has completed Make It Sell's verification process.</p>
                </div>
                <div>
                  <p className="text-[10px] xs:text-xs sm:text-sm"><strong>Authentication</strong> means any process (manual or automated) used to assess the likelihood that an item is genuine.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. MARKETPLACE ROLE */}
          <Card className="mb-6" id="marketplace-role">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                <Building className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                2. WHO WE ARE (MARKETPLACE ROLE)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">Make It Sell is a marketplace platform that connects Vendors and Customers.</p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-800 text-xs sm:text-sm mb-2">IMPORTANT:</h4>
                <ul className="text-[9px] xs:text-[10px] sm:text-xs text-amber-700 space-y-1">
                  <li>• We do not own the products listed unless explicitly stated.</li>
                  <li>• We are not the manufacturer, importer, or distributor of vendor items.</li>
                  <li>• Vendors are solely responsible for the products they sell and the information they provide.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* 3. ELIGIBILITY */}
          <Card className="mb-6" id="eligibility">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                3. ELIGIBILITY
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">To use the Platform, you must:</p>
              <ul className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground space-y-2 pl-4">
                <li>• Be at least 18 years old, or use the Platform under supervision of a legal guardian.</li>
                <li>• Have legal capacity to enter into contracts.</li>
                <li>• Provide accurate and truthful information.</li>
              </ul>
              <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">We may refuse service to anyone at any time for any reason permitted by law.</p>
            </CardContent>
          </Card>

          {/* 7. PROHIBITED ITEMS */}
          <Card className="mb-6" id="prohibited-items">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                7. PROHIBITED ITEMS & ACTIVITIES
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">You must not list, sell, promote, or attempt to trade:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ul className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• Counterfeit items, replicas, or fake branded goods</li>
                  <li>• Stolen goods</li>
                  <li>• Illegal drugs or controlled substances</li>
                  <li>• Weapons, ammunition, or weapon accessories</li>
                  <li>• Pornographic content or sexual services</li>
                </ul>
                <ul className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• Human trafficking-related content</li>
                  <li>• Fake documents, IDs, or certificates</li>
                  <li>• Hazardous items without authorization</li>
                  <li>• Any product violating Nigerian law</li>
                  <li>• Items violating international laws</li>
                </ul>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                <p className="text-[10px] xs:text-xs sm:text-sm text-red-700 font-medium">We may cooperate with law enforcement where fraud or criminal activity is suspected.</p>
              </div>
            </CardContent>
          </Card>

          {/* LIABILITY */}
          <Card className="mb-6" id="liability">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                28. LIMITATION OF LIABILITY
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">To the maximum extent permitted by law:</p>
              <div>
                <h4 className="font-semibold text-xs sm:text-sm mb-2 text-red-600">Make It Sell shall not be liable for:</h4>
                <ul className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• Counterfeit or illegal items sold by Vendors</li>
                  <li>• Unregistered business activity by Vendors</li>
                  <li>• Lost profits, lost business, or reputational harm</li>
                  <li>• Indirect, incidental, or consequential damages</li>
                  <li>• Disputes between Vendors and Customers</li>
                </ul>
              </div>
              <p className="text-[10px] xs:text-xs sm:text-sm font-medium bg-yellow-50 border border-yellow-200 rounded p-3">
                If Make It Sell is found liable for any claim, our liability is limited to the total fees paid to Make It Sell for the specific transaction in dispute.
              </p>
            </CardContent>
          </Card>

          {/* TAXES */}
          <Card className="mb-6">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">31. TAXES</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">Vendors are solely responsible for:</p>
              <ul className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground space-y-1 pl-4">
                <li>• VAT, income tax, withholding tax</li>
                <li>• Import duties</li>
                <li>• Business registration requirements</li>
                <li>• Compliance with Nigerian tax laws</li>
              </ul>
              <p className="text-[10px] xs:text-xs sm:text-sm font-medium text-red-600">Make It Sell does not provide tax advice.</p>
            </CardContent>
          </Card>

          {/* GOVERNING LAW */}
          <Card className="mb-6">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">33. GOVERNING LAW</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">These Terms are governed by the laws of the Federal Republic of Nigeria.</p>
            </CardContent>
          </Card>

          {/* DISPUTE RESOLUTION */}
          <Card className="mb-6">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">34. DISPUTE RESOLUTION</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">Before taking legal action, Users agree to attempt resolution through our support system.</p>
              <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">If unresolved, disputes may be resolved through:</p>
              <ul className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground space-y-1 pl-4">
                <li>• Negotiation</li>
                <li>• Mediation</li>
                <li>• Arbitration (optional)</li>
                <li>• Courts of competent jurisdiction in Nigeria</li>
              </ul>
            </CardContent>
          </Card>

          {/* CHANGES TO TERMS */}
          <Card className="mb-6">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">35. CHANGES TO THESE TERMS</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">We may update these Terms at any time. Continued use of the Platform after updates means you accept the revised Terms.</p>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="mb-6">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">36. CONTACT INFORMATION</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground mb-4">
                For support, complaints, and legal notices:
              </p>
              <div className="space-y-2 text-[10px] xs:text-xs sm:text-sm">
                <p><strong>Email:</strong> noreply@makeitsell.org</p>
                <p><strong>Phone:</strong> +234 9077674884</p>
                <p><strong>Phone:</strong> +234 703198441</p>
              </div>
            </CardContent>
          </Card>

          {/* Final Notice */}
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg p-4 sm:p-6 text-center">
            <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">
              By using Make It Sell, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
            <div className="mt-4">
              <Link href="/support" className="inline-flex items-center text-primary hover:underline text-xs sm:text-sm">
                Contact Support Team →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}