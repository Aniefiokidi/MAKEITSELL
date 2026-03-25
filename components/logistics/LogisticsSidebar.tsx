"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Truck, ClipboardList } from "lucide-react"

export default function LogisticsSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r bg-card min-h-screen p-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Logistics Panel</h2>
        <p className="text-xs text-muted-foreground">Lagos order operations only</p>
      </div>

      <nav className="space-y-1">
        <Link
          href="/logistics"
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname === "/logistics"
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/10"
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Lagos Orders
        </Link>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
          <Truck className="h-4 w-4" />
          En Route Tracking
        </div>
      </nav>
    </aside>
  )
}
