import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Landmark, Star, MessageCircleWarning, Clock, RotateCcw, Wallet, AlertTriangle } from "lucide-react"
import Header from "@/components/Header"

export default function TrustCentrePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="mb-8">
            <nav className="text-sm text-muted-foreground mb-4">
              <Link href="/" className="hover:text-accent">Home</Link>
              <span className="mx-2">/</span>
              <span>Trust & Safety</span>
            </nav>
            <h1 className="text-3xl font-bold mb-4">Buy With Confidence</h1>
            <p className="text-muted-foreground max-w-2xl">
              MakeItSell holds your payment in escrow on every order, verifies vendor bank details before they can
              get paid, and only releases money once you confirm your order arrived. Here's exactly how that works.
            </p>
          </div>

          {/* Hero banner */}
          <Card className="mb-8 border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <ShieldCheck className="w-8 h-8 text-green-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-lg mb-2 text-green-900">Your money doesn't go straight to the vendor</h3>
                  <p className="text-green-800">
                    Every payment is held in escrow by MakeItSell, not the seller, the moment you check out. The vendor
                    only gets paid after you confirm the order arrived — and if you never confirm and never report a
                    problem, your money comes back to <em>you</em>, automatically.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Escrow */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                How Escrow Protects Every Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <div>
                    <strong>You pay, we hold it</strong>
                    <p className="text-sm text-muted-foreground mt-1">Your payment is marked "in escrow" the moment you check out — it sits with MakeItSell, not the vendor.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <div>
                    <strong>You confirm receipt</strong>
                    <p className="text-sm text-muted-foreground mt-1">Once your order arrives, tap "I have received this" on your <Link href="/order" className="text-accent underline">Orders</Link> page, or the one-tap link we email you.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <div>
                    <strong>Vendor gets paid</strong>
                    <p className="text-sm text-muted-foreground mt-1">Confirming receipt releases the escrow to the vendor immediately — that's what triggers their payout.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <div>
                    <strong>Forget to confirm? You're still covered</strong>
                    <p className="text-sm text-muted-foreground mt-1">We'll email a reminder a few hours after payment. If we still don't hear from you — and no issue was reported — within about 4 days, your payment is <strong>automatically refunded to your wallet</strong>, not released to the vendor.</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground border-t pt-4">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                <span>This is a safety net for orders that go quiet, not a substitute for reporting a real problem — see "If Something Goes Wrong" below.</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Refunds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5" />
                  Refunds & Cancellations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  <strong>Before dispatch:</strong> cancel any order right up until it's out for delivery, and if
                  you've already paid, the full amount lands back in your wallet instantly.
                </p>
                <p>
                  <strong>No response:</strong> the escrow safety net above refunds you automatically if an order
                  goes unconfirmed and unreported.
                </p>
                <p>
                  <strong>After delivery:</strong> MakeItSell is a marketplace of independent vendors, so once an
                  order is confirmed received, sales are generally final — with exceptions for damaged, defective, or
                  wrong items reported within 24 hours.
                </p>
                <Link href="/returns" className="text-accent underline text-sm font-medium inline-block pt-1">
                  Read the full Returns & Refunds policy →
                </Link>
              </CardContent>
            </Card>

            {/* Vendor verification */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="w-5 h-5" />
                  Vendor Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Landmark className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <p>Every vendor must add a real Nigerian bank account before they can receive payouts. We verify
                  the account name against the bank in real time — vendors can't get paid into an unverified or
                  mismatched account.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Star className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <p>Store ratings and reviews can only be left by customers who confirmed receipt of a real order
                  from that store — no fake or drive-by reviews.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* If something goes wrong */}
          <Card className="mb-8 border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <MessageCircleWarning className="w-5 h-5" />
                If Something Goes Wrong
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-amber-800 text-sm">
                  Don't confirm receipt if an order hasn't arrived or arrived wrong, damaged, or incomplete —
                  contact our support team first. Reporting a problem before confirming puts a hold on that escrow
                  payment so it can't be released while we sort it out with the vendor.
                </p>
              </div>
              <div className="mt-4">
                <Button variant="outline" asChild className="bg-white">
                  <Link href="/support">Contact Support</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>Related: <Link href="/returns" className="text-accent underline">Returns & Refunds</Link> · <Link href="/shipping" className="text-accent underline">Shipping Info</Link> · <Link href="/order" className="text-accent underline">My Orders</Link></p>
          </div>
        </div>
      </main>
    </div>
  )
}
