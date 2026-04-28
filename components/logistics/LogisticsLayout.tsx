"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { ThemeProvider } from "@/components/theme-provider"
import LogisticsSidebar from "@/components/logistics/LogisticsSidebar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Loader2, LogOut, Menu, User } from "lucide-react"
import { logisticsEmailAllowedForRegion, resolveLogisticsRegion, type LogisticsRegionKey } from "@/lib/logistics-access"

export default function LogisticsLayout({ children, regionKey = 'lagos' }: { children: React.ReactNode; regionKey?: LogisticsRegionKey }) {
  const { user, logout, loading } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const region = resolveLogisticsRegion(regionKey)

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push("/login")
      return
    }

    if (!logisticsEmailAllowedForRegion(user.email, region)) {
      router.push("/unauthorized")
      return
    }
  }, [loading, user, router, region])

  if (loading || !user || !logisticsEmailAllowedForRegion(user.email, region)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-background flex-col lg:flex-row">
        <div className="hidden lg:flex">
          <LogisticsSidebar region={region} />
        </div>

        <div className="flex flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6 gap-2">
            <div className="flex items-center gap-2 flex-1">
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <LogisticsSidebar region={region} />
                </SheetContent>
              </Sheet>
              <h1 className="text-base lg:text-lg font-semibold truncate">{region.panelTitle}</h1>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline truncate max-w-[170px]">{user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 p-4 lg:p-6 overflow-y-auto">{children}</main>
        </div>
      </div>
    </ThemeProvider>
  )
}
