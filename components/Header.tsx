"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import SmartSearch from "@/components/search/SmartSearch"
import UserMenu from "@/components/auth/UserMenu"
import CartSidebar from "@/components/cart/CartSidebar"
import { useAuth } from "@/contexts/AuthContext"

export default function Header() {
  const { user, userProfile, loading } = useAuth()
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
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 dark:bg-background dark:border-muted dark:text-foreground backdrop-blur-md shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-10">
        <div className="flex h-16 lg:h-20 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <img
              src="/images/logo (2).png"
              alt="Make It Sell"
              className="h-4 lg:h-8 w-auto object-contain transition-all duration-300 hover:scale-105"
              onError={(e) => {
                // Fallback to text logo if image fails
                e.currentTarget.style.display = 'none'
                const nextElement = e.currentTarget.nextElementSibling as HTMLElement
                if (nextElement) nextElement.style.display = 'block'
              }}
            />
            <span 
              className="text-2xl lg:text-3xl font-bold text-[oklch(0.21_0.194_29.234)] dark:text-foreground hidden"
              style={{ fontFamily: 'serif' }}
            >
              Make It Sell
            </span>
          </Link>

          {/* Desktop Search */}
          <div className="hidden lg:flex flex-1 max-w-md xl:max-w-lg mx-8">
            <SmartSearch 
              onSearch={handleSearch}
              placeholder="Search products, brands, categories..."
              className="w-full"
            />
          </div>

          {/* Desktop Nav */}
          <nav className="hidden xl:flex items-center space-x-8">
            {["Stores", "Services", "About", "Contact", "Support"].map((link) => (
              <Link
                key={link}
                href={`/${link.toLowerCase()}`}
                className="relative text-sm font-medium text-gray-700 dark:text-foreground hover:text-[oklch(0.21_0.194_29.234)] dark:hover:text-accent transition-all group"
              >
                {link}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[oklch(0.21_0.194_29.234)] dark:bg-accent transition-all duration-300 group-hover:w-full"></span>
              </Link>
            ))}
          </nav>

          {/* Right Icons */}
          <div className="flex items-center gap-2">
            {/* Mobile Search */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden hover:bg-accent/10 dark:hover:bg-accent/20"
              onClick={() => setIsSearchOpen((v) => !v)}
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Cart */}
            <CartSidebar />

            {/* Authentication (desktop only - xl and above) - Hidden on mobile/tablet */}
            {(user && userProfile) ? (
              <div className="hidden xl:flex items-center gap-3">
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
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/signup">
                      <Button
                        size="sm"
                        className="bg-white dark:bg-background text-[oklch(0.21_0.194_29.234)] dark:text-accent border-2 border-[oklch(0.21_0.194_29.234)] dark:border-accent hover:bg-[oklch(0.21_0.194_29.234)] dark:hover:bg-accent hover:text-white dark:hover:text-background font-semibold transition-all duration-300 shadow-md hover:shadow-lg"
                      >
                        Join Us
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

        {/* Mobile Search Dropdown */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="lg:hidden px-0 pb-4 overflow-hidden"
            >
              <div className="pt-4">
                <SmartSearch 
                  onSearch={(query) => {
                    handleSearch(query)
                    setIsSearchOpen(false)
                  }}
                  placeholder="Search products, brands, categories..."
                  className="w-full"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
              className="fixed top-0 right-0 w-80 h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 shadow-2xl z-[100] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <img
                  src="/images/logo (2).png"
                  alt="Make It Sell"
                  className="h-6 w-auto object-contain"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMenuOpen(false)}
                  className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Navigation Links - Oval Buttons */}
              <div className="px-6 pt-8 pb-6 space-y-4 flex-1 overflow-y-auto">
                <Link
                  href="/stores"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-8 py-4 rounded-full text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    Stores
                  </div>
                </Link>
                <Link
                  href="/services"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-8 py-4 rounded-full text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    Services
                  </div>
                </Link>
                <Link
                  href="/about"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-8 py-4 rounded-full text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    About Us
                  </div>
                </Link>
                <Link
                  href="/support"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-8 py-4 rounded-full text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    FAQS
                  </div>
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-8 py-4 rounded-full text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    Contact Us
                  </div>
                </Link>

                {/* Auth Buttons */}
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-8 h-8 rounded-full bg-gray-300 animate-pulse"></div>
                  </div>
                ) : !(user && userProfile) && (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="block w-full"
                    >
                      <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-8 py-4 rounded-full text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                        Sign in
                      </div>
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setIsMenuOpen(false)}
                      className="block w-full"
                    >
                      <div className="bg-white dark:bg-gray-800 text-[oklch(0.21_0.194_29.234)] dark:text-white border-2 border-[oklch(0.21_0.194_29.234)] dark:border-gray-600 px-8 py-4 rounded-full text-center font-medium hover:bg-[oklch(0.21_0.194_29.234)] hover:text-white dark:hover:bg-[oklch(0.25_0.194_29.234)] transition-all shadow-md hover:shadow-lg">
                        Join Us
                      </div>
                    </Link>
                  </>
                )}
              </div>

              {/* Footer Section */}
              {!(user && userProfile) && (
                <div className="px-6 py-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Get early access</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    Become a Make It Sell member to buy smarter, sell faster, and grow with the community.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
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
