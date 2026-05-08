"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
  TrendingUp,
  Settings,
  CalendarDays,
  Search,
  Wallet,
  LifeBuoy,
  Wrench,
  ListChecks,
  ShoppingCart,
} from "lucide-react"
import AddProductModal from "./AddProductModal"

const ALL_SEARCH_ITEMS = [
  { label: 'Overview', description: 'Dashboard summary and key stats', href: '/vendor/dashboard', icon: LayoutDashboard, keywords: 'home dashboard overview stats revenue' },
  { label: 'Products', description: 'View and manage your product listings', href: '/vendor/products', icon: Package, keywords: 'products listings inventory stock catalogue' },
  { label: 'Add Product', description: 'Create a new product listing', href: '/vendor/products/new', icon: Plus, keywords: 'new product add create listing upload' },
  { label: 'Orders', description: 'View and manage customer orders', href: '/vendor/orders', icon: ShoppingCart, keywords: 'orders customers purchases sales' },
  { label: 'Services', description: 'Manage your services', href: '/vendor/services', icon: Wrench, keywords: 'services offerings' },
  { label: 'Add Service', description: 'Create a new service listing', href: '/vendor/services/new', icon: Plus, keywords: 'new service add create' },
  { label: 'Bookings', description: 'Manage service bookings and appointments', href: '/vendor/bookings', icon: CalendarDays, keywords: 'bookings appointments calendar schedule' },
  { label: 'Analytics', description: 'Sales charts, traffic, and performance data', href: '/vendor/analytics', icon: BarChart3, keywords: 'analytics charts traffic performance data sales report' },
  { label: 'Conversion Funnel', description: 'Track how visitors convert to buyers', href: '/vendor/conversion-funnel', icon: TrendingUp, keywords: 'conversion funnel tracking visitors buyers performance' },
  { label: 'Store Settings', description: 'Edit store name, logo, description, and address', href: '/vendor/store-settings', icon: Store, keywords: 'store settings name logo banner description address phone update edit' },
  { label: 'Setup Wizard', description: 'Quick guided store setup', href: '/vendor/setup-wizard', icon: ListChecks, keywords: 'setup wizard guide onboarding configure' },
  { label: 'Service Setup Wizard', description: 'Guided setup for services', href: '/vendor/services/setup-wizard', icon: ListChecks, keywords: 'service setup wizard configure' },
  { label: 'Wallet & Transactions', description: 'View balance, earnings, and withdrawals', href: '/vendor/wallet/transactions', icon: Wallet, keywords: 'wallet money balance transactions earnings withdraw payment payout' },
  { label: 'Messages', description: 'Customer messages and enquiries', href: '/vendor/messages', icon: MessageSquare, keywords: 'messages chat enquiries customers inbox' },
  { label: 'Settings', description: 'Account, password, and notification preferences', href: '/vendor/settings', icon: Settings, keywords: 'settings account password notification preferences profile' },
  { label: 'Support', description: 'Get help or contact the MIS team', href: '/vendor/support', icon: LifeBuoy, keywords: 'support help contact team issue problem' },
]

function VendorSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const results = query.trim()
    ? ALL_SEARCH_ITEMS.filter(item => {
        const q = query.toLowerCase()
        return (
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.keywords.includes(q)
        )
      })
    : ALL_SEARCH_ITEMS

  useEffect(() => { setActiveIndex(0) }, [query])
  useEffect(() => { inputRef.current?.focus() }, [])

  const navigate = useCallback((href: string) => {
    router.push(href)
    onClose()
  }, [router, onClose])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[activeIndex]) { navigate(results[activeIndex].href) }
    else if (e.key === 'Escape') { onClose() }
  }

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center pt-[10vh] px-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search pages, settings, features…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>

        {/* Results */}
        <ul className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">No results for &ldquo;{query}&rdquo;</li>
          ) : results.map((item, i) => {
            const Icon = item.icon
            return (
              <li key={item.href}>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => navigate(item.href)}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-70" />
                  <div>
                    <p className="text-sm font-medium leading-none">{item.label}</p>
                    <p className={`text-xs mt-0.5 ${i === activeIndex ? 'text-accent-foreground/80' : 'text-muted-foreground'}`}>{item.description}</p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="border-t px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span><kbd className="rounded border border-border bg-muted px-1">↑↓</kbd> navigate</span>
          <span><kbd className="rounded border border-border bg-muted px-1">↵</kbd> open</span>
          <span><kbd className="rounded border border-border bg-muted px-1">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

interface VendorLayoutProps {
  children: React.ReactNode
}

export default function VendorLayout({ children }: VendorLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const pathname = usePathname()
  const routes = useRouter()
  const isVendorDashboard = pathname === "/vendor/dashboard"

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const navigation = [
    { name: "Overview", href: "/vendor/dashboard", icon: LayoutDashboard },
    { name: "Products", href: "/vendor/products", icon: Package },
    { name: "Orders", href: "/vendor/orders", icon: Store },
    { name: "Bookings", href: "/vendor/bookings", icon: CalendarDays },
    { name: "Analytics", href: "/vendor/analytics", icon: BarChart3 },
    { name: "Conversion Funnel", href: "/vendor/conversion-funnel", icon: TrendingUp },
    { name: "Store Settings", href: "/vendor/store-settings", icon: Store },
    { name: "Support", href: "/vendor/support", icon: MessageSquare },
    { name: "Settings", href: "/vendor/settings", icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-background flex">
      {searchOpen && <VendorSearch onClose={() => setSearchOpen(false)} />}
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

          {/* Search bar — expands on desktop, icon-only on mobile */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors mr-2"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Search features…</span>
            <kbd className="hidden md:inline-flex h-5 items-center rounded border border-border bg-background px-1 text-[10px]">⌘K</kbd>
          </button>

          <div className="flex items-center gap-2">
            {isVendorDashboard && (
              <Button
                variant="outline"
                size="sm"
                className="sm:hidden"
                onClick={() => routes.push('/stores')}
              >
                <Store className="mr-1 h-4 w-4" />
                Home
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="hover:bg-accent hover:scale-105 transition-all hover:shadow-lg">
              <Link href="/vendor/products/new">
                <Plus className="h-4 w-4 lg:mr-2" />
                <span className="ml-1 sm:hidden">Add</span>
                <span className="hidden sm:inline">Add Product</span>
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
