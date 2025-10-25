"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import UserMenu from "@/components/auth/UserMenu"
import CartSidebar from "@/components/cart/CartSidebar"
import { useAuth } from "@/contexts/AuthContext"

export default function Header() {
  const { userProfile } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <header className="sticky top-0 z-50 w-full text-black border-b bg-white/95 backdrop-blur-md shadow-sm">
      <div className="container mx-auto px-1 sm:px-2 lg:px-4 xl:px-6">
        <div className="flex h-14 sm:h-16 lg:h-18 items-center justify-between">
          {/* Enhanced Logo */}
          <Link href="/" className="flex items-center space-x-0 group shrink-0 -ml-1">
          
            <img 
              src="/images/logo.png" 
              alt="BRANDA" 
              className="h-30 sm:h-25 lg:h-42 w-auto object-contain transition-all duration-300 hover:scale-105 -ml-15 -mt-3"
            />
          </Link>

          {/* Enhanced Desktop Search Bar - Hidden on mobile */}
          <div className="hidden lg:flex flex-1 max-w-md xl:max-w-xl mx-4 xl:mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 lg:left-4 top-1/2 h-3 w-3 lg:h-4 lg:w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products, brands, categories..."
                className="pl-9 lg:pl-12 pr-3 lg:pr-4 h-9 lg:h-11 text-sm lg:text-base rounded-lg lg:rounded-xl border-2 border-gray-200 focus:border-accent focus:ring-accent/20 shadow-sm hover:shadow-md transition-all duration-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Enhanced Desktop Navigation - Hidden on smaller screens */}
          <nav className="hidden xl:flex items-center space-x-4 2xl:space-x-6">
            <Link href="/shop" className="text-xs lg:text-sm font-semibold text-gray-700 hover:text-accent transition-all duration-200 hover:scale-105 whitespace-nowrap">
              Shop
            </Link>
            <Link href="/services" className="text-xs lg:text-sm font-semibold text-gray-700 hover:text-accent transition-all duration-200 hover:scale-105 whitespace-nowrap">
              Services
            </Link>
            <Link href="/about" className="text-xs lg:text-sm font-semibold text-gray-700 hover:text-accent transition-all duration-200 hover:scale-105 whitespace-nowrap">
              About
            </Link>
            <Link href="/contact" className="text-xs lg:text-sm font-semibold text-gray-700 hover:text-accent transition-all duration-200 hover:scale-105 whitespace-nowrap">
              Contact
            </Link>
            <Link href="/support" className="text-xs lg:text-sm font-semibold text-gray-700 hover:text-accent transition-all duration-200 hover:scale-105 whitespace-nowrap">
              Support
            </Link>
            {userProfile?.role !== "vendor" && (
              <Link href="/become-seller" className="text-xs lg:text-sm font-semibold bg-gradient-to-r from-accent to-accent-foreground bg-clip-text text-transparent hover:from-accent-foreground hover:to-accent transition-all duration-200 hover:scale-105 whitespace-nowrap">
                Sell
              </Link>
            )}
          </nav>

          {/* Enhanced Right Side Icons */}
          <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-3 shrink-0">
            {/* Mobile Search Icon */}
            <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 sm:h-9 sm:w-9 hover:bg-accent/10 hover:text-accent transition-colors duration-200">
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>

            {/* Cart */}
            <div className="hidden sm:block">
              <CartSidebar />
            </div>

            {/* User Menu */}
            <UserMenu />

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="xl:hidden h-8 w-8 sm:h-9 sm:w-9 hover:bg-accent/10 hover:text-accent transition-all duration-200 hover:scale-105"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
            </Button>
          </div>
        </div>

        {/* Enhanced Mobile Search Bar */}
        <div className="pb-3 lg:hidden">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 h-3 w-3 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              className="pl-8 sm:pl-12 pr-3 sm:pr-4 h-9 sm:h-11 text-sm sm:text-base rounded-lg sm:rounded-xl border-2 border-gray-200 focus:border-accent focus:ring-accent/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Cart for mobile - Below search */}
        <div className="sm:hidden pb-3">
          <CartSidebar />
        </div>

        {/* Enhanced Mobile Menu */}
        {isMenuOpen && (
          <div className="border-t border-gray-200 xl:hidden bg-white/95 backdrop-blur-md">
            <nav className="flex flex-col space-y-1 sm:space-y-2 py-3 sm:py-4">
              <Link
                href="/shop"
                className="text-sm sm:text-base font-semibold text-gray-700 hover:text-accent hover:bg-accent/5 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Shop
              </Link>
              <Link
                href="/services"
                className="text-sm sm:text-base font-semibold text-gray-700 hover:text-accent hover:bg-accent/5 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Services
              </Link>
              <Link
                href="/about"
                className="text-sm sm:text-base font-semibold text-gray-700 hover:text-accent hover:bg-accent/5 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </Link>
              <Link
                href="/contact"
                className="text-sm sm:text-base font-semibold text-gray-700 hover:text-accent hover:bg-accent/5 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Contact
              </Link>
              <Link
                href="/support"
                className="text-sm sm:text-base font-semibold text-gray-700 hover:text-accent hover:bg-accent/5 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Support
              </Link>
              {userProfile?.role !== "vendor" && (
                <Link
                  href="/become-seller"
                  className="text-sm sm:text-base font-semibold bg-gradient-to-r from-accent to-accent-foreground text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg hover:shadow-lg transition-all duration-200 hover:scale-105"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Become a Seller
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
