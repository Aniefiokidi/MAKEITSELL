"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import UserMenu from "@/components/auth/UserMenu"
import CartSidebar from "@/components/cart/CartSidebar"
import { useAuth } from "@/contexts/AuthContext"

export default function Header() {
  const { userProfile } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : ""
  }, [isMenuOpen])

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur-md shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-10">
        <div className="flex h-16 lg:h-20 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <img
              src="/images/logo.png"
              alt="BRANDA"
              className="h-10 lg:h-14 w-auto object-contain transition-all duration-300 hover:scale-105"
            />
          </Link>

          {/* Desktop Search */}
          <div className="hidden lg:flex flex-1 max-w-md xl:max-w-lg mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products, brands, categories..."
                className="pl-10 pr-4 h-10 rounded-2xl border-2 border-gray-200 
                  focus:border-[oklch(0.21_0.194_29.234)] focus:ring-[oklch(0.21_0.194_29.234)]/20 
                  transition-all shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden xl:flex items-center space-x-8">
            {["Shop", "Services", "About", "Contact", "Support"].map((link) => (
              <Link
                key={link}
                href={`/${link.toLowerCase()}`}
                className="relative text-sm font-medium text-gray-700 hover:text-[oklch(0.21_0.194_29.234)] transition-all group"
              >
                {link}
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[oklch(0.21_0.194_29.234)] transition-all duration-300 group-hover:w-full"></span>
              </Link>
            ))}
            {userProfile?.role !== "vendor" && (
              <Link
                href="/become-seller"
                className="text-sm font-semibold bg-gradient-to-r from-[oklch(0.21_0.194_29.234)] to-[oklch(0.32_0.194_29.234)] bg-clip-text text-transparent hover:scale-105 transition-all"
              >
                Sell
              </Link>
            )}
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
      </div>

      {/* Mobile Search Dropdown */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="lg:hidden px-4 pb-4"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="search"
                placeholder="Search products..."
                autoFocus
                className="pl-10 pr-10 py-2 rounded-xl border border-gray-300 
                  focus:outline-none focus:ring-2 
                  focus:ring-[oklch(0.21_0.194_29.234)]/50 
                  shadow-[0_0_12px_rgba(59,130,246,0.3)]"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  href="/shop"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 text-gray-700 hover:text-[oklch(0.21_0.194_29.234)] hover:bg-gray-50 rounded-md transition-colors"
                >
                  Products
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
              {!userProfile && (
                <div className="px-6 py-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-4">
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
