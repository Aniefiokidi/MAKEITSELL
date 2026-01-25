"use client"

import type React from "react"

import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import AdminSidebar from "./AdminSidebar"
import { Button } from "@/components/ui/button"
import { LogOut, User } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, userProfile, logout, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Don't redirect while still loading the session
    if (loading) {
      console.log('[AdminLayout] Still loading auth, waiting...')
      return
    }

    // If not logged in after loading is done, redirect to login
    if (!user) {
      console.log('[AdminLayout] No user after loading, redirecting to login')
      router.push("/login")
      return
    }

    // Check if user is admin (check user role from database)
    const isAdmin = userProfile?.role === "admin"
    console.log('[AdminLayout] User found:', user.email, 'Role:', userProfile?.role, 'IsAdmin:', isAdmin)
    if (!isAdmin) {
      console.log('[AdminLayout] User is not admin, redirecting to unauthorized')
      router.push("/unauthorized")
      return
    }
  }, [user, userProfile, loading, router])

  // Show loading while checking auth
  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-accent rounded-full"></div>
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    )
  }

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-6">
          <h1 className="text-lg font-semibold">Make It Sell Admin Dashboard</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {user.email}
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
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
