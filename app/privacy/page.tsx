import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Eye, Lock, UserCheck, Database, Globe } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

export default function PrivacyPage() {
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
              <span>Privacy Policy</span>
            </nav>
            <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Privacy Overview */}
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Shield className="w-8 h-8 text-primary mt-1" />
                <div>
                  <h2 className="text-xl font-semibold mb-2">Your Privacy Matters</h2>
                  <p className="text-muted-foreground">
                    At BRANDA Marketplace, we are committed to protecting your privacy and ensuring the security of your personal information. 
                    This policy explains how we collect, use, and safeguard your data when you use our platform.
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
                <Link href="#information-collection" className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Database className="w-4 h-4" />
                  <span className="text-sm">Information We Collect</span>
                </Link>
                <Link href="#information-use" className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">How We Use Your Data</span>
                </Link>
                <Link href="#information-sharing" className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Globe className="w-4 h-4" />
                  <span className="text-sm">Information Sharing</span>
                </Link>
                <Link href="#data-security" className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Lock className="w-4 h-4" />
                  <span className="text-sm">Data Security</span>
                </Link>
                <Link href="#user-rights" className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <UserCheck className="w-4 h-4" />
                  <span className="text-sm">Your Rights</span>
                </Link>
                <Link href="#contact" className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm">Contact Us</span>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Information Collection */}
          <Card className="mb-6" id="information-collection">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Information We Collect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Personal Information</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• Name, email address, and contact information</li>
                  <li>• Billing and shipping addresses</li>
                  <li>• Payment information (processed securely through our payment partners)</li>
                  <li>• Account credentials and preferences</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Transaction Information</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• Purchase history and order details</li>
                  <li>• Product reviews and ratings</li>
                  <li>• Communication with sellers and support</li>
                  <li>• Return and refund requests</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Technical Information</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• IP address and device information</li>
                  <li>• Browser type and operating system</li>
                  <li>• Usage patterns and site interactions</li>
                  <li>• Cookies and similar tracking technologies</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Information Use */}
          <Card className="mb-6" id="information-use">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                How We Use Your Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Service Delivery</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• Process orders and facilitate transactions</li>
                  <li>• Provide customer support and resolve issues</li>
                  <li>• Send order confirmations and shipping updates</li>
                  <li>• Enable communication between buyers and sellers</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Platform Improvement</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• Personalize your shopping experience</li>
                  <li>• Recommend relevant products and services</li>
                  <li>• Analyze usage patterns to improve our platform</li>
                  <li>• Develop new features and services</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Legal and Security</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• Prevent fraud and ensure platform security</li>
                  <li>• Comply with legal obligations and regulations</li>
                  <li>• Enforce our terms of service</li>
                  <li>• Protect the rights and safety of our users</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Information Sharing */}
          <Card className="mb-6" id="information-sharing">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Information Sharing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                We do not sell your personal information to third parties. We may share your information only in the following circumstances:
              </p>
              <div>
                <h4 className="font-semibold mb-2">With Your Consent</h4>
                <p className="text-sm text-muted-foreground">
                  We share information when you explicitly consent to such sharing.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Service Providers</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• Payment processors for transaction handling</li>
                  <li>• Shipping companies for order fulfillment</li>
                  <li>• Cloud services for data storage and processing</li>
                  <li>• Analytics providers for platform improvement</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Legal Requirements</h4>
                <p className="text-sm text-muted-foreground">
                  We may disclose information when required by law, court order, or to protect our rights and the safety of our users.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card className="mb-6" id="data-security">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Data Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                We implement industry-standard security measures to protect your personal information:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Technical Safeguards</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• SSL/TLS encryption for data transmission</li>
                    <li>• Encrypted data storage</li>
                    <li>• Regular security audits and updates</li>
                    <li>• Secure server infrastructure</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Access Controls</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Limited access to personal data</li>
                    <li>• Employee training on data protection</li>
                    <li>• Multi-factor authentication</li>
                    <li>• Regular access reviews and audits</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Rights */}
          <Card className="mb-6" id="user-rights">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Your Rights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                You have the following rights regarding your personal information:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Access and Control</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Access your personal data</li>
                    <li>• Update or correct information</li>
                    <li>• Delete your account and data</li>
                    <li>• Download your data</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Communication Preferences</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Opt-out of marketing emails</li>
                    <li>• Manage notification settings</li>
                    <li>• Control cookie preferences</li>
                    <li>• Limit data processing</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cookies */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Cookies and Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                We use cookies and similar technologies to enhance your experience on our platform. 
                You can control cookie settings through your browser preferences.
              </p>
              <Link href="/cookies" className="text-primary hover:underline text-sm">
                Learn more about our Cookie Policy →
              </Link>
            </CardContent>
          </Card>

          {/* Updates */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Policy Updates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We may update this privacy policy from time to time to reflect changes in our practices or 
                legal requirements. We will notify you of significant changes through email or platform notifications.
              </p>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card id="contact">
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                If you have any questions about this privacy policy or how we handle your personal information, 
                please contact us:
              </p>
              <div className="space-y-2 text-sm">
                <p><strong>Email:</strong> privacy@BRANDA.com</p>
                <p><strong>Address:</strong> 123 Allen Avenue, Privacy Department, Lagos, Nigeria</p>
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
