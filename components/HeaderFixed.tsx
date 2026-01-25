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
  const { userProfile } = useAuth()
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
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur-md shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-10">
        <div className="flex h-12 md:h-14 lg:h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <img
              src="/images/logo.png"
              alt="BRANDA"
              className="h-7 sm:h-8 lg:h-10 w-auto object-contain transition-all duration-300 hover:scale-105"
              onError={(e) => {
                // Fallback to text logo if image fails
                e.currentTarget.style.display = 'none'
                const nextElement = e.currentTarget.nextElementSibling as HTMLElement
                if (nextElement) nextElement.style.display = 'block'
              }}
            />
            <span 
              className="text-2xl lg:text-3xl font-bold text-[oklch(0.21_0.194_29.234)] hidden"
              style={{ fontFamily: 'serif' }}
            >
              BRANDA
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
            {["Shop", "Services", "About", "Contact", "Support"].map((link) => (
              <Link
                key={link}
                href={`/${link.toLowerCase()}`}
                className="relative text-xs sm:text-sm font-medium text-gray-700 hover:text-[oklch(0.21_0.194_29.234)] transition-all group"
              >
                {link}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[oklch(0.21_0.194_29.234)] transition-all duration-300 group-hover:w-full"></span>
              </Link>
            ))}

          </nav>

          {/* Right Icons */}
          <div className="flex items-center gap-2">
            {/* Mobile Search */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden hover:bg-accent/10"
              onClick={() => setIsSearchOpen((v) => !v)}
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Cart */}
            <div className="hidden sm:block">
              <CartSidebar />
            </div>

            {/* User menu (desktop) */}
            {userProfile ? <UserMenu /> : null}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="block xl:hidden hover:bg-accent/10"
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
              className="fixed top-12 right-0 w-72 h-[calc(100vh-3rem)] bg-white shadow-lg border-l border-gray-200 z-50 flex flex-col"
            >
              {/* Navigation Links */}
              <div className="px-4 pt-4 space-y-2 flex-1 overflow-y-auto">
                <Link
                  href="/shop"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 text-xs sm:text-sm text-gray-700 hover:text-[oklch(0.21_0.194_29.234)] hover:bg-gray-50 rounded-md transition-colors"
                >
                  Products
                </Link>
                <Link
                  href="/services"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 text-xs sm:text-sm text-gray-700 hover:text-[oklch(0.21_0.194_29.234)] hover:bg-gray-50 rounded-md transition-colors"
                >
                  Services
                </Link>
                <Link
                  href="/categories"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 text-xs sm:text-sm text-gray-700 hover:text-[oklch(0.21_0.194_29.234)] hover:bg-gray-50 rounded-md transition-colors"
                >
                  Categories
                </Link>
                <Link
                  href="/cart"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 text-xs sm:text-sm text-gray-700 hover:text-[oklch(0.21_0.194_29.234)] hover:bg-gray-50 rounded-md transition-colors"
                >
                  Cart
                </Link>
              </div>

              {/* Footer */}
              {!userProfile && (
                <div className="px-6 py-6 border-t border-gray-200">
                  <p className="text-xs sm:text-sm text-gray-600 mb-4">
                    Become a Branda member to buy smarter, sell faster, and grow with the community.{" "}
                    <span className="font-medium text-black cursor-pointer">Learn more</span>
                  </p>
                  <div className="flex space-x-3">
                    <Link href="/signup" onClick={() => setIsMenuOpen(false)}>
                      <Button className="bg-black text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-800">
                        Join Us
                      </Button>
                    </Link>
                    <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                      <Button
                        variant="outline"
                        className="border border-gray-400 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100"
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