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

  // Prevent body scroll when menu is open
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
                           focus:border-[oklch(0.21_0.194_29.234)] 
                           focus:ring-[oklch(0.21_0.194_29.234)]/20 
                           transition-all shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Desktop Navigation */}
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
            {/* Mobile Search Icon */}
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

            {/* User Menu */}
            {userProfile ? <UserMenu /> : null}

            {/* Mobile Menu Button */}
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

      {/* Mobile Search Bar (slide down) */}
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

      {/* Mobile Drawer (Right side) */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Overlay */}
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
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed top-0 right-0 w-[80%] max-w-sm h-full bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <img src="/images/logo.png" alt="BRANDA" className="h-10 object-contain" />
                <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Links */}
              <nav className="flex flex-col px-5 py-4 space-y-4 overflow-y-auto">
                {["Shop", "Services", "About", "Contact", "Support"].map((link) => (
                  <Link
                    key={link}
                    href={`/${link.toLowerCase()}`}
                    onClick={() => setIsMenuOpen(false)}
                    className="text-sm font-semibold hover:text-[oklch(0.21_0.194_29.234)] transition-all"
                  >
                    {link}
                  </Link>
                ))}

                {userProfile?.role !== "vendor" && (
                  <Link
                    href="/become-seller"
                    onClick={() => setIsMenuOpen(false)}
                    className="text-sm font-semibold text-white bg-[oklch(0.21_0.194_29.234)] rounded-md px-4 py-2 text-center hover:bg-[oklch(0.32_0.194_29.234)] transition-all"
                  >
                    Become a Seller
                  </Link>
                )}

                {/* Nike-style message + buttons */}
                {!userProfile && (
                  <div className="mt-8 border-t pt-6 space-y-3 text-center">
                    <p className="text-xs text-gray-500">
                      Join <span className="font-semibold text-black">Branda</span> — buy smarter, sell faster.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Link href="/sign-in" onClick={() => setIsMenuOpen(false)}>
                        <Button
                          variant="outline"
                          className="w-full border-[oklch(0.21_0.194_29.234)] text-[oklch(0.21_0.194_29.234)] hover:bg-[oklch(0.21_0.194_29.234)] hover:text-white"
                        >
                          Sign In
                        </Button>
                      </Link>
                      <Link href="/sign-up" onClick={() => setIsMenuOpen(false)}>
                        <Button className="w-full bg-[oklch(0.21_0.194_29.234)] text-white hover:bg-[oklch(0.32_0.194_29.234)]">
                          Sign Up
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
