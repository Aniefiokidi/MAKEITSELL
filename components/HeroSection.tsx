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
      {/* Background video with gradient overlay */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="/VID.MOV"
        autoPlay
        muted
        loop
        playsInline
        poster="/hero-img.jpg"
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
          <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight mb-3 sm:mb-5 md:mb-7">
            <span className="text-white animate-fade-in" style={{
              textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))'
            }}>
              Discover Amazing
            </span>
            <span className="text-white block mt-0 animate-fade-in-delay" style={{
              textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))'
            }}>
              Products
            </span>
          </h1>

          {/* Enhanced description */}
          <p className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl text-gray-200 max-w-xs sm:max-w-sm md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto mb-4 sm:mb-6 md:mb-8 leading-relaxed px-2 sm:px-4 md:px-0 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            Shop from trusted vendors nationwide. Secure payments & unbeatable prices.
          </p>

          {/* Enhanced CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 justify-center items-center px-3 sm:px-6 md:px-0 animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <Button
              asChild
              size="lg"
              className="group bg-accent hover:bg-accent/90 text-white px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 lg:py-5 text-xs sm:text-sm md:text-base font-semibold rounded-full shadow-2xl hover:shadow-accent/25 transition-all duration-300 transform hover:scale-105 w-full sm:w-auto max-w-xs sm:max-w-none hover-lift"
            >
              <Link href="/stores" className="flex items-center justify-center">
                Start Shopping
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
            </Button>
          </div>

          {/* Additional features showcase */}
          <div className="mt-6 sm:mt-8 md:mt-10 lg:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4 max-w-6xl mx-auto px-2 sm:px-4 md:px-0">
            <div className="text-center p-2 sm:p-3 md:p-4 lg:p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 animate-scale-in hover-lift" style={{ animationDelay: '0.8s' }}>
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 text-accent mx-auto mb-1 sm:mb-2 animate-float" />
              <h3 className="text-white font-semibold mb-1 text-[10px] sm:text-xs md:text-sm">Secure Payment</h3>
              <p className="text-gray-300 text-[8px] sm:text-xs leading-relaxed">Protected transactions</p>
            </div>
            <div className="text-center p-2 sm:p-3 md:p-4 lg:p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 animate-scale-in hover-lift" style={{ animationDelay: '0.9s' }}>
              <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 text-accent mx-auto mb-1 sm:mb-2 animate-float" style={{ animationDelay: '0.2s' }} />
              <h3 className="text-white font-semibold mb-1 text-[10px] sm:text-xs md:text-sm">Trusted Vendors</h3>
              <p className="text-gray-300 text-[8px] sm:text-xs leading-relaxed">Verified sellers</p>
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
