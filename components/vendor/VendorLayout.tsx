"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  Plus,
  Menu,
  X,
  Store,
  BarChart3,
  Settings
} from "lucide-react"
import AddProductModal from "./AddProductModal"

interface VendorLayoutProps {
  children: React.ReactNode
}

export default function VendorLayout({ children }: VendorLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const routes = useRouter()

  const navigation = [
    { name: "Overview", href: "/vendor/dashboard", icon: LayoutDashboard },
    { name: "Products", href: "/vendor/products", icon: Package },
    { name: "Orders", href: "/vendor/orders", icon: Store },
    { name: "Analytics", href: "/vendor/analytics", icon: BarChart3 },
    { name: "Store Settings", href: "/vendor/store-settings", icon: Store },
    { name: "Support", href: "/vendor/support", icon: MessageSquare },
    { name: "Settings", href: "/vendor/settings", icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-card border-r transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex h-16 items-center border-b px-6">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-black" />
            <span className="font-bold">Vendor Panel</span>
          </div>
        </div>


        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        <div className="border-t p-4" onClick={() => routes.push('/stores')}>
          <Button variant="outline" className="w-full">
            <Store className="mr-2 h-4 w-4" />
              Back To home
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="hover:bg-accent hover:scale-105 transition-all hover:shadow-lg">
              <Link href="/vendor/products/new">
                <Plus className="h-4 w-4 lg:mr-2" />
                <span className="hidden lg:inline">Add Product</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => routes.push('/stores')}>
              <Store className="mr-2 h-4 w-4" />
              Back To home
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
