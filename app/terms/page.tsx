import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Scale, Shield, AlertTriangle, Users, FileText, Gavel } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

export default function TermsPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <nav className="text-sm text-muted-foreground mb-4">
              <Link href="/" className="hover:text-primary">Home</Link>
              <span className="mx-2">/</span>
              <span>Terms of Service</span>
            </nav>
            <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Terms Overview */}
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Scale className="w-8 h-8 text-primary mt-1" />
                <div>
                  <h2 className="text-xl font-semibold mb-2">Welcome to BRANDA Marketplace</h2>
                  <p className="text-muted-foreground">
                    These Terms of Service govern your use of the BRANDA Marketplace platform. By accessing or using our services, 
                    you agree to be bound by these terms. Please read them carefully.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Navigation */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Quick Navigation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link href="#acceptance" className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm">Acceptance of Terms</span>
                </Link>
                <Link href="#user-accounts" className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">User Accounts</span>
                </Link>
                <Link href="#marketplace-rules" className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Gavel className="w-4 h-4" />
                  <span className="text-sm">Marketplace Rules</span>
                </Link>
                <Link href="#prohibited-conduct" className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">Prohibited Conduct</span>
                </Link>
                <Link href="#liability" className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm">Liability & Disclaimers</span>
                </Link>
                <Link href="#contact" className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Scale className="w-4 h-4" />
                  <span className="text-sm">Contact & Disputes</span>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Acceptance of Terms */}
          <Card className="mb-6" id="acceptance">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Acceptance of Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                By accessing and using the BRANDA Marketplace platform, you acknowledge that you have read, understood, 
                and agree to be bound by these Terms of Service and all applicable laws and regulations.
              </p>
              <div>
                <h4 className="font-semibold mb-2">Agreement Conditions</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• You must be at least 18 years old to use our services</li>
                  <li>• You have the legal capacity to enter into this agreement</li>
                  <li>• You agree to comply with all local, state, and federal laws</li>
                  <li>• You understand that these terms may be updated from time to time</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* User Accounts */}
          <Card className="mb-6" id="user-accounts">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Accounts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Account Registration</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• You must provide accurate and complete information</li>
                  <li>• You are responsible for maintaining account security</li>
                  <li>• You must notify us of any unauthorized access</li>
                  <li>• One person may maintain only one account</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Account Responsibilities</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• Keep your login credentials confidential</li>
                  <li>• Update your information when it changes</li>
                  <li>• Be responsible for all activities under your account</li>
                  <li>• Comply with our community guidelines</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Account Termination</h4>
                <p className="text-sm text-muted-foreground">
                  We reserve the right to suspend or terminate accounts that violate these terms, engage in 
                  fraudulent activity, or pose a risk to other users or our platform.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Marketplace Rules */}
          <Card className="mb-6" id="marketplace-rules">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="w-5 h-5" />
                Marketplace Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">For Buyers</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• Provide accurate shipping and payment information</li>
                  <li>• Communicate respectfully with sellers</li>
                  <li>• Follow our return and refund policies</li>
                  <li>• Report any issues or concerns promptly</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">For Sellers</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• List only authentic, legal products you have the right to sell</li>
                  <li>• Provide accurate product descriptions and images</li>
                  <li>• Honor advertised prices and availability</li>
                  <li>• Ship orders promptly and securely</li>
                  <li>• Respond to customer inquiries in a timely manner</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Transaction Terms</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• All sales are final unless otherwise specified</li>
                  <li>• Payment processing is handled by third-party providers</li>
                  <li>• We facilitate transactions but are not party to them</li>
                  <li>• Disputes should be resolved directly between parties initially</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Prohibited Conduct */}
          <Card className="mb-6" id="prohibited-conduct">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Prohibited Conduct
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                The following activities are strictly prohibited on our platform:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Illegal Activities</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Selling counterfeit or stolen goods</li>
                    <li>• Money laundering or fraud</li>
                    <li>• Violating intellectual property rights</li>
                    <li>• Tax evasion or illegal tax schemes</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Platform Abuse</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Creating multiple accounts</li>
                    <li>• Manipulating reviews or ratings</li>
                    <li>• Spamming or sending unsolicited messages</li>
                    <li>• Attempting to circumvent platform fees</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Harmful Content</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Hate speech or discriminatory content</li>
                    <li>• Harassment or threats</li>
                    <li>• Adult content or services</li>
                    <li>• Dangerous or illegal items</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Technical Violations</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Hacking or unauthorized access</li>
                    <li>• Introducing malware or viruses</li>
                    <li>• Scraping or automated data collection</li>
                    <li>• Interfering with platform operations</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Intellectual Property */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Our Content</h4>
                <p className="text-sm text-muted-foreground">
                  The BRANDA Marketplace platform, including its design, features, and content, is protected by copyright, 
                  trademark, and other intellectual property laws. You may not copy, distribute, or create derivative works 
                  without our express permission.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">User Content</h4>
                <p className="text-sm text-muted-foreground">
                  By posting content on our platform, you grant us a non-exclusive license to use, display, and distribute 
                  that content in connection with our services. You retain ownership of your content and are responsible 
                  for ensuring you have the rights to post it.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Liability & Disclaimers */}
          <Card className="mb-6" id="liability">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Liability & Disclaimers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Platform Role</h4>
                <p className="text-sm text-muted-foreground">
                  BRANDA Marketplace is a platform that facilitates transactions between buyers and sellers. We are not a party 
                  to any transaction and do not guarantee the quality, safety, legality, or accuracy of listings.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Limitation of Liability</h4>
                <p className="text-sm text-muted-foreground">
                  To the fullest extent permitted by law, BRANDA Marketplace shall not be liable for any indirect, incidental, 
                  special, or consequential damages arising from your use of our platform.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Indemnification</h4>
                <p className="text-sm text-muted-foreground">
                  You agree to indemnify and hold harmless BRANDA Marketplace from any claims, damages, or expenses arising 
                  from your use of the platform or violation of these terms.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Dispute Resolution */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Dispute Resolution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Resolution Process</h4>
                <ol className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>1. First, attempt to resolve disputes directly with the other party</li>
                  <li>2. If unsuccessful, contact our support team for mediation</li>
                  <li>3. As a last resort, disputes may be subject to binding arbitration</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Governing Law</h4>
                <p className="text-sm text-muted-foreground">
                  These terms are governed by the laws of [Your Jurisdiction] without regard to conflict of law principles.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Changes to Terms */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We reserve the right to modify these Terms of Service at any time. We will notify users of significant 
                changes through email or platform notifications. Your continued use of the platform after changes 
                constitutes acceptance of the modified terms.
              </p>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card id="contact">
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              <div className="space-y-2 text-sm">
                <p><strong>Email:</strong> legal@BRANDA.com</p>
                <p><strong>Address:</strong> 123 Allen Avenue, Legal Department, Lagos, Nigeria</p>
                <p><strong>Phone:</strong> +234 812 9380 869</p>
              </div>
              <div className="mt-4">
                <Link href="/support" className="inline-flex items-center text-primary hover:underline text-sm">
                  Contact Support Team →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </>
  )
}
