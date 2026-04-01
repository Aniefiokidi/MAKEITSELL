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
import { Badge } from "@/components/ui/badge"
import { Mail, Phone, Clock, MessageCircle, Ticket, HelpCircle, ArrowRight } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import SupportChat from "@/components/support/SupportChat"

type HubTab = "contact" | "support"

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
    return activeTab === "contact" ? "Contact Us" : "Contact and Support"
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="container mx-auto px-2 sm:px-4 py-8 sm:py-14 flex-1">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
          <div className="text-center space-y-2">
            <h1 className="font-['Bebas_Neue'] text-4xl sm:text-5xl md:text-6xl leading-none tracking-[0.04em] uppercase">{tabTitle}</h1>
            <p className="text-muted-foreground text-xs sm:text-base">
              One place for direct contact and product support.
            </p>
          </div>

          <div className="mx-auto w-full max-w-md rounded-full border border-accent/30 bg-muted/30 p-1">
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
                Support Center
              </button>
            </div>
          </div>

          {activeTab === "contact" ? (
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
                          <label htmlFor="name" className="block text-sm font-medium mb-2">
                            Name *
                          </label>
                          <Input
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            placeholder="Your name"
                          />
                        </div>
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium mb-2">
                            Email *
                          </label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            placeholder="your@email.com"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="subject" className="block text-sm font-medium mb-2">
                          Subject *
                        </label>
                        <Input
                          id="subject"
                          name="subject"
                          value={formData.subject}
                          onChange={handleChange}
                          required
                          placeholder="What can we help with?"
                        />
                      </div>

                      <div>
                        <label htmlFor="message" className="block text-sm font-medium mb-2">
                          Message *
                        </label>
                        <Textarea
                          id="message"
                          name="message"
                          value={formData.message}
                          onChange={handleChange}
                          required
                          rows={5}
                          placeholder="Tell us more..."
                        />
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
                      <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                        <Mail className="w-5 h-5 text-black" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Email</h3>
                        <p className="text-muted-foreground text-sm">noreply@makeitsell.org</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                        <Phone className="w-5 h-5 text-black" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Phone</h3>
                        <p className="text-muted-foreground text-sm">+234 9077874884</p>
                        <p className="text-muted-foreground text-sm">+234 7031986441</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                        <Clock className="w-5 h-5 text-black" />
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
                    <CardTitle className="text-lg">Need customer support?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      Switch to Support Center for live chat and ticketing.
                    </p>
                    <Button variant="outline" className="w-full border-accent/40" onClick={() => setActiveTab("support")}>
                      Go To Support Center
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
              <Card className="lg:col-span-2 border-accent/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-accent" />
                    AI Support Assistant
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Chat instantly with AI support for orders, accounts, vendor issues, and technical help.
                  </p>
                  <SupportChat />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-accent" />
                    Quick Help
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <h4 className="font-semibold mb-1">Common Issues</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>Order tracking and delivery updates</li>
                      <li>Returns and refunds</li>
                      <li>Login and account issues</li>
                      <li>Payment verification</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border p-3">
                    <h4 className="font-semibold mb-1">Response Times</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>AI Assistant: Instant</li>
                      <li>Human Agent: 2 to 4 hours</li>
                      <li>Vendor Issues: 24 to 48 hours</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3 bg-linear-to-r from-accent/10 to-primary/10 border-accent/30">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">Want to message the team directly?</p>
                    <p className="text-sm text-muted-foreground">Use the Contact Team tab for direct email follow-up.</p>
                  </div>
                  <Button variant="outline" className="border-accent/40" onClick={() => setActiveTab("contact")}>
                    Contact Team
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex justify-center">
            <Badge variant="outline" className="border-accent/30 text-accent">
              Contact and Support are now unified in one page
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}
