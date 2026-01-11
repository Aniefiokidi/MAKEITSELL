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

            {/* UserMenu for mobile (always visible) */}
            <div className="flex xl:hidden items-center">
              <UserMenu />
            </div>

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
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setIsMenuOpen(false)}
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 15 }}
              className="fixed top-16 right-0 w-72 h-[calc(100vh-4rem)] bg-white shadow-lg border-l border-gray-200 z-50 flex flex-col"
            >
              {/* Navigation Links */}
              <div className="px-4 pt-4 space-y-2 flex-1 overflow-y-auto">
                <Link
                  href="/stores"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 text-gray-700 hover:text-[oklch(0.21_0.194_29.234)] hover:bg-gray-50 rounded-md transition-colors"
                >
                  Stores
                </Link>
                <Link
                  href="/services"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 text-gray-700 hover:text-[oklch(0.21_0.194_29.234)] hover:bg-gray-50 rounded-md transition-colors"
                >
                  Services
                </Link>
                <Link
                  href="/categories"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 text-gray-700 hover:text-[oklch(0.21_0.194_29.234)] hover:bg-gray-50 rounded-md transition-colors"
                >
                  Categories
                </Link>
                <Link
                  href="/cart"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 text-gray-700 hover:text-[oklch(0.21_0.194_29.234)] hover:bg-gray-50 rounded-md transition-colors"
                >
                  Cart
                </Link>
              </div>

              {/* Footer */}
              {loading ? (
                <div className="px-6 py-6 border-t border-gray-200">
                  <div className="flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
                  </div>
                </div>
              ) : !(user && userProfile) && (
                <div className="px-6 py-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-4">
                    Become a Make It Sell member to buy smarter, sell faster, and grow with the community.{" "}
                    <span className="font-medium text-[oklch(0.21_0.194_29.234)] cursor-pointer hover:underline">Learn more</span>
                  </p>
                  <div className="flex space-x-3">
                    <Link href="/signup" onClick={() => setIsMenuOpen(false)}>
                      <Button className="bg-white text-[oklch(0.21_0.194_29.234)] border-2 border-[oklch(0.21_0.194_29.234)] px-4 py-2 rounded-full text-sm font-semibold hover:bg-[oklch(0.21_0.194_29.234)] hover:text-white transition-all duration-300 shadow-md hover:shadow-lg">
                        Join Us
                      </Button>
                    </Link>
                    <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                      <Button
                        variant="outline"
                        className="border-2 border-[oklch(0.21_0.194_29.234)] text-[oklch(0.21_0.194_29.234)] px-4 py-2 rounded-full text-sm font-semibold hover:bg-[oklch(0.21_0.194_29.234)] hover:text-white transition-all duration-300 shadow-sm hover:shadow-md"
                      >
                        Sign In
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
