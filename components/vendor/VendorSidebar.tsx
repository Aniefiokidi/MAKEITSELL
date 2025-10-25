"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/contexts/AuthContext"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  LifeBuoy,
  Store,
  Plus,
  Menu,
  X,
  Wrench,
  Calendar,
} from "lucide-react"

const sidebarItems = [
  {
    title: "Overview",
    href: "/vendor/dashboard",
    icon: LayoutDashboard,
    showFor: ["goods", "services", "both"] as const,
  },
  {
    title: "Products",
    href: "/vendor/products",
    icon: Package,
    showFor: ["goods", "both"] as const,
  },
  {
    title: "Services",
    href: "/vendor/services",
    icon: Wrench,
    showFor: ["services", "both"] as const,
  },
  {
    title: "Orders",
    href: "/vendor/orders",
    icon: ShoppingCart,
    showFor: ["goods", "both"] as const,
  },
  {
    title: "Bookings",
    href: "/vendor/bookings",
    icon: Calendar,
    showFor: ["services", "both"] as const,
  },
  {
    title: "Analytics",
    href: "/vendor/analytics",
    icon: BarChart3,
    showFor: ["goods", "services", "both"] as const,
  },
  {
    title: "Store Settings",
    href: "/vendor/store-settings",
    icon: Store,
    showFor: ["goods", "services", "both"] as const,
  },
  {
    title: "Support",
    href: "/vendor/support",
    icon: LifeBuoy,
    showFor: ["goods", "services", "both"] as const,
  },
  {
    title: "Settings",
    href: "/vendor/settings",
    icon: Settings,
    showFor: ["goods", "services", "both"] as const,
  },
]

export default function VendorSidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const { userProfile } = useAuth()
  
  // Filter sidebar items based on vendor type
  const filteredItems = useMemo(() => {
    const vendorType = userProfile?.vendorType || "both"
    return sidebarItems.filter(item => 
      (item.showFor as readonly string[]).includes(vendorType)
    )
  }, [userProfile?.vendorType])

  const vendorType = userProfile?.vendorType || "both"

  // Render navigation sections based on vendor type
  function renderNavigationSections() {
    if (vendorType === "both") {
      return (
        <>
          {/* Overview */}
          <Link
            href="/vendor/dashboard"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/dashboard" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Overview</span>
          </Link>

          {/* Goods Section */}
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              🛍️ My Goods
            </p>
          </div>
          <Link
            href="/vendor/products"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/products" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Package className="h-4 w-4" />
            <span>Products</span>
          </Link>
          <Link
            href="/vendor/orders"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/orders" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Orders</span>
          </Link>

          {/* Services Section */}
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              🛠️ My Services
            </p>
          </div>
          <Link
            href="/vendor/services"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/services" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Wrench className="h-4 w-4" />
            <span>Services</span>
          </Link>
          <Link
            href="/vendor/bookings"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/bookings" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Calendar className="h-4 w-4" />
            <span>Bookings</span>
          </Link>

          {/* Management Section */}
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Management
            </p>
          </div>
          <Link
            href="/vendor/analytics"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/analytics" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </Link>
          <Link
            href="/vendor/store-settings"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/store-settings" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Store className="h-4 w-4" />
            <span>Store Settings</span>
          </Link>
          <Link
            href="/vendor/support"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/support" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <LifeBuoy className="h-4 w-4" />
            <span>Support</span>
          </Link>
          <Link
            href="/vendor/settings"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/settings" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </>
      )
    } else if (vendorType === "goods") {
      return (
        <>
          {/* Overview */}
          <Link
            href="/vendor/dashboard"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/dashboard" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Overview</span>
          </Link>

          {/* Products Section */}
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              🛍️ Products & Orders
            </p>
          </div>
          <Link
            href="/vendor/products"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/products" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Package className="h-4 w-4" />
            <span>Products</span>
          </Link>
          <Link
            href="/vendor/orders"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/orders" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Orders</span>
          </Link>

          {/* Store Management */}
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Store Management
            </p>
          </div>
          <Link
            href="/vendor/analytics"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/analytics" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </Link>
          <Link
            href="/vendor/store-settings"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/store-settings" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Store className="h-4 w-4" />
            <span>Store Settings</span>
          </Link>
          <Link
            href="/vendor/support"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/support" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <LifeBuoy className="h-4 w-4" />
            <span>Support</span>
          </Link>
          <Link
            href="/vendor/settings"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/settings" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </>
      )
    } else {
      // Services only
      return (
        <>
          {/* Overview */}
          <Link
            href="/vendor/dashboard"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/dashboard" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Overview</span>
          </Link>

          {/* Services Section */}
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              🛠️ Services & Bookings
            </p>
          </div>
          <Link
            href="/vendor/services"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/services" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Wrench className="h-4 w-4" />
            <span>Services</span>
          </Link>
          <Link
            href="/vendor/bookings"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/bookings" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Calendar className="h-4 w-4" />
            <span>Bookings</span>
          </Link>

          {/* Business Management */}
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Business Management
            </p>
          </div>
          <Link
            href="/vendor/analytics"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/analytics" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </Link>
          <Link
            href="/vendor/store-settings"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/store-settings" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Store className="h-4 w-4" />
            <span>Store Settings</span>
          </Link>
          <Link
            href="/vendor/support"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/support" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <LifeBuoy className="h-4 w-4" />
            <span>Support</span>
          </Link>
          <Link
            href="/vendor/settings"
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/vendor/settings" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </>
      )
    }
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out md:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <Link href="/" className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
                <span className="text-lg font-bold">G</span>
              </div>
              <span className="font-bold">BRANDA</span>
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="p-4 border-b space-y-2">
            {(!userProfile?.vendorType || userProfile.vendorType === "goods" || userProfile.vendorType === "both") && (
              <Button asChild className="w-full">
                <Link href="/vendor/products/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Link>
              </Button>
            )}
            {(!userProfile?.vendorType || userProfile.vendorType === "services" || userProfile.vendorType === "both") && (
              <Button asChild className="w-full" variant={userProfile?.vendorType === "both" ? "outline" : "default"}>
                <Link href="/vendor/services/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Service
                </Link>
              </Button>
            )}
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-4">
            <nav className="space-y-1 py-4">
              {renderNavigationSections()}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t">
            <Button variant="outline" asChild className="w-full bg-transparent">
              <Link href="/">
                <Store className="mr-2 h-4 w-4" />
                View Store
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
