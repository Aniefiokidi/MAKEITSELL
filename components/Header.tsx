"use client"


import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import SmartSearch from "@/components/search/SmartSearch"
import UserMenu from "@/components/auth/UserMenu"
import CartSidebar from "@/components/cart/CartSidebar"
import { useAuth } from "@/contexts/AuthContext"

export default function Header({ homeBg = false }: { homeBg?: boolean }) {
  const { user, userProfile, loading } = useAuth()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : ""
  }, [isMenuOpen])

  // Handle smart search
  const handleSearch = (query: string) => {
    // Navigate to search results
    window.location.href = `/stores?search=${encodeURIComponent(query)}`
  }

  return (
    <header
      className={
        `sticky top-0 z-50 w-full ${homeBg
          ? 'bg-transparent' 
          : 'bg-white/95 dark:bg-background dark:text-foreground backdrop-blur-md shadow-sm'}
        `
      }
      style={homeBg ? {} : {}}
    >
      <div className="w-full px-2 sm:px-4 lg:px-10">
              {/* Gradient animation styles for homeBg */}
              {homeBg && (
                <style jsx global>{`
                  .animated-gradient-bg {
                    background: linear-gradient(120deg, var(--accent) 0%, #fff 50%, var(--accent) 100%);
                    background-size: 200% 200%;
                    animation: gradientWave 12s ease-in-out infinite;
                  }
                  .dark .animated-gradient-bg {
                    background: linear-gradient(120deg, #000 0%, #1a2236 60%, #000 100%);
                    background-size: 200% 200%;
                    animation: gradientWave 12s ease-in-out infinite;
                  }
                  @keyframes gradientWave {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                  }
                `}</style>
              )}
        <div className="flex h-10 md:h-14 lg:h-16 items-center justify-between gap-1">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <img
              src="/images/logo (2).png"
              alt="Make It Sell"
              className="h-3 sm:h-4 lg:h-8 w-auto object-contain transition-all duration-300 hover:scale-105"
              onError={(e) => {
                // Fallback to text logo if image fails
                e.currentTarget.style.display = 'none'
                const nextElement = e.currentTarget.nextElementSibling as HTMLElement
                if (nextElement) nextElement.style.display = 'block'
              }}
            />
            <span 
              className="text-lg sm:text-2xl lg:text-3xl font-bold text-[oklch(0.21_0.194_29.234)] dark:text-foreground hidden uppercase"
              style={{ fontFamily: 'serif' }}
            >
              MAKE IT SELL
            </span>
          </Link>

          {/* Centralized Desktop Nav */}
          <nav className="hidden xl:flex flex-1 justify-center items-center space-x-2 uppercase">
            {["Stores", "Services", "About", "Contact", "Support"].map((link) => {
              const isActive = pathname === `/${link.toLowerCase()}` || 
                (link === "Stores" && pathname === "/stores")
              
              return (
                <Link
                  key={link}
                  href={`/${link.toLowerCase()}`}
                  className={`relative px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-full font-medium transition-all duration-300 ${
                    isActive
                      ? "bg-white/20 backdrop-blur-md border border-white/30 text-[oklch(0.21_0.194_29.234)] dark:text-accent shadow-lg shadow-accent/10 dark:shadow-accent/20"
                      : "text-gray-700 dark:text-foreground hover:text-[oklch(0.21_0.194_29.234)] dark:hover:text-accent group"
                  }`}
                >
                  {isActive && (
                    <>
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-gradient-to-r from-accent/10 to-transparent rounded-full -z-10"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                      {/* Connecting tail */}
                      <motion.div
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute left-1/2 -translate-x-1/2 top-full w-12 h-6 bg-gradient-to-b from-white/20 to-transparent backdrop-blur-sm border-x border-white/20 rounded-b-2xl"
                        style={{
                          clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)"
                        }}
                      />
                    </>
                  )}
                  <span className="relative z-10">{link.toUpperCase()}</span>
                  {!isActive && (
                    <span className="absolute bottom-1 left-0 w-0 h-0.5 bg-[oklch(0.21_0.194_29.234)] dark:bg-accent transition-all duration-300 group-hover:w-full"></span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right Icons */}
          <div className="flex items-center gap-2">
            {/* Cart */}
            <CartSidebar />

            {/* Authentication */}
            {(user && userProfile) ? (
              <div className="flex items-center gap-3">
                <UserMenu />
              </div>
            ) : (
              <div className="hidden xl:flex items-center gap-3">
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-muted animate-pulse"></div>
                  </div>
                ) : (
                  <>
                    <Link href="/login">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-2 border-[oklch(0.21_0.194_29.234)] text-[oklch(0.21_0.194_29.234)] dark:border-accent dark:text-accent hover:bg-[oklch(0.21_0.194_29.234)] dark:hover:bg-accent hover:text-white dark:hover:text-background font-semibold transition-all duration-300 shadow-sm hover:shadow-md"
                      >
                        SIGN IN
                      </Button>
                    </Link>
                    <Link href="/signup">
                      <Button
                        size="sm"
                        className="bg-white dark:bg-background text-[oklch(0.21_0.194_29.234)] dark:text-accent border-2 border-[oklch(0.21_0.194_29.234)] dark:border-accent hover:bg-[oklch(0.21_0.194_29.234)] dark:hover:bg-accent hover:text-white dark:hover:text-background font-semibold transition-all duration-300 shadow-md hover:shadow-lg"
                      >
                        JOIN US
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="block xl:hidden hover:bg-accent/10 dark:hover:bg-accent/20"
              onClick={() => setIsMenuOpen((v) => !v)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Background overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black z-[90]"
              onClick={() => setIsMenuOpen(false)}
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 120, damping: 15 }}
              className="fixed top-0 right-0 w-[85vw] max-w-xs h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 shadow-2xl z-[100] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <img
                  src="/images/logo (2).png"
                  alt="Make It Sell"
                  className="h-4 sm:h-6 w-auto object-contain"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMenuOpen(false)}
                  className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Navigation Links - Oval Buttons */}
              <div className="px-3 sm:px-6 pt-6 sm:pt-8 pb-4 sm:pb-6 space-y-2 sm:space-y-4 flex-1 overflow-y-auto">
                <Link
                  href="/stores"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    Stores
                  </div>
                </Link>
                <Link
                  href="/services"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    Services
                  </div>
                </Link>
                <Link
                  href="/about"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    About Us
                  </div>
                </Link>
                <Link
                  href="/support"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    FAQS
                  </div>
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    Contact Us
                  </div>
                </Link>

                {/* Auth Buttons or User Profile */}
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-8 h-8 rounded-full bg-gray-300 animate-pulse"></div>
                  </div>
                ) : !(user && userProfile) ? (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="block w-full"
                    >
                      <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                        Sign in
                      </div>
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setIsMenuOpen(false)}
                      className="block w-full"
                    >
                      <div className="bg-white dark:bg-gray-800 text-[oklch(0.21_0.194_29.234)] dark:text-white border-2 border-[oklch(0.21_0.194_29.234)] dark:border-gray-600 px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:bg-[oklch(0.21_0.194_29.234)] hover:text-white dark:hover:bg-[oklch(0.25_0.194_29.234)] transition-all shadow-md hover:shadow-lg">
                        Join Us
                      </div>
                    </Link>
                  </>
                ) : null}
              </div>

              {/* Footer Section */}
              {!(user && userProfile) && (
                <div className="px-3 sm:px-6 py-3 sm:py-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-1">Get early access</h3>
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 mb-2">
                    Become a Make It Sell member to buy smarter, sell faster, and grow with the community.
                  </p>
                  <p className="text-[9px] text-gray-500 dark:text-gray-500">
                    © 2026 Make It Sell. All rights reserved.
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
