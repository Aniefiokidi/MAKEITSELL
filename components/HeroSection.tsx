"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { ArrowRight, Search, Star, Users, Shield, Sparkles } from "lucide-react"
import Image from "next/image"

 
function HeroSection() {
    const { userProfile } = useAuth();
    return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-white via-gray-100 to-white dark:from-black dark:via-gray-900 dark:to-black">
      {/* Floating bubbles with images */}
      <style jsx global>{`
        @keyframes bubbleFloat1 {
          0% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.08); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes bubbleFloat2 {
          0% { transform: translateY(0) scale(1); }
          50% { transform: translateY(40px) scale(0.95); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes bubbleFloat3 {
          0% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.1); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes bubbleFloat4 {
          0% { transform: translateY(0) scale(1); }
          50% { transform: translateY(30px) scale(0.92); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes bubbleFloat5 {
          0% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-15px) scale(1.05); }
          100% { transform: translateY(0) scale(1); }
        }
        .bubble-anim-1 { animation: bubbleFloat1 7s ease-in-out infinite; }
        .bubble-anim-2 { animation: bubbleFloat2 9s ease-in-out infinite; }
        .bubble-anim-3 { animation: bubbleFloat3 6s ease-in-out infinite; }
        .bubble-anim-4 { animation: bubbleFloat4 8s ease-in-out infinite; }
        .bubble-anim-5 { animation: bubbleFloat5 10s ease-in-out infinite; }
      `}</style>
      <div className="pointer-events-none select-none">
        {/* Bubble 1 */}
        <div className="absolute top-[8%] left-[2%] bubble-anim-1 z-10 w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40">
          <div className="w-full h-full rounded-full bg-white/30 dark:bg-white/10 backdrop-blur-lg shadow-xl flex items-center justify-center overflow-hidden border-2 border-accent">
            <Image src="/images/logo (1).jpg" alt="Bubble 1" fill className="object-fit w-full h-full" />
          </div>
        </div>
        {/* Bubble 2 */}
        <div className="absolute top-[18%] right-[4%] bubble-anim-2 z-10 w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32">
          <div className="w-full h-full rounded-full bg-white/30 dark:bg-white/10 backdrop-blur-lg shadow-xl flex items-center justify-center overflow-hidden border-2 border-accent">
            <Image src="/images/logo2.png" alt="Bubble 2" fill className="object-cover w-full h-full bg-white" />
          </div>
        </div>
        {/* Bubble 3 */}
        <div className="absolute bottom-[12%] left-[8%] bubble-anim-3 z-10 w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28">
          <div className="w-full h-full rounded-full bg-white/30 dark:bg-white/10 backdrop-blur-lg shadow-xl flex items-center justify-center overflow-hidden border-2 border-accent">
            <Image src="/images/Home.png" alt="Bubble 3" fill className="object-cover w-full h-full" />
          </div>
        </div>
        {/* Bubble 4 */}
        <div className="absolute bottom-[10%] right-[6%] bubble-anim-4 z-10 w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36">
          <div className="w-full h-full rounded-full bg-white/30 dark:bg-white/10 backdrop-blur-lg shadow-xl flex items-center justify-center overflow-hidden border-2 border-accent">
            <Image src="/images/logo (2).png" alt="Bubble 4" fill className="object-fit w-full h-full bg-white" />
          </div>
        </div>
        {/* Bubble 5 */}
        <div className="absolute top-[55%] left-[45%] bubble-anim-5 z-10 w-12 h-12 sm:w-16 sm:h-16 md:w-24 md:h-24">
          <div className="w-full h-full rounded-full bg-white/30 dark:bg-white/10 backdrop-blur-lg shadow-xl flex items-center justify-center overflow-hidden border-2 border-accent">
            <Image src="/bubble5.jpg" alt="Bubble 5" fill className="object-cover w-full h-full" />
          </div>
        </div>
      </div>

      {/* Frosted glass hero content */}
      <div className="container mx-auto px-2 sm:px-4 md:px-8 lg:px-12 xl:px-16 relative z-20 w-full">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center justify-center gap-4 bg-white/70 dark:bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl p-4 sm:p-8 md:p-12 border border-white/20">
          {/* Logo and tagline */}
          <div className="flex flex-col items-center gap-2 mb-2">
            <Image src="/images/logo2.png" alt="MakeItSell Logo" width={120} height={120} className="rounded-xl shadow-lg bg-white/80 p-2" />
            <span className="text-accent font-bold text-lg sm:text-xl tracking-wide">WHERE EVERYTHING SELLS!</span>
          </div>

          {/* Main headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-neutral-900 dark:text-white drop-shadow mb-2">
            Find What You Love, <span className="text-accent">From Real People</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-neutral-700 dark:text-gray-200 max-w-2xl mx-auto mb-2">
            Nigeria’s most trusted marketplace for unique products, unbeatable prices, and real customer support.
          </p>

          {/* Search bar */}
          <form className="flex w-full max-w-md mx-auto bg-white/90 dark:bg-white/20 rounded-full shadow-lg overflow-hidden border border-accent/30 focus-within:ring-2 focus-within:ring-accent">
            <input
              type="text"
              placeholder="What are you looking for today?"
              className="flex-1 px-4 py-2 text-neutral-900 dark:text-white bg-transparent outline-none placeholder:text-neutral-500 dark:placeholder:text-gray-300"
              aria-label="Search products"
            />
            <Button type="submit" className="rounded-none rounded-r-full bg-accent hover:bg-accent/90 text-white px-4">
              <Search className="h-5 w-5" />
            </Button>
          </form>


          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-2">
            <Button
              asChild
              size="lg"
              className="group bg-accent hover:bg-accent/90 text-white px-8 py-3 text-lg font-semibold rounded-full shadow-2xl hover:shadow-accent/25 transition-all duration-300 transform hover:scale-105"
            >
              <Link href="/stores" className="flex items-center justify-center">
                Start Shopping
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="group border-accent text-accent px-8 py-3 text-lg font-semibold rounded-full shadow-2xl hover:bg-accent/10 hover:shadow-accent/25 transition-all duration-300 transform hover:scale-105"
            >
              <Link href="/services" className="flex items-center justify-center">
                Explore Services
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
            </Button>
          </div>

          {/* Features section */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            <div className="text-center p-4 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur border border-white/10">
              <Shield className="h-7 w-7 text-accent mx-auto mb-2" />
              <h3 className="font-semibold mb-1 text-sm text-neutral-900 dark:text-white">Secure Payment</h3>
              <p className="text-neutral-700 dark:text-gray-300 text-xs leading-relaxed">Protected transactions</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur border border-white/10">
              <Users className="h-7 w-7 text-accent mx-auto mb-2" />
              <h3 className="font-semibold mb-1 text-sm text-neutral-900 dark:text-white">Trusted Vendors</h3>
              <p className="text-neutral-700 dark:text-gray-300 text-xs leading-relaxed">Verified sellers</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur border border-white/10">
              <Sparkles className="h-7 w-7 text-accent mx-auto mb-2" />
              <h3 className="font-semibold mb-1 text-sm text-neutral-900 dark:text-white">Customer Service</h3>
              <p className="text-neutral-700 dark:text-gray-300 text-xs leading-relaxed">24/7 intelligent customer assistance</p>
            </div>
          </div>

          {/* Scroll down indicator */}
          <div className="mt-8 flex flex-col items-center animate-bounce">
            <span className="text-white/70 text-xs mb-1">Scroll to explore more</span>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" viewBox="0 0 24 24"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection;
