"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BarChart3,
  Users,
  Package,
  ShoppingCart,
  MessageSquare,
  Settings,
  Shield,
  TrendingUp,
  FileText,
  Store,
} from "lucide-react"

const adminNavItems = [
  {
    title: "Overview",
    href: "/admin/dashboard",
    icon: BarChart3,
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Vendors",
    href: "/admin/vendors",
    icon: Store,
  },
  {
    title: "Products",
    href: "/admin/products",
    icon: Package,
  },
  {
    title: "Orders",
    href: "/admin/orders",
    icon: ShoppingCart,
  },
  {
    title: "Support",
    href: "/admin/support",
    icon: MessageSquare,
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: TrendingUp,
  },
  {
    title: "Reports",
    href: "/admin/reports",
    icon: FileText,
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
]

export default function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  const handleNavigation = () => {
    onNavigate?.()
  }

  return (
    <div className="flex h-full w-full lg:w-64 flex-col bg-card border-r">
      <div className="flex h-16 items-center border-b px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-bold text-sm lg:text-base">Admin Panel</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-2 lg:p-4 overflow-y-auto">
        {adminNavItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavigation}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === item.href ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.title}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
