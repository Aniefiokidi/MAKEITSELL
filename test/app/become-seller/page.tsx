"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Store, DollarSign, Users, BarChart3, Shield, Headphones, CheckCircle, ArrowRight } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useAuth } from "@/contexts/AuthContext"

const benefits = [
  {
    icon: Store,
    title: "Your Own Storefront",
    description: "Get a dedicated space to showcase your products with customizable branding",
  },
  {
    icon: DollarSign,
    title: "Competitive Fees",
    description: "Low commission rates and transparent pricing with no hidden fees",
  },
  {
    icon: Users,
    title: "Access to Millions",
    description: "Reach customers across the platform with our powerful search and discovery",
  },
  {
    icon: BarChart3,
    title: "Analytics & Insights",
    description: "Track your performance with detailed sales analytics and customer insights",
  },
  {
    icon: Shield,
    title: "Secure Payments",
    description: "Protected transactions with our escrow system and fraud protection",
  },
  {
    icon: Headphones,
    title: "AI-Powered Support",
    description: "Unified customer service system handles all support tickets for you",
  },
]

const steps = [
  {
    step: 1,
    title: "Sign Up",
    description: "Create your vendor account in minutes",
  },
  {
    step: 2,
    title: "Set Up Store",
    description: "Add your business details and customize your storefront",
  },
  {
    step: 3,
    title: "Add Products",
    description: "Upload your products with photos and descriptions",
  },
  {
    step: 4,
    title: "Start Selling",
    description: "Go live and start receiving orders from customers",
  },
]

export default function BecomeSellerPage() {
  const { user } = useAuth()
  const [isVendor, setIsVendor] = useState(false)

  useEffect(() => {
    if (user?.role === "vendor") {
      setIsVendor(true)
    }
  }, [user])

  const getCtaButton = () => {
    if (!user) {
      // Not logged in - go to vendor signup
      return (
        <Button asChild size="lg" className="text-lg px-8">
          <Link href="/signup?type=vendor">
            Start Selling
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )
    } else if (user.role === "vendor") {
      // Already a vendor - go to dashboard
      return (
        <Button asChild size="lg" className="text-lg px-8">
          <Link href="/vendor/dashboard">
            Go to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )
    } else {
      // Customer wanting to become vendor - upgrade account
      return (
        <Button asChild size="lg" className="text-lg px-8">
          <Link href="/signup?type=vendor">
            Upgrade to Seller
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-background via-muted/50 to-background py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl text-center">
              <Badge className="mb-4">{isVendor ? "Welcome Back, Seller!" : "Start Selling Today"}</Badge>
              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
                {isVendor ? (
                  <>
                    Manage Your <span className="text-accent">Business</span>
                  </>
                ) : (
                  <>
                    Turn Your Products Into <span className="text-accent">Profit</span>
                  </>
                )}
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-pretty">
                {isVendor
                  ? "Access your seller dashboard to manage products, orders, and grow your business on GOTE marketplace."
                  : "Join thousands of successful sellers on GOTE marketplace. Reach millions of customers with our AI-powered platform and unified customer service system."}
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
                {getCtaButton()}
                <Button asChild variant="outline" size="lg" className="text-lg px-8 bg-transparent">
                  <Link href="#benefits">Learn More</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-balance mb-4">Why Sell on GOTE?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-pretty">
                Everything you need to build and grow your online business
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {benefits.map((benefit, index) => (
                <Card key={index} className="text-center">
                  <CardHeader>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                      <benefit.icon className="h-6 w-6 text-accent" />
                    </div>
                    <CardTitle className="text-xl">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-pretty">{benefit.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-balance mb-4">How It Works</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-pretty">Get started in just 4 simple steps</p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <div key={index} className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground font-bold text-lg">
                    {step.step}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-pretty">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <Card className="max-w-4xl mx-auto text-center">
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-balance">
                  {isVendor ? "Ready to Grow Your Business?" : "Ready to Start Your Journey?"}
                </CardTitle>
                <CardDescription className="text-lg">
                  {isVendor
                    ? "Access your dashboard and start managing your products and orders"
                    : "Join GOTE marketplace today and start reaching millions of customers"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    No setup fees
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Free listing tools
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    24/7 support
                  </div>
                </div>
                {getCtaButton()}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
