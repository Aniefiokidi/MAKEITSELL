import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Cookie, Shield, Eye } from "lucide-react"
import Header from "@/components/Header"

export default function CookiesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8 max-w-4xl">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <nav className="text-[9px] xs:text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
              <Link href="/" className="hover:text-accent">Home</Link>
              <span className="mx-1.5 sm:mx-2">/</span>
              <span>Cookie Policy</span>
            </nav>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 sm:mb-4">Cookie Policy</h1>
            <p className="text-muted-foreground text-[9px] xs:text-xs sm:text-sm">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Cookie Overview */}
          <Card className="mb-6 sm:mb-8 border-accent/20 bg-accent/5">
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-start gap-2 sm:gap-4">
                <Cookie className="w-5 h-5 sm:w-8 sm:h-8 text-accent mt-1 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-lg md:text-xl font-semibold mb-1 sm:mb-2">About Cookies on Make It Sell</h2>
                  <p className="text-muted-foreground text-[10px] xs:text-xs sm:text-sm leading-relaxed">
                    We keep cookie use to a minimum. Make It Sell only sets the essential cookies needed to keep you signed in
                    and your cart working — we don't use advertising or cross-site tracking cookies, and our analytics tool
                    doesn't use cookies at all.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What Are Cookies */}
          <Card className="mb-6">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
                <Cookie className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                What Are Cookies?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
              <p className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground">
                Cookies are small text files stored on your device when you visit a website, used to remember things like
                your login session between page loads.
              </p>
            </CardContent>
          </Card>

          {/* Types of Cookies */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Cookies We Actually Use</CardTitle>
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
                  Necessary for the site to work — keeping you signed in and your cart intact between pages. These aren't
                  optional: disabling them in your browser will break login and checkout. Because they're strictly
                  necessary, they don't require separate consent under Nigerian or international cookie-consent rules.
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Authentication session cookie</span>
                    <span className="text-muted-foreground">Session</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shopping cart cookie</span>
                    <span className="text-muted-foreground">Session</span>
                  </div>
                </div>
              </div>

              {/* Analytics */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-600" />
                    Analytics
                  </h4>
                  <Badge variant="secondary">No cookie set</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  We use <strong>Vercel Analytics</strong> to see aggregate, anonymized page-view counts. It's a
                  privacy-focused analytics tool that doesn't use cookies or any persistent identifier, and it can't
                  track you across other websites.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* What we don't do */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>What We Don't Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                We don't use advertising cookies, cross-site retargeting pixels, or third-party marketing/analytics
                platforms like Google Analytics, Facebook Pixel, or Hotjar. There's nothing to opt out of here.
              </p>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                When you check out, you're taken to Paystack's own secure payment page to complete payment — Make It Sell
                never sees or stores your card details. That page is operated by Paystack and is subject to Paystack's own
                privacy and cookie practices, not this policy.
              </p>
            </CardContent>
          </Card>

          {/* Managing Cookies */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Managing Cookies in Your Browser</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-3">
                Since the only cookies we set are essential ones, there's no preference panel to manage them here — but
                you can always clear or block cookies through your browser settings if you'd like:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Chrome:</strong> Settings → Privacy and Security → Cookies
                </div>
                <div>
                  <strong>Firefox:</strong> Settings → Privacy &amp; Security → Cookies
                </div>
                <div>
                  <strong>Safari:</strong> Preferences → Privacy → Manage Website Data
                </div>
                <div>
                  <strong>Edge:</strong> Settings → Cookies and Site Permissions
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Note that blocking the essential session cookie will sign you out and prevent checkout from working.
              </p>
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
                <p><strong>Company:</strong> Make It Sell Ltd (RC 9324731)</p>
                <p><strong>Email:</strong> support@makeitsell.ng</p>
              </div>
              <div className="mt-4 flex gap-4">
                <Link href="/privacy" className="text-accent hover:underline text-sm">
                  View Privacy Policy →
                </Link>
                <Link href="/support" className="text-accent hover:underline text-sm">
                  Contact Support →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
