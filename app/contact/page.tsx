"use client"

import type React from "react"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Phone, Clock, ArrowRight } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import SupportChat from "@/components/support/SupportChat"

type HubTab = "contact" | "support"

const SUPPORT_PHONE = "+234 707 826 7836"
const SUPPORT_WHATSAPP_URL = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_URL || "https://wa.me/2347078267836"

export default function ContactPage() {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get("tab") || "").toLowerCase() === "support" ? "support" : "contact"
  const [activeTab, setActiveTab] = useState<HubTab>(initialTab)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const { user } = useAuth()

  const tabTitle = useMemo(() => {
    return activeTab === "contact" ? "Contact Us" : "Support Center"
  }, [activeTab])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      setSubmitted(true)
      setFormData({ name: "", email: "", subject: "", message: "" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }))
  }

  const TabSwitcher = (
    <div className="mx-auto w-full max-w-xs rounded-full border border-accent/30 bg-muted/30 p-1 shrink-0">
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("contact")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === "contact"
              ? "bg-accent text-white shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Contact Team
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("support")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === "support"
              ? "bg-accent text-white shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Support Chat
        </button>
      </div>
    </div>
  )

  // ── Support tab: full-height no-scroll layout ─────────────────────────────
  if (activeTab === "support") {
    return (
      <div className="bg-background flex flex-col h-dvh overflow-hidden">
        <Header />
        <div className="flex-1 flex flex-col overflow-hidden px-3 sm:px-4 pt-3 pb-0">
          <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col overflow-hidden gap-2.5">

            {/* Heading — compact, hidden on very small screens when space is tight */}
            <div className="text-center shrink-0 hidden xs:block sm:block">
              <h1 className="font-['Bebas_Neue'] text-3xl sm:text-4xl leading-none tracking-[0.04em] uppercase">
                {tabTitle}
              </h1>
            </div>

            {TabSwitcher}

            {/* Chat fills remaining height */}
            <div className="flex-1 min-h-0">
              <SupportChat />
            </div>

            {/* Info strip — desktop only, never blocks keyboard on mobile */}
            <div className="hidden lg:grid lg:grid-cols-2 gap-3 text-sm shrink-0 pb-4">
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <p className="font-semibold text-foreground">What can I ask?</p>
                <ul className="space-y-1 text-muted-foreground leading-relaxed">
                  <li>📦 Track or cancel an order</li>
                  <li>↩️ Returns, refunds, exchanges</li>
                  <li>🛠️ Service bookings or price negotiation</li>
                  <li>🍽️ Food orders and delivery</li>
                  <li>💳 Paystack payment issues</li>
                  <li>👤 Login, account, or wallet help</li>
                </ul>
              </div>
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="space-y-1.5">
                  <p className="font-semibold text-foreground">Response times</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>AI Assistant — instant, 24/7</li>
                    <li>Human agent — 2–4 hours</li>
                    <li>Vendor disputes — 24–48 hours</li>
                  </ul>
                </div>
                <Button variant="outline" size="sm" className="w-full border-accent/40 mt-2" onClick={() => setActiveTab("contact")}>
                  Email the team instead
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Contact tab: normal scrollable page ───────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="container mx-auto px-2 sm:px-4 py-8 sm:py-14 flex-1">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
          <div className="text-center space-y-2">
            <h1 className="font-['Bebas_Neue'] text-4xl sm:text-5xl md:text-6xl leading-none tracking-[0.04em] uppercase">
              {tabTitle}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-base">
              One place for direct contact and product support.
            </p>
          </div>

          {TabSwitcher}

          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 md:gap-12">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Send us a message</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                {submitted ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="bg-green-100 text-green-800 p-4 rounded-lg">
                      <p className="font-semibold text-sm">Thank you for your message</p>
                      <p className="text-sm">Our team will respond within 48 hours.</p>
                    </div>
                    <Button onClick={() => setSubmitted(false)} className="hover:bg-accent/80">
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-2">Name *</label>
                        <Input id="name" name="name" value={formData.name} onChange={handleChange} required placeholder="Your name" />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium mb-2">Email *</label>
                        <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="your@email.com" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="subject" className="block text-sm font-medium mb-2">Subject *</label>
                      <Input id="subject" name="subject" value={formData.subject} onChange={handleChange} required placeholder="What can we help with?" />
                    </div>
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium mb-2">Message *</label>
                      <Textarea id="message" name="message" value={formData.message} onChange={handleChange} required rows={5} placeholder="Tell us more..." />
                    </div>
                    <Button type="submit" className="w-full hover:bg-accent/80" disabled={isSubmitting}>
                      {isSubmitting ? "Sending..." : "Send Message"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4 sm:space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Direct Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-accent/10 p-2 rounded-lg shrink-0">
                      <Mail className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Email</h3>
                      <p className="text-muted-foreground text-sm">support@makeitsell.ng</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-accent/10 p-2 rounded-lg shrink-0">
                      <Phone className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Phone (WhatsApp)</h3>
                      <Link href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-muted-foreground text-sm hover:text-foreground">
                        {SUPPORT_PHONE}
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-accent/10 p-2 rounded-lg shrink-0">
                      <Clock className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Business Hours</h3>
                      <p className="text-muted-foreground text-sm">
                        Monday - Friday: 9:00 AM - 6:00 PM
                        <br />
                        Saturday: 10:00 AM - 4:00 PM
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Need instant support?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Chat with our AI assistant — understands English and Pidgin, available 24/7.
                  </p>
                  <Button variant="outline" className="w-full border-accent/40" onClick={() => setActiveTab("support")}>
                    Open Support Chat
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
