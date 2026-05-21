"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import LogisticsLayout from "@/components/logistics/LogisticsLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Wallet, TrendingUp, Package, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LogisticsTx {
  id: string
  type: string
  amount: number
  status: string
  reference: string
  note: string
  orderId: string
  createdAt: string
  direction: string
}

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
})

export default function LogisticsAbujaWalletPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [walletBalance, setWalletBalance] = useState(0)
  const [transactions, setTransactions] = useState<LogisticsTx[]>([])
  const [error, setError] = useState("")

  const fetchWallet = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/logistics/wallet?region=abuja", { credentials: "include" })
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

  useEffect(() => {
    if (user) fetchWallet()
  }, [user])

  const totalEarned = transactions
    .filter(tx => tx.type === "logistics_delivery_credit" && tx.status === "completed")
    .reduce((sum, tx) => sum + tx.amount, 0)

  const deliveryCount = transactions.filter(tx => tx.type === "logistics_delivery_credit").length

  return (
    <LogisticsLayout regionKey="abuja">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <p className="text-sm text-muted-foreground">Orah Abuja delivery earnings</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchWallet} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="sm:col-span-1 border-2 border-accent/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Current Balance</p>
              </div>
              <p className="text-3xl font-extrabold text-accent">
                {loading ? "—" : currencyFormatter.format(walletBalance)}
              </p>
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
              <p className="text-2xl font-bold text-green-600">
                {loading ? "—" : currencyFormatter.format(totalEarned)}
              </p>
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
              <p className="text-2xl font-bold text-blue-600">
                {loading ? "—" : deliveryCount}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>All delivery credits and payments</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-10">
                <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No transactions yet</p>
                <p className="text-xs text-muted-foreground mt-1">Credits will appear here as deliveries are completed</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">
                          {tx.type === "logistics_delivery_credit" ? "Delivery Credit" : tx.type.replace(/_/g, " ")}
                        </p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          tx.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                      {tx.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{tx.note}</p>}
                      {tx.createdAt && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(tx.createdAt).toLocaleString("en-NG", {
                            day: "numeric", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
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
