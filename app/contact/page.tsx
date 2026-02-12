"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Phone, MapPin, Clock } from "lucide-react"
import Header from "@/components/Header"

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setSubmitted(true)
    setIsSubmitting(false)
    setFormData({ name: "", email: "", subject: "", message: "" })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header/>
      <div className="container mx-auto px-2 sm:px-4 py-8 sm:py-16 flex-1">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6 sm:mb-12">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-4">Contact Us</h1>
            <p className="text-muted-foreground text-xs sm:text-base">
              We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 md:gap-12">
            {/* Contact Form */}
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Send us a message</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                {submitted ? (
                  <div className="text-center py-6 sm:py-8">
                    <div className="bg-green-100 text-green-800 p-3 sm:p-4 rounded-lg mb-3 sm:mb-4">
                      <p className="font-semibold text-xs sm:text-sm">Thank you for your message!</p>
                      <p className="text-xs sm:text-sm">We'll get back to you within 24 hours.</p>
                    </div>
                    <Button onClick={() => setSubmitted(false)} className="hover:bg-accent/80 hover:scale-105 transition-all hover:shadow-lg text-xs sm:text-sm">Send Another Message</Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-6">
                    <div className="grid sm:grid-cols-2 gap-2 sm:gap-4">
                      <div>
                        <label htmlFor="name" className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2">
                          Name *
                        </label>
                        <Input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          placeholder="Your name"
                          className="text-xs sm:text-sm py-1.5 sm:py-2 h-8 sm:h-10"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2">
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
                          className="text-xs sm:text-sm py-1.5 sm:py-2 h-8 sm:h-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="subject" className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2">
                        Subject *
                      </label>
                      <Input
                        id="subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        placeholder="What is this about?"
                        className="text-xs sm:text-sm py-1.5 sm:py-2 h-8 sm:h-10"
                      />
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2">
                        Message *
                      </label>
                      <Textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={4}
                        placeholder="Tell us more..."
                        className="text-xs sm:text-sm py-1.5 sm:py-2"
                      />
                    </div>

                    <Button type="submit" className="w-full hover:bg-accent/80 hover:scale-105 transition-all hover:shadow-lg text-xs sm:text-sm" disabled={isSubmitting}>
                      {isSubmitting ? "Sending..." : "Send Message"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Contact Information */}
            <div className="space-y-4 sm:space-y-8">
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">Get in touch</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-6 p-3 sm:p-6">
                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="bg-primary/10 p-2 sm:p-3 rounded-lg shrink-0">
                      <Mail className="w-4 h-4 sm:w-6 sm:h-6 text-black" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-xs sm:text-base mb-0.5 sm:mb-1">Email</h3>
                      <p className="text-muted-foreground text-[10px] sm:text-sm truncate">noreply@makeitsell.org</p>
                      <p className="text-muted-foreground text-[10px] sm:text-sm truncate">noreply@makeitsell.org</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="bg-primary/10 p-2 sm:p-3 rounded-lg shrink-0">
                      <Phone className="w-4 h-4 sm:w-6 sm:h-6 text-black" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-xs sm:text-base mb-0.5 sm:mb-1">Phone</h3>
                      <p className="text-muted-foreground text-[10px] sm:text-sm truncate">07055590445</p>
                      <p className="text-muted-foreground text-[10px] sm:text-sm truncate">08025282040</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="bg-primary/10 p-2 sm:p-3 rounded-lg shrink-0">
                      <Clock className="w-4 h-4 sm:w-6 sm:h-6 text-black" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-xs sm:text-base mb-0.5 sm:mb-1">Business Hours</h3>
                      <p className="text-muted-foreground text-[10px] sm:text-sm leading-relaxed">
                        Monday - Friday: 9:00 AM - 6:00 PM
                        <br />
                        Saturday: 10:00 AM - 4:00 PM
                        <br />
                        Sunday: Closed
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">Frequently Asked Questions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
                  <div>
                    <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">How do I become a seller?</h4>
                    <p className="text-muted-foreground text-[10px] sm:text-sm">
                      Sign up for an account, then upgrade to a vendor account. You'll need to pay a monthly subscription to list products and start selling on our platform.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">What payment methods do you accept?</h4>
                    <p className="text-muted-foreground text-[10px] sm:text-sm">
                      We use Paystack for secure payments. You can pay with credit/debit cards, bank transfers, and mobile money.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">How much does delivery cost?</h4>
                    <p className="text-muted-foreground text-[10px] sm:text-sm">
                      Delivery cost is determined by the rider upon delivery. The exact fee will be communicated when your order arrives.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs sm:text-base mb-1 sm:mb-2">Is there a subscription fee for sellers?</h4>
                    <p className="text-muted-foreground text-[10px] sm:text-sm">
                      Yes, vendors need an active monthly subscription to list products and receive orders. Contact us for current pricing.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
