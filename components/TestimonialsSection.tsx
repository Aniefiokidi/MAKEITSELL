"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Star, User } from "lucide-react"

const testimonials = [
  {
    id: 1,
    name: "Sarah Johnson",
    role: "Verified Buyer",
    content:
      "Fast delivery and exceptional quality! The website is incredibly easy to navigate and the customer service is outstanding. I've been shopping here for months and never had any issues.",
    rating: 5,
  },
  {
    id: 2,
    name: "Mike Chen",
    role: "Small Business Owner",
    content:
      "I've been selling on BRANDA for over a year now. The platform is user-friendly and the AI support system helps resolve customer issues quickly. Perfect for growing my business!",
    rating: 5,
  },
  {
    id: 3,
    name: "Emily Rodriguez",
    role: "Frequent Shopper",
    content:
      "The website design is clean and modern. I love how easy it is to find exactly what I'm looking for. The AI chat feature is incredibly helpful when I have questions.",
    rating: 5,
  },
  {
    id: 4,
    name: "David Thompson",
    role: "Tech Enthusiast",
    content:
      "BRANDA has the best selection of electronics I've found online. The vendor ratings and reviews help me make informed decisions. Highly recommend to all tech lovers!",
    rating: 5,
  },
  {
    id: 5,
    name: "Lisa Park",
    role: "Fashion Lover",
    content:
      "Amazing variety of fashion items from different sellers worldwide. The quality is always as described and shipping is super fast. My absolute go-to shopping destination!",
    rating: 5,
  },
  {
    id: 6,
    name: "James Wilson",
    role: "Home Decorator",
    content:
      "Found the perfect furniture and decor items for my home renovation. The search filters make it easy to find exactly what I need. Excellent marketplace!",
    rating: 5,
  },
]

export default function TestimonialsSection() {
  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12 lg:mb-16 animate-fade-in">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>
            What Our Customers Say
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 max-w-2xl lg:max-w-3xl mx-auto leading-relaxed">
            Trusted by shoppers nationwide. Here's what our community has to say about their BRANDA experience.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <Card
              key={testimonial.id}
              className="hover:shadow transition-shadow duration-300 h-full animate-scale-in hover-lift"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
                {/* Rating stars */}
                <div className="flex items-center mb-3 sm:mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 ${
                        i < testimonial.rating
                          ? "text-yellow-400 fill-current"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-xs sm:text-sm font-semibold text-gray-700">
                    {testimonial.rating}.0
                  </span>
                </div>

                <blockquote className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base leading-relaxed flex-grow">
                  "{testimonial.content}"
                </blockquote>

                <div className="flex items-center gap-3">
                  {/* Simple professional avatar */}
                  <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900">
                      {testimonial.name}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
