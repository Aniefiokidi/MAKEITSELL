"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/AuthContext"
import { logOut } from "@/lib/auth"
import { User, Settings, ShoppingBag, Store, LifeBuoy, LogOut, BarChart3, MessageCircle } from "lucide-react"

export default function UserMenu() {
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logOut()
      router.push("/")
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (!user || !userProfile) {
    return (
      <div className="flex items-center space-x-1 sm:space-x-2">
        <Button variant="ghost" asChild className="text-xs sm:text-sm px-2 sm:px-3 h-7 sm:h-8 lg:h-9">
          <Link href="/login">Sign In</Link>
        </Button>
        <Button asChild className="text-xs sm:text-sm px-2 sm:px-3 h-7 sm:h-8 lg:h-9">
          <Link href="/signup">Sign Up</Link>
        </Button>
      </div>
    )
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 rounded-full p-0 hover:scale-105 transition-transform duration-200">
          <div className="h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200">
            <User className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-gray-600" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 sm:w-52 lg:w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal p-2 sm:p-3">
          <div className="flex flex-col space-y-1">
            <p className="text-xs sm:text-sm font-medium leading-none truncate">{userProfile.displayName}</p>
            <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
            <p className="text-xs leading-none text-muted-foreground capitalize">{userProfile.role}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {userProfile.role === "customer" && (
          <DropdownMenuItem asChild>
            <Link href="/order" className="cursor-pointer text-xs sm:text-sm">
              <User className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Profile
            </Link>
          </DropdownMenuItem>
        )}

        {userProfile.role === "vendor" && (
          <DropdownMenuItem asChild>
            <Link href="/vendor/settings" className="cursor-pointer text-xs sm:text-sm">
              <User className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Profile
            </Link>
          </DropdownMenuItem>
        )}

        {userProfile.role === "customer" && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/order" className="cursor-pointer text-xs sm:text-sm">
                <ShoppingBag className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                My Orders
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/messages" className="cursor-pointer text-xs sm:text-sm">
                <MessageCircle className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Messages
              </Link>
            </DropdownMenuItem>
          </>
        )}

        {userProfile.role === "vendor" && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/vendor/dashboard" className="cursor-pointer text-xs sm:text-sm">
                <Store className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/vendor/orders" className="cursor-pointer text-xs sm:text-sm">
                <ShoppingBag className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Orders
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/messages" className="cursor-pointer text-xs sm:text-sm">
                <MessageCircle className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Messages
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/vendor/analytics" className="cursor-pointer text-xs sm:text-sm">
                <BarChart3 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Analytics
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/vendor/support" className="cursor-pointer text-xs sm:text-sm">
                <LifeBuoy className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Support
              </Link>
            </DropdownMenuItem>
          </>
        )}

        {userProfile.role === "customer" && (
          <DropdownMenuItem asChild>
            <Link href="/support" className="cursor-pointer text-xs sm:text-sm">
              <LifeBuoy className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Support
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem asChild>
          <Link href={userProfile.role === "vendor" ? "/vendor/settings" : "/order"} className="cursor-pointer text-xs sm:text-sm">
            <Settings className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive text-xs sm:text-sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
