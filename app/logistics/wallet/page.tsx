"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import LogisticsLayout from "@/components/logistics/LogisticsLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Wallet, TrendingUp, Package, RefreshCw, ArrowDownToLine, CheckCircle2 } from "lucide-react"
import RetiredFeatureNotice from "@/components/RetiredFeatureNotice"

const BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "Citibank", code: "023" },
  { name: "Diamond Bank", code: "063" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank", code: "214" },
  { name: "Globus Bank", code: "00103" },
  { name: "GTBank", code: "058" },
  { name: "Heritage Bank", code: "030" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kuda Bank", code: "090267" },
  { name: "Opay", code: "999992" },
  { name: "Palmpay", code: "999991" },
  { name: "Polaris Bank", code: "076" },
  { name: "Providus Bank", code: "101" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Standard Chartered Bank", code: "068" },
  { name: "Sterling Bank", code: "232" },
  { name: "Titan Trust Bank", code: "102" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "United Bank For Africa", code: "033" },
  { name: "Unity Bank", code: "215" },
  { name: "VFD Microfinance Bank", code: "090110" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
]

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
})

interface LogisticsTx {
  id: string
  type: string
  amount: number
  status: string
  note: string
  orderId: string
  createdAt: string
  direction: string
}

export default function LogisticsWalletPage() {
  return (
    <RetiredFeatureNotice
      title="Logistics wallet retired"
      message="Deliveries are now dispatched and tracked automatically through Shipbubble. This page is no longer in use."
    />
  )

  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [walletBalance, setWalletBalance] = useState(0)
  const [transactions, setTransactions] = useState<LogisticsTx[]>([])
  const [error, setError] = useState("")
  const [showWithdraw, setShowWithdraw] = useState(false)

  // Withdrawal form
  const [amount, setAmount] = useState("")
  const [bankCode, setBankCode] = useState("")
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [accountVerified, setAccountVerified] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState("")
  const [withdrawSuccess, setWithdrawSuccess] = useState("")

  const fetchWallet = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/logistics/wallet?region=lagos", { credentials: "include" })
      const data = await res.json()
      if (data.success) {
        setWalletBalance(data.walletBalance)
        setTransactions(Array.isArray(data.transactions) ? data.transactions : [])
      } else {
        setError(data.error || "Failed to load wallet")
      }
    } catch {
      setError("Failed to load wallet")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user) fetchWallet() }, [user])

  const handleBankChange = (code: string) => {
    const bank = BANKS.find(b => b.code === code)
    setBankCode(code)
    setBankName(bank?.name || "")
    setAccountName("")
    setAccountVerified(false)
  }

  const verifyAccount = async () => {
    if (!/^\d{10}$/.test(accountNumber) || !bankCode) return
    setVerifying(true)
    setAccountName("")
    setAccountVerified(false)
    try {
      const res = await fetch("/api/vendor/resolve-account", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankCode, accountNumber, bankName }),
      })
      const data = await res.json()
      if (data.success && data.accountName) {
        setAccountName(data.accountName)
        setAccountVerified(true)
      } else {
        setAccountName("")
        setAccountVerified(false)
      }
    } catch {
      setAccountVerified(false)
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    if (accountNumber.length === 10 && bankCode) verifyAccount()
  }, [accountNumber, bankCode])

  const handleWithdraw = async () => {
    setWithdrawError("")
    setWithdrawSuccess("")
    const amt = Number(amount)
    if (!amt || amt < 1000) { setWithdrawError("Minimum withdrawal is ₦1,000"); return }
    if (!accountVerified) { setWithdrawError("Verify your account number first"); return }

    setWithdrawing(true)
    try {
      const res = await fetch("/api/logistics/wallet/withdraw", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, bankCode, bankName, accountNumber, accountName, region: "lagos" }),
      })
      const data = await res.json()
      if (data.success) {
        setWithdrawSuccess(data.message || "Withdrawal submitted successfully")
        setWalletBalance(data.newBalance)
        setAmount("")
        setAccountNumber("")
        setAccountName("")
        setBankCode("")
        setBankName("")
        setAccountVerified(false)
        setShowWithdraw(false)
        await fetchWallet()
      } else {
        setWithdrawError(data.error || "Withdrawal failed")
      }
    } catch {
      setWithdrawError("Request failed. Please try again.")
    } finally {
      setWithdrawing(false)
    }
  }

  const totalEarned = transactions.filter(tx => tx.type === "logistics_delivery_credit" && tx.status === "completed").reduce((s, tx) => s + tx.amount, 0)
  const deliveryCount = transactions.filter(tx => tx.type === "logistics_delivery_credit").length

  return (
    <LogisticsLayout regionKey="lagos">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <p className="text-sm text-muted-foreground">A&CO Lagos delivery earnings</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchWallet} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>}
        {withdrawSuccess && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />{withdrawSuccess}
          </div>
        )}

        {/* Balance cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="sm:col-span-1 border-2 border-accent/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Current Balance</p>
              </div>
              <p className="text-3xl font-extrabold text-accent">{loading ? "—" : currencyFormatter.format(walletBalance)}</p>
              <Button
                className="mt-3 w-full bg-accent text-white hover:bg-accent/90"
                size="sm"
                disabled={loading || walletBalance <= 0}
                onClick={() => { setShowWithdraw(v => !v); setWithdrawError(""); setWithdrawSuccess("") }}
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                {showWithdraw ? "Cancel" : "Withdraw"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Total Earned</p>
              </div>
              <p className="text-2xl font-bold text-green-600">{loading ? "—" : currencyFormatter.format(totalEarned)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Deliveries</p>
              </div>
              <p className="text-2xl font-bold text-blue-600">{loading ? "—" : deliveryCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Withdrawal form */}
        {showWithdraw && (
          <Card className="border-accent/30">
            <CardHeader>
              <CardTitle className="text-base">Withdraw Funds</CardTitle>
              <CardDescription>Transfer earnings to your bank account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {withdrawError && <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">{withdrawError}</p>}

              <div className="space-y-1">
                <Label>Amount (₦)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min={1000}
                  max={walletBalance}
                />
                <p className="text-xs text-muted-foreground">Available: {currencyFormatter.format(walletBalance)} · Min: ₦1,000</p>
              </div>

              <div className="space-y-1">
                <Label>Bank</Label>
                <Select value={bankCode} onValueChange={handleBankChange}>
                  <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>
                    {BANKS.map(b => <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Account Number</Label>
                <Input
                  placeholder="10-digit account number"
                  value={accountNumber}
                  onChange={e => { setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10)); setAccountVerified(false); setAccountName("") }}
                  maxLength={10}
                />
                {verifying && <p className="text-xs text-muted-foreground">Verifying account…</p>}
                {accountVerified && accountName && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {accountName}
                  </p>
                )}
              </div>

              <Button
                className="w-full bg-accent text-white hover:bg-accent/90"
                disabled={withdrawing || !accountVerified || !amount || Number(amount) < 1000 || Number(amount) > walletBalance}
                onClick={handleWithdraw}
              >
                {withdrawing ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Processing…</> : `Withdraw ${amount ? currencyFormatter.format(Number(amount)) : ""}`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Transaction history */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>All delivery credits and withdrawals</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-10">
                <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">
                          {tx.type === "logistics_delivery_credit" ? "Delivery Credit" : tx.type === "withdrawal" ? "Withdrawal" : tx.type.replace(/_/g, " ")}
                        </p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${tx.status === "completed" ? "bg-green-100 text-green-700" : tx.status === "failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {tx.status}
                        </span>
                      </div>
                      {tx.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{tx.note}</p>}
                      {tx.createdAt && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(tx.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                    <p className={`text-sm font-bold shrink-0 ${tx.direction === "credit" ? "text-green-600" : "text-red-500"}`}>
                      {tx.direction === "credit" ? "+" : "-"}{currencyFormatter.format(tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LogisticsLayout>
  )
}
