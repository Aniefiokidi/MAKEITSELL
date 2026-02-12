import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Eye, Lock, UserCheck, Database, Globe } from "lucide-react"
import Header from "@/components/Header"

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-10 max-w-4xl">
          {/* Header */}
          <div className="mb-6 sm:mb-8 animate-fade-in-up">
            <nav className="text-[9px] xs:text-xs sm:text-sm text-accent font-semibold mb-3 sm:mb-4 tracking-wide animate-fade-in-up">
              <Link href="/" className="hover:text-primary transition-colors">Home</Link>
              <span className="mx-1.5 sm:mx-2">/</span>
              <span>Privacy Policy</span>
            </nav>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold mb-2 sm:mb-4 text-transparent bg-clip-text bg-gradient-to-r from-accent to-primary animate-fade-in-up">Privacy Policy</h1>
            <p className="text-muted-foreground text-[9px] xs:text-xs sm:text-sm animate-fade-in-up">
              Last updated: <span className="bg-primary/10 text-primary px-2 py-1 rounded shadow animate-pulse">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </p>
          </div>

          {/* Privacy Overview */}
          <Card className="mb-6 sm:mb-8 border border-accent/10 bg-white/90 dark:bg-neutral-800 shadow-lg animate-fade-in-up">
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-start gap-2 sm:gap-4 animate-fade-in-up">
                <Shield className="w-5 h-5 sm:w-8 sm:h-8 text-primary mt-1 shrink-0 animate-bounce" />
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-lg md:text-xl font-semibold mb-1 sm:mb-2 text-accent">Your Privacy Matters</h2>
                  <p className="text-muted-foreground text-[10px] xs:text-xs sm:text-sm leading-relaxed">
                    At <span className="font-bold text-accent">Make It Sell Marketplace</span>, we are committed to protecting your privacy and ensuring the security of your personal information. 
                    This policy explains how we collect, use, and safeguard your data when you use our platform.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Navigation */}
          <Card className="mb-6 sm:mb-8 bg-white/90 dark:bg-neutral-800 border border-accent/10 shadow-lg animate-fade-in-up">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-xl text-accent font-bold animate-fade-in-up">Quick Navigation</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                <Link href="#information-collection" className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-accent/10 transition-all duration-200 shadow-sm animate-fade-in-up">
                  <Database className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 animate-bounce" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs line-clamp-2">Information We Collect</span>
                </Link>
                <Link href="#information-use" className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-accent/10 transition-all duration-200 shadow-sm animate-fade-in-up">
                  <Eye className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 animate-bounce" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs line-clamp-2">How We Use Your Data</span>
                </Link>
                <Link href="#information-sharing" className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-accent/10 transition-all duration-200 shadow-sm animate-fade-in-up">
                  <Globe className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 animate-bounce" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs line-clamp-2">Information Sharing</span>
                </Link>
                <Link href="#data-security" className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-accent/10 transition-all duration-200 shadow-sm animate-fade-in-up">
                  <Lock className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 animate-bounce" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs line-clamp-2">Data Security</span>
                </Link>
                <Link href="#user-rights" className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-accent/10 transition-all duration-200 shadow-sm animate-fade-in-up">
                  <UserCheck className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 animate-bounce" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs line-clamp-2">Your Rights</span>
                </Link>
                <Link href="#contact" className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-accent/10 transition-all duration-200 shadow-sm animate-fade-in-up">
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 animate-bounce" />
                  <span className="text-[8px] xs:text-[9px] sm:text-xs line-clamp-2">Contact Us</span>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Information Collection */}
          <Card className="mb-6" id="information-collection">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                <Database className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                Information We Collect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
              <div>
                <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Personal Information</h4>
                <ul className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground space-y-1 pl-3 sm:pl-4">
                  <li>• Name, email address, and contact information</li>
                  <li>• Billing and shipping addresses</li>
                  <li>• Payment information (processed securely through our payment partners)</li>
                  <li>• Account credentials and preferences</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Transaction Information</h4>
                <ul className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground space-y-1 pl-3 sm:pl-4">
                  <li>• Purchase history and order details</li>
                  <li>• Product reviews and ratings</li>
                  <li>• Communication with sellers and support</li>
                  <li>• Return and refund requests</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Technical Information</h4>
                <ul className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground space-y-1 pl-3 sm:pl-4">
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
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                <Eye className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                How We Use Your Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
              <div>
                <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Service Delivery</h4>
                <ul className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground space-y-1 pl-3 sm:pl-4">
                  <li>• Process orders and facilitate transactions</li>
                  <li>• Provide customer support and resolve issues</li>
                  <li>• Send order confirmations and shipping updates</li>
                  <li>• Enable communication between buyers and sellers</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Platform Improvement</h4>
                <ul className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground space-y-1 pl-3 sm:pl-4">
                  <li>• Personalize your shopping experience</li>
                  <li>• Recommend relevant products and services</li>
                  <li>• Analyze usage patterns to improve our platform</li>
                  <li>• Develop new features and services</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Legal and Security</h4>
                <ul className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground space-y-1 pl-3 sm:pl-4">
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
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                <Globe className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                Information Sharing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
              <p className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                We do not sell your personal information to third parties. We may share your information only in the following circumstances:
              </p>
              <div>
                <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">With Your Consent</h4>
                <p className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground">
                  We share information when you explicitly consent to such sharing.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Service Providers</h4>
                <ul className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground space-y-1 pl-3 sm:pl-4">
                  <li>• Payment processors for transaction handling</li>
                  <li>• Shipping companies for order fulfillment</li>
                  <li>• Cloud services for data storage and processing</li>
                  <li>• Analytics providers for platform improvement</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Legal Requirements</h4>
                <p className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground">
                  We may disclose information when required by law, court order, or to protect our rights and the safety of our users.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card className="mb-6" id="data-security">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                <Lock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                Data Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
              <p className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                We implement industry-standard security measures to protect your personal information:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Technical Safeguards</h4>
                  <ul className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1">
                    <li>• SSL/TLS encryption for data transmission</li>
                    <li>• Encrypted data storage</li>
                    <li>• Regular security audits and updates</li>
                    <li>• Secure server infrastructure</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Access Controls</h4>
                  <ul className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1">
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
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                Your Rights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
              <p className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                You have the following rights regarding your personal information:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Access and Control</h4>
                  <ul className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1">
                    <li>• Access your personal data</li>
                    <li>• Update or correct information</li>
                    <li>• Delete your account and data</li>
                    <li>• Download your data</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Communication Preferences</h4>
                  <ul className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1">
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
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">Cookies and Tracking</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <p className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                We use cookies and similar technologies to enhance your experience on our platform. 
                You can control cookie settings through your browser preferences.
              </p>
              <Link href="/cookies" className="text-primary hover:underline text-[9px] xs:text-[10px] sm:text-xs">
                Learn more about our Cookie Policy →
              </Link>
            </CardContent>
          </Card>

          {/* Updates */}
          <Card className="mb-6">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">Policy Updates</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <p className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground">
                We may update this privacy policy from time to time to reflect changes in our practices or 
                legal requirements. We will notify you of significant changes through email or platform notifications.
              </p>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card id="contact">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <p className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                If you have any questions about this privacy policy or how we handle your personal information, 
                please contact us:
              </p>
              <div className="space-y-1.5 sm:space-y-2 text-[9px] xs:text-[10px] sm:text-xs md:text-sm">
                <p><strong>Email:</strong> <span className="truncate">noreply@makeitsell.org</span></p>
                <p><strong>Address:</strong> <span className="break-words">123 Allen Avenue, Privacy Department, Lagos, Nigeria</span></p>
                <p><strong>Phone:</strong> <span className="truncate">+234 812 9380 869</span></p>
              </div>
              <div className="mt-3 sm:mt-4">
                <Link href="/support" className="inline-flex items-center text-primary hover:underline text-[9px] xs:text-[10px] sm:text-xs">
                  Contact Support Team →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
