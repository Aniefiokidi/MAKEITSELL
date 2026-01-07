"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { ShoppingBag, Users, Shield, Star, ArrowRight, Sparkles } from "lucide-react"

export default function HeroSection() {
  const { userProfile } = useAuth()
  
  return (
    <section className="relative min-h-[100vh] sm:min-h-[90vh] md:min-h-[90vh]  flex items-center justify-center overflow-hidden">
      {/* Background with enhanced gradient overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('/hero-img.jpg')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-black via-black/70 to-black" />
      
      {/* Animated background elements - Hidden on mobile for better performance */}
      <div className="absolute inset-0 overflow-hidden hidden lg:block">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-accent rounded-full animate-pulse opacity-60" />
        <div className="absolute top-3/4 right-1/3 w-1 h-1 bg-white rounded-full animate-pulse opacity-40" />
        <div className="absolute top-1/2 right-1/4 w-3 h-3 bg-accent/50 rounded-full animate-pulse opacity-50" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 relative z-10 w-full">
        <div className="max-w-7xl mx-auto text-center">
          {/* Main headline with enhanced typography */}
          <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight mb-4 sm:mb-6 md:mb-8">
            <span className="text-white animate-fade-in" style={{
              textShadow: '2px 2px 0 hsl(var(--accent)), -2px -2px 0 hsl(var(--accent)), 2px -2px 0 hsl(var(--accent)), -2px 2px 0 hsl(var(--accent))'
            }}>
              Discover Amazing
            </span>
            <span className="text-white block mt-0 animate-fade-in-delay" style={{
              textShadow: '2px 2px 0 hsl(var(--accent)), -2px -2px 0 hsl(var(--accent)), 2px -2px 0 hsl(var(--accent)), -2px 2px 0 hsl(var(--accent))'
            }}>
              Products
            </span>
          </h1>

          {/* Enhanced description */}
          <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-gray-200 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto mb-6 sm:mb-8 md:mb-10 leading-relaxed px-2 sm:px-4 md:px-0 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            Shop from thousands of trusted vendors nationwide. Enjoy excellent customer service,
            secure payments, and unbeatable prices on quality products.
          </p>

          {/* Enhanced CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-5 justify-center items-center px-4 sm:px-6 md:px-0 animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <Button
              asChild
              size="lg"
              className="group bg-accent hover:bg-accent/90 text-white px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 lg:py-6 text-sm sm:text-base md:text-lg font-semibold rounded-full shadow-2xl hover:shadow-accent/25 transition-all duration-300 transform hover:scale-105 w-full sm:w-auto max-w-xs sm:max-w-none hover-lift"
            >
              <Link href="/stores" className="flex items-center justify-center">
                Start Shopping
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
            </Button>
            
            {userProfile?.role !== "vendor" && (
              <Button
                asChild
                variant="outline"
                size="lg"
                className="group border-2 border-white text-white hover:bg-white hover:text-black px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 lg:py-6 text-sm sm:text-base md:text-lg font-semibold rounded-full backdrop-blur-sm bg-white/10 transition-all duration-300 transform hover:scale-105 w-full sm:w-auto max-w-xs sm:max-w-none hover-lift"
              >
                <Link href="/become-seller" className="flex items-center justify-center">
                  Become a Seller
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </Link>
              </Button>
            )}
          </div>

          {/* Additional features showcase */}
          <div className="mt-8 sm:mt-10 md:mt-12 lg:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 max-w-6xl mx-auto px-2 sm:px-4 md:px-0">
            <div className="text-center p-3 sm:p-4 md:p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 animate-scale-in hover-lift" style={{ animationDelay: '0.8s' }}>
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 text-accent mx-auto mb-2 sm:mb-3 animate-float" />
              <h3 className="text-white font-semibold mb-1 sm:mb-2 text-xs sm:text-sm md:text-base">Secure Payment</h3>
              <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">Protected transactions with multiple payment options</p>
            </div>
            <div className="text-center p-3 sm:p-4 md:p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 animate-scale-in hover-lift" style={{ animationDelay: '0.9s' }}>
              <Users className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 text-accent mx-auto mb-2 sm:mb-3 animate-float" style={{ animationDelay: '0.2s' }} />
              <h3 className="text-white font-semibold mb-1 sm:mb-2 text-xs sm:text-sm md:text-base">Trusted Vendors</h3>
              <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">Verified sellers with quality guarantees</p>
            </div>
            <div className="text-center p-3 sm:p-4 md:p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 col-span-1 animate-scale-in hover-lift" style={{ animationDelay: '1s' }}>
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 text-accent mx-auto mb-2 sm:mb-3 animate-float" style={{ animationDelay: '0.4s' }} />
              <h3 className="text-white font-semibold mb-1 sm:mb-2 text-xs sm:text-sm md:text-base">Customer Service</h3>
              <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">24/7 intelligent customer assistance</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
