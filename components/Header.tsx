"use client"


import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Wallet, Menu, X, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import SmartSearch from "@/components/search/SmartSearch"
import UserMenu from "@/components/auth/UserMenu"
import CartSidebar from "@/components/cart/CartSidebar"
import { VendorWalletModal } from "@/components/vendor/VendorWalletModal"
import { useAuth } from "@/contexts/AuthContext"
import { useNotification } from "@/contexts/NotificationContext"
import { calculateTopupAmounts } from "@/lib/topup-fee"

interface WalletTx {
  id: string
  type: string
  amount: number
  status: string
  note?: string
  createdAt?: string
  direction?: "credit" | "debit" | "neutral"
}

const FALLBACK_BANKS: Array<{ name: string; code: string }> = [
  { name: "Access Bank", code: "044" },
  { name: "GTBank", code: "058" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "United Bank For Africa", code: "033" },
  { name: "Zenith Bank", code: "057" },
  { name: "Fidelity Bank", code: "070" },
  { name: "FCMB", code: "214" },
  { name: "Wema Bank", code: "035" },
]

export default function Header({ homeBg = false }: { homeBg?: boolean }) {
  const { user, userProfile, loading } = useAuth()
  const notification = useNotification()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [vendorWalletModalOpen, setVendorWalletModalOpen] = useState(false)
  const [activeWalletView, setActiveWalletView] = useState<"menu" | "topup" | "withdraw">("menu")
  const [walletAmount, setWalletAmount] = useState("")
  const [walletLoading, setWalletLoading] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [bankCode, setBankCode] = useState("")
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")
  const [accountVerified, setAccountVerified] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([])
  const [withdrawalPin, setWithdrawalPin] = useState("")
  const [newPin, setNewPin] = useState("")
  const [confirmNewPin, setConfirmNewPin] = useState("")
  const [currentPin, setCurrentPin] = useState("")
  const [hasWithdrawalPin, setHasWithdrawalPin] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [showCurrentPin, setShowCurrentPin] = useState(false)
  const [showNewPin, setShowNewPin] = useState(false)
  const [showConfirmNewPin, setShowConfirmNewPin] = useState(false)
  const [showWithdrawalPin, setShowWithdrawalPin] = useState(false)
  const [walletTransactions, setWalletTransactions] = useState<WalletTx[]>([])
  const [walletTxLoading, setWalletTxLoading] = useState(false)
  const [mobileDrawerWidth, setMobileDrawerWidth] = useState("85vw")

  const profileWalletBalance =
    userProfile?.role === "customer"
      ? (typeof userProfile.walletBalance === "number" ? userProfile.walletBalance : 0)
      : null

  const [walletBalance, setWalletBalance] = useState<number | null>(profileWalletBalance)
  const [vendorWalletBalance, setVendorWalletBalance] = useState<number | null>(null)

  const refreshCustomerWalletBalance = async () => {
    if (userProfile?.role !== "customer") return

    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      })
      const result = await response.json()
      const nextBalance = result?.user?.walletBalance
      if (response.ok && result?.success && typeof nextBalance === "number") {
        setWalletBalance(nextBalance)
      }
    } catch {
      // ignore transient refresh failures
    }
  }

  const refreshVendorWalletBalance = async () => {
    if (userProfile?.role !== "vendor" || !user?.uid) return

    try {
      const transactionsResponse = await fetch("/api/vendor/wallet/transactions", {
        method: "GET",
        credentials: "include",
      })
      const transactionsResult = await transactionsResponse.json()

      if (transactionsResponse.ok && transactionsResult?.success && typeof transactionsResult.walletBalance === "number") {
        setVendorWalletBalance(transactionsResult.walletBalance)
        return
      }

      const response = await fetch(`/api/vendor/dashboard?vendorId=${encodeURIComponent(user.uid)}`, {
        method: "GET",
        credentials: "include",
      })
      const result = await response.json()
      if (response.ok && result?.success && typeof result.data?.vendorWalletBalance === "number") {
        setVendorWalletBalance(result.data.vendorWalletBalance)
      }
    } catch {
      // Silently fail if unable to fetch
    }
  }

  useEffect(() => {
    if (userProfile?.role === "customer") {
      setWalletBalance(profileWalletBalance)
    }
  }, [profileWalletBalance, userProfile?.role])

  useEffect(() => {
    refreshVendorWalletBalance()
  }, [user?.uid, userProfile?.role])

  useEffect(() => {
    if (walletModalOpen && userProfile?.role === "customer") {
      refreshCustomerWalletBalance()
    }
  }, [walletModalOpen, userProfile?.role])

  useEffect(() => {
    if (vendorWalletModalOpen && userProfile?.role === "vendor") {
      refreshVendorWalletBalance()
    }
  }, [vendorWalletModalOpen, userProfile?.role, user?.uid])

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const walletStatus = params.get("wallet")
    const reason = params.get("reason")

    if (!walletStatus) return

    const handleWalletCallback = async () => {
      if (walletStatus === "success") {
        notification.success("Wallet top up completed successfully", "Wallet updated", 3000)

        if (userProfile?.role === "customer") {
          await refreshCustomerWalletBalance()
          if (walletModalOpen) {
            await fetchWalletTransactions()
          }
        } else if (userProfile?.role === "vendor") {
          await refreshVendorWalletBalance()
        }
      } else if (walletStatus === "failed") {
        notification.error("Wallet top up could not be completed", reason || "Try again", 3500)
      }

      params.delete("wallet")
      params.delete("reason")
      const nextQuery = params.toString()
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`
      window.history.replaceState({}, "", nextUrl)
    }

    handleWalletCallback()
  }, [pathname, notification, userProfile?.role, walletModalOpen])

  useEffect(() => {
    const fetchPinStatus = async () => {
      if (!walletModalOpen || userProfile?.role !== "customer") {
        return
      }

      // Reset to menu view when modal opens
      setActiveWalletView("menu")

      try {
        const response = await fetch("/api/wallet/pin/status", {
          method: "GET",
          credentials: "include",
        })
        const result = await response.json()
        if (response.ok && result?.success) {
          setHasWithdrawalPin(!!result.hasWithdrawalPin)
        }
      } catch {
      }
    }

    fetchPinStatus()
  }, [walletModalOpen, userProfile?.role])

  useEffect(() => {
    if (!walletModalOpen) {
      // Clear form fields when modal closes
      setWalletAmount("")
      setWithdrawAmount("")
      setBankCode("")
      setBankName("")
      setAccountName("")
      setAccountNumber("")
      setAccountVerified(false)
      setVerifyLoading(false)
      setAccountError(null)
      setWithdrawalPin("")
      setCurrentPin("")
      setNewPin("")
      setConfirmNewPin("")
      setShowCurrentPin(false)
      setShowNewPin(false)
      setShowConfirmNewPin(false)
      setShowWithdrawalPin(false)
    }
  }, [walletModalOpen])

  useEffect(() => {
    if (walletModalOpen && userProfile?.role === "customer") {
      fetchWalletTransactions()
    }
  }, [walletModalOpen, userProfile?.role])

  useEffect(() => {
    const fetchBanks = async () => {
      if (!walletModalOpen || userProfile?.role !== "customer") {
        return
      }

      try {
        const res = await fetch("/api/vendor/banks", {
          method: "GET",
          credentials: "include",
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data?.success && Array.isArray(data.banks) && data.banks.length > 0) {
          const uniqueByCode = new Map<string, { name: string; code: string }>()
          data.banks.forEach((bank: any) => {
            const code = String(bank?.code || "").trim()
            const name = String(bank?.name || "").trim()
            if (code && name && !uniqueByCode.has(code)) {
              uniqueByCode.set(code, { name, code })
            }
          })
          const normalized = Array.from(uniqueByCode.values())
          setBanks(normalized.length > 0 ? normalized : FALLBACK_BANKS)
        } else {
          setBanks(FALLBACK_BANKS)
        }
      } catch {
        setBanks(FALLBACK_BANKS)
      }
    }

    fetchBanks()
  }, [walletModalOpen, userProfile?.role])

  useEffect(() => {
    const verifyAccount = async () => {
      if (
        !walletModalOpen
        || userProfile?.role !== "customer"
        || !bankCode
        || accountNumber.length !== 10
      ) {
        setAccountVerified(false)
        if (accountNumber.length !== 10) {
          setAccountName("")
        }
        return
      }

      try {
        setVerifyLoading(true)
        setAccountError(null)
        const response = await fetch("/api/vendor/resolve-account", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bankCode, accountNumber }),
        })

        const result = await response.json()
        if (response.ok && result?.success && result?.accountName) {
          setAccountName(String(result.accountName))
          setAccountVerified(true)
          setAccountError(null)
        } else {
          setAccountName("")
          setAccountVerified(false)
          setAccountError(result?.error || "Unable to verify account")
        }
      } catch {
        setAccountName("")
        setAccountVerified(false)
        setAccountError("Unable to verify account")
      } finally {
        setVerifyLoading(false)
      }
    }

    verifyAccount()
  }, [walletModalOpen, userProfile?.role, bankCode, accountNumber])

  const currencyFormatter = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const displayWalletBalance = userProfile?.role === "vendor" ? vendorWalletBalance : walletBalance
  const formattedWalletBalance =
    displayWalletBalance !== null
      ? currencyFormatter.format(displayWalletBalance)
      : null

  const parsedWalletAmount = Number(walletAmount)
  const topupQuote = Number.isFinite(parsedWalletAmount) && parsedWalletAmount > 0
    ? calculateTopupAmounts(parsedWalletAmount)
    : null
  const parsedWithdrawAmount = Number(withdrawAmount)
  const customerAvailableBalance = typeof walletBalance === "number" ? walletBalance : 0
  const withdrawAmountExceedsBalance = Number.isFinite(parsedWithdrawAmount)
    && parsedWithdrawAmount > 0
    && parsedWithdrawAmount > customerAvailableBalance

  const fetchWalletTransactions = async () => {
    if (userProfile?.role !== "customer") {
      return
    }

    try {
      setWalletTxLoading(true)
      const response = await fetch("/api/wallet/transactions", {
        method: "GET",
        credentials: "include",
      })
      const result = await response.json()
      if (response.ok && result?.success && Array.isArray(result.transactions)) {
        setWalletTransactions(result.transactions)
      }
    } catch {
    } finally {
      setWalletTxLoading(false)
    }
  }

  const handleWalletTopUp = async () => {
    const amount = Number(walletAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      notification.error("Please enter a valid amount greater than zero", "Invalid amount", 3000)
      return
    }

    try {
      setWalletLoading(true)
      const response = await fetch("/api/wallet/topup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })

      const result = await response.json()
      if (!response.ok || !result?.success) {
        notification.error(result?.error || "Unable to top up wallet", "Top up failed", 3000)
        return
      }

      if (!result.authorization_url) {
        notification.error("Payment URL not returned", "Top up failed", 3000)
        return
      }

      notification.info("Redirecting to secure payment...", "Wallet top up", 2000)
      window.location.href = result.authorization_url
    } catch (error) {
      notification.error("Network error while topping up wallet", "Top up failed", 3000)
    } finally {
      setWalletLoading(false)
    }
  }

  const handleWalletWithdraw = async () => {
    const amount = Number(withdrawAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      notification.error("Please enter a valid withdrawal amount", "Invalid amount", 3000)
      return
    }

    if (amount > customerAvailableBalance) {
      notification.error("Withdrawal amount cannot exceed your current balance", "Insufficient balance", 3000)
      return
    }

    if (!bankCode || !bankName || !accountNumber || !accountName || !accountVerified) {
      notification.error("Select bank and verify account details before withdrawing", "Missing details", 3000)
      return
    }

    if (!/^\d{4}$/.test(withdrawalPin.trim())) {
      notification.error("Enter your 4-digit withdrawal PIN", "Invalid PIN", 3000)
      return
    }

    try {
      setWithdrawLoading(true)
      const response = await fetch("/api/wallet/withdraw", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          bankCode: bankCode.trim(),
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
          withdrawalPin: withdrawalPin.trim(),
        }),
      })

      const result = await response.json()
      if (!response.ok || !result?.success) {
        notification.error(result?.error || "Unable to request withdrawal", "Withdrawal failed", 3000)
        return
      }

      if (typeof result.balance === "number") {
        setWalletBalance(result.balance)
      }

      await refreshCustomerWalletBalance()

      await fetchWalletTransactions()

      notification.success("Withdrawal request submitted", result.reference || "Pending processing", 3000)
      setWithdrawAmount("")
      setBankCode("")
      setBankName("")
      setAccountName("")
      setAccountNumber("")
      setAccountVerified(false)
      setAccountError(null)
      setWithdrawalPin("")
      setWalletModalOpen(false)
    } catch (error) {
      notification.error("Network error while requesting withdrawal", "Withdrawal failed", 3000)
    } finally {
      setWithdrawLoading(false)
    }
  }

  const handleSetWithdrawalPin = async () => {
    if (!/^\d{4}$/.test(newPin.trim())) {
      notification.error("PIN must be exactly 4 digits", "Invalid PIN", 3000)
      return
    }

    if (newPin.trim() !== confirmNewPin.trim()) {
      notification.error("PIN confirmation does not match", "Invalid PIN", 3000)
      return
    }

    if (hasWithdrawalPin && !/^\d{4}$/.test(currentPin.trim())) {
      notification.error("Enter your current 4-digit PIN to change it", "Current PIN required", 3000)
      return
    }

    try {
      setPinLoading(true)
      const response = await fetch("/api/wallet/pin/set", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: newPin.trim(),
          currentPin: currentPin.trim() || undefined,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result?.success) {
        notification.error(result?.error || "Unable to set withdrawal PIN", "PIN update failed", 3000)
        return
      }

      setHasWithdrawalPin(true)
      setNewPin("")
      setConfirmNewPin("")
      setCurrentPin("")
      notification.success(result.message || "Withdrawal PIN saved", "PIN updated", 3000)
    } catch {
      notification.error("Network error while setting PIN", "PIN update failed", 3000)
    } finally {
      setPinLoading(false)
    }
  }

  const handleBankChange = (code: string) => {
    const selected = banks.find((bank) => bank.code === code)
    setBankCode(code)
    setBankName(selected?.name || "")
    setAccountNumber("")
    setAccountName("")
    setAccountVerified(false)
    setAccountError(null)
  }

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [isMenuOpen])

  // Use a slightly narrower drawer on very small phones for smoother UX.
  useEffect(() => {
    const updateDrawerWidth = () => {
      setMobileDrawerWidth(window.innerWidth <= 380 ? "80vw" : "85vw")

      // Ensure mobile drawer never remains open after switching to desktop.
      if (window.innerWidth >= 1280) {
        setIsMenuOpen(false)
      }
    }

    updateDrawerWidth()
    window.addEventListener("resize", updateDrawerWidth)

    return () => {
      window.removeEventListener("resize", updateDrawerWidth)
    }
  }, [])

  // Close mobile drawer on route change to avoid stale open state.
  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  // Handle smart search
  const handleSearch = (query: string) => {
    // Navigate to search results
    window.location.href = `/search?query=${encodeURIComponent(query)}`
  }

  return (
    <header
      className={
        `sticky top-0 z-50 w-full pt-1.5 pb-2 ${homeBg
          ? 'bg-white/45 dark:bg-black/35 supports-backdrop-filter:bg-white/30 dark:supports-backdrop-filter:bg-black/25 backdrop-blur-xl border-b border-white/40 dark:border-white/10' 
          : 'bg-white/95 dark:bg-background dark:text-foreground backdrop-blur-md'}
        `
        
      }
    >
      <div className="w-full px-2 sm:px-4 lg:px-10">
              {/* Gradient animation styles for homeBg */}
              {homeBg && (
                <style jsx global>{`
                  .animated-gradient-bg {
                    background: linear-gradient(120deg, var(--accent) 0%, #fff 50%, var(--accent) 100%);
                    background-size: 200% 200%;
                    animation: gradientWave 12s ease-in-out infinite;
                  }
                  .dark .animated-gradient-bg {
                    background: linear-gradient(120deg, #000 0%, #1a2236 60%, #000 100%);
                    background-size: 200% 200%;
                    animation: gradientWave 12s ease-in-out infinite;
                  }
                  @keyframes gradientWave {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                  }
                `}</style>
              )}
        <div className="flex h-10 md:h-14 lg:h-16 items-center justify-between gap-1">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <img
              src="/images/logo (2).png"
              alt="Make It Sell"
              className="h-5 sm:h-6 lg:h-8 w-auto object-contain transition-all duration-300 hover:scale-105"
              onError={(e) => {
                // Fallback to text logo if image fails
                e.currentTarget.style.display = 'none'
                const nextElement = e.currentTarget.nextElementSibling as HTMLElement
                if (nextElement) nextElement.style.display = 'block'
              }}
            />
            <span 
              className="text-lg sm:text-2xl lg:text-3xl font-bold text-[oklch(0.21_0.194_29.234)] dark:text-foreground hidden uppercase"
              style={{ fontFamily: 'serif' }}
            >
              MAKE IT SELL
            </span>
          </Link>

          {/* Centralized Desktop Nav */}
          <nav className="hidden xl:flex flex-1 justify-center items-center space-x-2 uppercase">
            {["Stores", "Services", "About", "Contact", "Support"].map((link) => {
              const isActive = pathname === `/${link.toLowerCase()}` || 
                (link === "Stores" && pathname === "/stores")
              
              return (
                <Link
                  key={link}
                  href={`/${link.toLowerCase()}`}
                  className={`relative px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-full font-medium transition-all duration-300 ${
                    isActive
                      ? "bg-white/20 backdrop-blur-md border border-white/30 text-[oklch(0.21_0.194_29.234)] dark:text-accent shadow-lg shadow-accent/10 dark:shadow-accent/20"
                      : "text-gray-700 dark:text-foreground hover:text-[oklch(0.21_0.194_29.234)] dark:hover:text-accent group"
                  }`}
                >
                  {isActive && (
                    <>
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-linear-to-r from-accent/10 to-transparent rounded-full -z-10"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                      {/* Connecting tail */}
                      <motion.div
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute left-1/2 -translate-x-1/2 top-full w-12 h-6 bg-linear-to-b from-white/20 to-transparent backdrop-blur-sm border-x border-white/20 rounded-b-2xl"
                        style={{
                          clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)"
                        }}
                      />
                    </>
                  )}
                  <span className="relative z-10">{link.toUpperCase()}</span>
                  {!isActive && (
                    <span className="absolute bottom-1 left-0 w-0 h-0.5 bg-[oklch(0.21_0.194_29.234)] dark:bg-accent transition-all duration-300 group-hover:w-full"></span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right Icons */}
          <div className="flex items-center gap-2">
            {formattedWalletBalance && (
              <button
                type="button"
                onClick={() => {
                  if (userProfile?.role === "customer") {
                    setWalletModalOpen(true)
                  } else if (userProfile?.role === "vendor") {
                    setVendorWalletModalOpen(true)
                  }
                }}
                title={userProfile?.role === "vendor" ? "Click to manage vendor wallet" : "Open wallet"}
                className="flex items-center gap-1 rounded-full border border-[oklch(0.21_0.194_29.234)]/25 bg-white/90 dark:bg-background/90 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium text-[oklch(0.21_0.194_29.234)] dark:text-accent hover:bg-accent/10 dark:hover:bg-accent/20 transition-colors cursor-pointer"
              >
                <Wallet className="h-3.5 w-3.5" />
                <span>{formattedWalletBalance}</span>
              </button>
            )}

            {/* Cart */}
            <CartSidebar />

            {/* Authentication */}
            {(user && userProfile) ? (
              <div className="flex items-center gap-3">
                <UserMenu />
              </div>
            ) : (
              <div className="hidden xl:flex items-center gap-3">
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-muted animate-pulse"></div>
                  </div>
                ) : (
                  <>
                    <Link href="/login">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-2 border-[oklch(0.21_0.194_29.234)] text-[oklch(0.21_0.194_29.234)] dark:border-accent dark:text-accent hover:bg-[oklch(0.21_0.194_29.234)] dark:hover:bg-accent hover:text-white dark:hover:text-background font-semibold transition-all duration-300 shadow-sm hover:shadow-md"
                      >
                        SIGN IN
                      </Button>
                    </Link>
                    <Link href="/signup">
                      <Button
                        size="sm"
                        className="bg-white dark:bg-background text-[oklch(0.21_0.194_29.234)] dark:text-accent border-2 border-[oklch(0.21_0.194_29.234)] dark:border-accent hover:bg-[oklch(0.21_0.194_29.234)] dark:hover:bg-accent hover:text-white dark:hover:text-background font-semibold transition-all duration-300 shadow-md hover:shadow-lg"
                      >
                        JOIN US
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="block xl:hidden hover:bg-accent/10 dark:hover:bg-accent/20"
              onClick={() => setIsMenuOpen((v) => !v)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Customer Wallet Modal */}
      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className="sm:max-w-md">
          {/* MENU VIEW */}
          {activeWalletView === "menu" && (
            <>
              <DialogHeader>
                <DialogTitle>My wallet</DialogTitle>
                <DialogDescription>
                  Manage your wallet balance and withdrawals.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Current balance: <span className="font-semibold text-foreground">{formattedWalletBalance || currencyFormatter.format(0)}</span>
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => setActiveWalletView("topup")}
                    className="h-24 flex flex-col items-center justify-center"
                  >
                    <div className="text-2xl mb-1">💰</div>
                    <span>Top up</span>
                  </Button>
                  <Button
                    onClick={() => setActiveWalletView("withdraw")}
                    variant="outline"
                    className="h-24 flex flex-col items-center justify-center"
                  >
                    <div className="text-2xl mb-1">💳</div>
                    <span>Withdraw</span>
                  </Button>
                </div>

                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium mb-2">Recent wallet activity</p>
                  {walletTxLoading ? (
                    <p className="text-xs text-muted-foreground">Loading transactions...</p>
                  ) : walletTransactions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No transactions yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
                      {walletTransactions.slice(0, 8).map((tx) => (
                        <div key={tx.id} className="flex items-start justify-between gap-3 text-xs">
                          <div className="min-w-0 pr-1">
                            <p className="font-medium text-foreground break-words">{tx.note || tx.type.replace(/_/g, " ")}</p>
                            <p className="text-muted-foreground">{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : ""}</p>
                          </div>
                          <div className="text-right">
                            <p className={tx.direction === "credit" ? "font-semibold text-green-600" : tx.direction === "debit" ? "font-semibold text-red-600" : "font-semibold"}>
                              {tx.direction === "credit" ? "+" : tx.direction === "debit" ? "-" : ""}
                              {currencyFormatter.format(Number(tx.amount || 0))}
                            </p>
                              <p className="text-muted-foreground">{String(tx.status || '').replace(/_/g, ' ')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="ghost" size="sm" asChild className="w-full sm:w-auto">
                  <Link href="/wallet/transactions">View all transactions</Link>
                </Button>
                <Button variant="outline" onClick={() => setWalletModalOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}

          {/* TOP UP VIEW */}
          {activeWalletView === "topup" && (
            <>
              <DialogHeader>
                <DialogTitle>Top up wallet</DialogTitle>
                <DialogDescription>
                  Add funds to your wallet via Xoro Pay.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Current balance: <span className="font-semibold text-foreground">{formattedWalletBalance || currencyFormatter.format(0)}</span>
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount to top up</label>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    inputMode="decimal"
                    value={walletAmount}
                    onChange={(e) => setWalletAmount(e.target.value)}
                    placeholder="Enter amount"
                  />
                </div>

                {topupQuote && (
                  <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Wallet credit</span>
                      <span className="font-medium text-foreground">{currencyFormatter.format(topupQuote.walletCreditAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Payment charge</span>
                      <span className="font-medium text-foreground">{currencyFormatter.format(topupQuote.feeAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t">
                      <span className="text-foreground font-medium">Total to pay</span>
                      <span className="font-semibold text-foreground">{currencyFormatter.format(topupQuote.payableAmount)}</span>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setActiveWalletView("menu")} disabled={walletLoading}>
                  Back
                </Button>
                <Button onClick={handleWalletTopUp} disabled={walletLoading}>
                  {walletLoading ? "Redirecting..." : "Continue to payment"}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* WITHDRAW VIEW */}
          {activeWalletView === "withdraw" && (
            <>
              <DialogHeader>
                <DialogTitle>Request withdrawal</DialogTitle>
                <DialogDescription>
                  Withdraw funds to your bank account.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 max-h-96 overflow-y-auto">
                <p className="text-sm text-muted-foreground">
                  Current balance: <span className="font-semibold text-foreground">{formattedWalletBalance || currencyFormatter.format(0)}</span>
                </p>

                {/* PIN SETUP SECTION */}
                {!hasWithdrawalPin && (
                  <div className="space-y-3 rounded-md bg-blue-50 dark:bg-blue-950 p-3 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium">Set your Withdrawal PIN</p>
                    <p className="text-xs text-muted-foreground">You must set a 4-digit PIN before you can withdraw funds.</p>

                    <div className="relative">
                      <Input
                        type={showNewPin ? "text" : "password"}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="4-digit PIN"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPin(!showNewPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    <div className="relative">
                      <Input
                        type={showConfirmNewPin ? "text" : "password"}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={confirmNewPin}
                        onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="Confirm PIN"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPin(!showConfirmNewPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    <Button onClick={handleSetWithdrawalPin} disabled={pinLoading} className="w-full">
                      {pinLoading ? "Setting PIN..." : "Set PIN"}
                    </Button>
                  </div>
                )}

                {/* PIN CHANGE SECTION */}
                {hasWithdrawalPin && (
                  <div className="space-y-2">
                    <details className="rounded-md border p-3">
                      <summary className="cursor-pointer text-sm font-medium">Change your PIN</summary>
                      <div className="space-y-2 mt-3">
                        <div className="relative">
                          <Input
                            type={showCurrentPin ? "text" : "password"}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            value={currentPin}
                            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            placeholder="Current PIN"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPin(!showCurrentPin)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showCurrentPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            type={showNewPin ? "text" : "password"}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            placeholder="New PIN"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPin(!showNewPin)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            type={showConfirmNewPin ? "text" : "password"}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            value={confirmNewPin}
                            onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            placeholder="Confirm new PIN"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmNewPin(!showConfirmNewPin)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showConfirmNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <Button onClick={handleSetWithdrawalPin} disabled={pinLoading} variant="outline" className="w-full">
                          {pinLoading ? "Updating PIN..." : "Update PIN"}
                        </Button>
                      </div>
                    </details>
                  </div>
                )}

                {/* WITHDRAWAL REQUEST FORM */}
                {hasWithdrawalPin && (
                  <div className="space-y-3 rounded-md border p-3">
                    <p className="text-sm font-medium">Withdrawal details</p>

                    <div>
                      <label className="text-xs font-medium">Amount</label>
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        inputMode="decimal"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Withdrawal amount"
                      />
                      {withdrawAmountExceedsBalance && (
                        <p className="text-xs text-red-600 mt-1">Amount cannot be greater than your available balance.</p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-medium">Bank</label>
                      <select
                        className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-neutral-900"
                        value={bankCode}
                        onChange={(e) => handleBankChange(e.target.value)}
                        disabled={verifyLoading || banks.length === 0}
                      >
                        <option value="">Select bank</option>
                        {banks.map((bank) => (
                          <option key={bank.code} value={bank.code}>{bank.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium">Account number</label>
                      <Input
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="10-digit account number"
                        maxLength={10}
                        inputMode="numeric"
                        disabled={!bankCode || verifyLoading}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium">Account name</label>
                      <Input
                        value={accountName}
                        readOnly
                        placeholder="Account name will be auto-filled"
                        disabled
                      />
                      {verifyLoading && <p className="text-xs text-muted-foreground mt-1">Verifying account...</p>}
                      {accountError && <p className="text-xs text-red-600 mt-1">{accountError}</p>}
                      {accountVerified && !accountError && <p className="text-xs text-green-600 mt-1">Account verified</p>}
                    </div>

                    <div className="relative">
                      <label className="text-xs font-medium block mb-1">Withdrawal PIN</label>
                      <Input
                        type={showWithdrawalPin ? "text" : "password"}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={withdrawalPin}
                        onChange={(e) => setWithdrawalPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="Enter PIN"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWithdrawalPin(!showWithdrawalPin)}
                        className="absolute right-3 top-10 text-muted-foreground hover:text-foreground"
                      >
                        {showWithdrawalPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setActiveWalletView("menu")} disabled={withdrawLoading || pinLoading}>
                  Back
                </Button>
                {hasWithdrawalPin && (
                  <Button onClick={handleWalletWithdraw} disabled={withdrawLoading || verifyLoading || !accountVerified || withdrawAmountExceedsBalance}>
                    {withdrawLoading ? "Submitting..." : "Request withdrawal"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Vendor Wallet Modal */}
      <VendorWalletModal
        open={vendorWalletModalOpen}
        onOpenChange={setVendorWalletModalOpen}
        walletBalance={vendorWalletBalance ?? 0}
        onBalanceUpdated={setVendorWalletBalance}
      />

      {/* Background overlay */}
      <div
        className={`fixed inset-0 bg-black z-90 xl:hidden transition-opacity duration-200 ease-out ${
          isMenuOpen ? "opacity-50 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMenuOpen(false)}
      />

      {/* Drawer Panel */}
      <div
        className={`fixed top-0 right-0 h-screen max-w-xs transform-gpu bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 shadow-xl z-100 flex flex-col overflow-hidden xl:hidden ${
          isMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{
          width: mobileDrawerWidth,
          height: "100dvh",
          transform: isMenuOpen ? "translate3d(0,0,0)" : "translate3d(100%,0,0)",
          transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
          contain: "paint",
          backfaceVisibility: "hidden",
        }}
      >
              {/* Header */}
              <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <img
                  src="/images/logo (2).png"
                  alt="Make It Sell"
                  className="h-4 sm:h-6 w-auto object-contain"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMenuOpen(false)}
                  className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Navigation Links - Oval Buttons */}
              <div className="px-3 sm:px-6 pt-6 sm:pt-8 pb-4 sm:pb-6 space-y-2 sm:space-y-4 flex-1 overflow-y-auto">
                <Link
                  href="/stores"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    Stores
                  </div>
                </Link>
                <Link
                  href="/services"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    Services
                  </div>
                </Link>
                <Link
                  href="/about"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    About Us
                  </div>
                </Link>
                <Link
                  href="/support"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    FAQS
                  </div>
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full"
                >
                  <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                    Contact Us
                  </div>
                </Link>

                {/* Auth Buttons or User Profile */}
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-8 h-8 rounded-full bg-gray-300 animate-pulse"></div>
                  </div>
                ) : !(user && userProfile) ? (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="block w-full"
                    >
                      <div className="bg-[oklch(0.21_0.194_29.234)] dark:bg-[oklch(0.25_0.194_29.234)] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg">
                        Sign in
                      </div>
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setIsMenuOpen(false)}
                      className="block w-full"
                    >
                      <div className="bg-white dark:bg-gray-800 text-[oklch(0.21_0.194_29.234)] dark:text-white border-2 border-[oklch(0.21_0.194_29.234)] dark:border-gray-600 px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm text-center font-medium hover:bg-[oklch(0.21_0.194_29.234)] hover:text-white dark:hover:bg-[oklch(0.25_0.194_29.234)] transition-all shadow-md hover:shadow-lg">
                        Join Us
                      </div>
                    </Link>
                  </>
                ) : null}
              </div>

              {/* Footer Section */}
              {!(user && userProfile) && (
                <div className="px-3 sm:px-6 py-3 sm:py-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-1">Get early access</h3>
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 mb-2">
                    Become a Make It Sell member to buy smarter, sell faster, and grow with the community.
                  </p>
                  <p className="text-[9px] text-gray-500 dark:text-gray-500">
                    © 2026 Make It Sell. All rights reserved.
                  </p>
                </div>
              )}
      </div>
    </header>
  )
}
