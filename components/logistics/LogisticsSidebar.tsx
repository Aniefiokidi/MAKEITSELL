"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Truck, ClipboardList, Archive } from "lucide-react"
import type { LogisticsRegionConfig } from "@/lib/logistics-access"

type LogisticsSidebarProps = {
  region: LogisticsRegionConfig
}

export default function LogisticsSidebar({ region }: LogisticsSidebarProps) {
  const pathname = usePathname()
  const activePath = region.basePath
  const referencePath = `${region.basePath}/reference`

  return (
    <aside className="w-64 border-r bg-card min-h-screen p-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Logistics Panel</h2>
        <p className="text-xs text-muted-foreground">{region.cityLabel} order operations only</p>
      </div>

      <nav className="space-y-1">
        <Link
          href={activePath}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname === activePath
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/10"
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Active Orders
        </Link>
        <Link
          href={referencePath}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname === referencePath
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/10"
          }`}
        >
          <Archive className="h-4 w-4" />
          Received Reference
        </Link>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
          <Truck className="h-4 w-4" />
          En Route Tracking
        </div>
      </nav>
    </aside>
  )
}
