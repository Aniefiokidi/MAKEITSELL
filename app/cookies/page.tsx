import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Cookie, Settings, Shield, Eye, ToggleLeft } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

export default function CookiesPage() {
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
              <span>Cookie Policy</span>
            </nav>
            <h1 className="text-3xl font-bold mb-4">Cookie Policy</h1>
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Cookie Overview */}
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Cookie className="w-8 h-8 text-primary mt-1" />
                <div>
                  <h2 className="text-xl font-semibold mb-2">About Cookies</h2>
                  <p className="text-muted-foreground">
                    This Cookie Policy explains how Make It Sell Marketplace uses cookies and similar technologies to provide, 
                    improve, and protect our services. By using our platform, you consent to our use of cookies as described in this policy.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Cookie Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button className="flex-1">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Cookie Settings
                </Button>
                <Button variant="outline" className="flex-1">
                  <ToggleLeft className="w-4 h-4 mr-2" />
                  Accept All Cookies
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* What Are Cookies */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cookie className="w-5 h-5" />
                What Are Cookies?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cookies are small text files that are stored on your device when you visit a website. They help us 
                recognize your device and remember information about your visit, such as your preferred language and other settings.
              </p>
              <div>
                <h4 className="font-semibold mb-2">Types of Information Stored</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• Your login status and preferences</li>
                  <li>• Items in your shopping cart</li>
                  <li>• Language and region settings</li>
                  <li>• Site navigation and usage patterns</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Types of Cookies */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Types of Cookies We Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Essential Cookies */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-600" />
                    Essential Cookies
                  </h4>
                  <Badge variant="secondary">Always Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  These cookies are necessary for our website to function properly. They enable basic features 
                  like security, authentication, and accessibility.
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Authentication cookies</span>
                    <span className="text-muted-foreground">Session/Persistent</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Security cookies</span>
                    <span className="text-muted-foreground">Session</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shopping cart cookies</span>
                    <span className="text-muted-foreground">Session</span>
                  </div>
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-600" />
                    Analytics Cookies
                  </h4>
                  <Badge variant="outline">Optional</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  These cookies help us understand how visitors use our website so we can improve user experience.
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Google Analytics</span>
                    <span className="text-muted-foreground">2 years</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Page view tracking</span>
                    <span className="text-muted-foreground">Session</span>
                  </div>
                  <div className="flex justify-between">
                    <span>User behavior analysis</span>
                    <span className="text-muted-foreground">1 year</span>
                  </div>
                </div>
              </div>

              {/* Functional Cookies */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Settings className="w-4 h-4 text-purple-600" />
                    Functional Cookies
                  </h4>
                  <Badge variant="outline">Optional</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  These cookies enable enhanced functionality and personalization to improve your experience.
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Language preferences</span>
                    <span className="text-muted-foreground">1 year</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Theme settings</span>
                    <span className="text-muted-foreground">6 months</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recently viewed items</span>
                    <span className="text-muted-foreground">30 days</span>
                  </div>
                </div>
              </div>

              {/* Marketing Cookies */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="w-4 h-4 bg-orange-600 rounded-full"></span>
                    Marketing Cookies
                  </h4>
                  <Badge variant="outline">Optional</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  These cookies are used to show you relevant advertisements based on your interests.
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Ad personalization</span>
                    <span className="text-muted-foreground">1 year</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Retargeting pixels</span>
                    <span className="text-muted-foreground">6 months</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Social media integration</span>
                    <span className="text-muted-foreground">1 year</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Third-Party Cookies */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Third-Party Cookies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We work with third-party services that may set their own cookies on your device. These include:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Analytics Services</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Google Analytics</li>
                    <li>• Google Tag Manager</li>
                    <li>• Hotjar (user behavior)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Payment Processors</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Stripe</li>
                    <li>• PayPal</li>
                    <li>• Apple Pay / Google Pay</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Social Media</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Facebook Pixel</li>
                    <li>• Twitter Analytics</li>
                    <li>• LinkedIn Insights</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Support Services</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Live chat widgets</li>
                    <li>• Help desk platforms</li>
                    <li>• Customer feedback tools</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Managing Cookies */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Managing Your Cookie Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Browser Settings</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  You can control cookies through your browser settings. Here's how to manage cookies in popular browsers:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Chrome:</strong> Settings → Privacy and Security → Cookies
                  </div>
                  <div>
                    <strong>Firefox:</strong> Settings → Privacy & Security → Cookies
                  </div>
                  <div>
                    <strong>Safari:</strong> Preferences → Privacy → Manage Website Data
                  </div>
                  <div>
                    <strong>Edge:</strong> Settings → Cookies and Site Permissions
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Our Cookie Settings</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  You can also manage your cookie preferences specifically for our website using our cookie management tool.
                </p>
                <Button>
                  <Settings className="w-4 h-4 mr-2" />
                  Open Cookie Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Opt-Out Links */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Opt-Out Links</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                You can opt out of certain types of cookies and tracking through these industry tools:
              </p>
              <div className="space-y-2 text-sm">
                <Link href="#" className="block text-primary hover:underline">
                  Digital Advertising Alliance (DAA) opt-out →
                </Link>
                <Link href="#" className="block text-primary hover:underline">
                  Network Advertising Initiative (NAI) opt-out →
                </Link>
                <Link href="#" className="block text-primary hover:underline">
                  Google Analytics opt-out →
                </Link>
                <Link href="#" className="block text-primary hover:underline">
                  European Interactive Digital Advertising Alliance (EDAA) →
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Impact of Disabling Cookies */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Impact of Disabling Cookies</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Disabling certain cookies may affect your experience on our website:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Essential Cookies Disabled</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Unable to stay logged in</li>
                    <li>• Shopping cart won't work</li>
                    <li>• Security features compromised</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Optional Cookies Disabled</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Less personalized experience</li>
                    <li>• Settings won't be remembered</li>
                    <li>• Less relevant advertisements</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Updates to Policy */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Updates to This Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We may update this Cookie Policy from time to time to reflect changes in our practices or applicable laws. 
                We will notify you of any material changes by posting the updated policy on our website and updating the 
                "Last updated" date.
              </p>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Questions About Cookies?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                If you have any questions about our use of cookies or this Cookie Policy, please contact us:
              </p>
              <div className="space-y-2 text-sm">
                <p><strong>Email:</strong> privacy@branda.com</p>
                <p><strong>Subject:</strong> Cookie Policy Inquiry</p>
              </div>
              <div className="mt-4 flex gap-4">
                <Link href="/privacy" className="text-primary hover:underline text-sm">
                  View Privacy Policy →
                </Link>
                <Link href="/support" className="text-primary hover:underline text-sm">
                  Contact Support →
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