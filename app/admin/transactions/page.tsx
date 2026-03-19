"use client"

import { useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Search } from "lucide-react"

type AdminTransaction = {
  id: string
  source: "wallet" | "order" | "booking"
  transactionType: string
  status: string
  amount: number
  currency: string
  reference: string
  provider: string
  userId: string
  userName: string
  userEmail: string
  description: string
  createdAt: string
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [reconciling, setReconciling] = useState(false)
  const [reconcileMessage, setReconcileMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const toDateInput = (value: Date) => {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const applyDatePreset = (preset: "today" | "last7" | "month") => {
    const now = new Date()
    const end = toDateInput(now)

    if (preset === "today") {
      setFromDate(end)
      setToDate(end)
      return
    }

    if (preset === "last7") {
      const start = new Date(now)
      start.setDate(start.getDate() - 6)
      setFromDate(toDateInput(start))
      setToDate(end)
      return
    }

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    setFromDate(toDateInput(startOfMonth))
    setToDate(end)
  }

  const loadTransactions = async () => {
    try {
      const response = await fetch("/api/admin/transactions", {
        method: "GET",
        credentials: "include",
      })
      const result = await response.json()
      if (response.ok && result?.success && Array.isArray(result.transactions)) {
        setTransactions(result.transactions)
      }
    } catch (error) {
      console.error("Failed to load admin transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions()
  }, [])

  const runWithdrawalReconcile = async () => {
    try {
      setReconciling(true)
      setReconcileMessage("")

      const response = await fetch("/api/admin/wallet/reconcile-withdrawals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, limit: 2000 }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to reconcile withdrawals")
      }

      const summary = result?.summary || {}
      setReconcileMessage(
        `Reconciled withdrawals. Updated ${Number(summary.updated || 0)} out of ${Number(summary.scanned || 0)} scanned.`
      )

      await loadTransactions()
    } catch (error: any) {
      setReconcileMessage(error?.message || "Failed to reconcile withdrawals")
    } finally {
      setReconciling(false)
    }
  }

  const sourceOptions = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach((tx) => set.add(tx.source))
    return Array.from(set.values()).sort()
  }, [transactions])

  const typeOptions = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach((tx) => set.add(tx.transactionType))
    return Array.from(set.values()).sort()
  }, [transactions])

  const statusOptions = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach((tx) => set.add(tx.status))
    return Array.from(set.values()).sort()
  }, [transactions])

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const fromTime = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null
    const toTime = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null

    return transactions.filter((tx) => {
      const matchesSearch = !term
        || tx.reference.toLowerCase().includes(term)
        || tx.userName.toLowerCase().includes(term)
        || tx.userEmail.toLowerCase().includes(term)
        || tx.description.toLowerCase().includes(term)
        || tx.provider.toLowerCase().includes(term)

      const matchesSource = sourceFilter === "all" || tx.source === sourceFilter
      const matchesType = typeFilter === "all" || tx.transactionType === typeFilter
      const matchesStatus = statusFilter === "all" || tx.status === statusFilter
      const txTime = new Date(tx.createdAt).getTime()
      const matchesFrom = fromTime === null || txTime >= fromTime
      const matchesTo = toTime === null || txTime <= toTime

      return matchesSearch && matchesSource && matchesType && matchesStatus && matchesFrom && matchesTo
    })
  }, [transactions, searchTerm, sourceFilter, typeFilter, statusFilter, fromDate, toDate])

  const exportFilteredAsCsv = () => {
    if (filtered.length === 0) return

    const escapeCsv = (value: any) => {
      const text = String(value ?? "")
      if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`
      }
      return text
    }

    const headers = [
      "date",
      "source",
      "transactionType",
      "status",
      "amount",
      "currency",
      "reference",
      "provider",
      "userId",
      "userName",
      "userEmail",
      "description",
    ]

    const rows = filtered.map((tx) => [
      new Date(tx.createdAt).toISOString(),
      tx.source,
      tx.transactionType,
      tx.status,
      tx.amount,
      tx.currency,
      tx.reference,
      tx.provider,
      tx.userId,
      tx.userName,
      tx.userEmail,
      tx.description,
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `admin-transactions-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const statusBadge = (status: string) => {
    const normalized = String(status || "").toLowerCase()
    if (["completed", "success", "successful", "paid", "delivered", "received", "confirmed"].includes(normalized)) {
      return <Badge variant="secondary">{status}</Badge>
    }
    if (["failed", "cancelled", "canceled", "declined"].includes(normalized)) {
      return <Badge variant="destructive">{status}</Badge>
    }
    return <Badge variant="outline">{status}</Badge>
  }

  const sourceBadge = (source: string) => {
    const normalized = String(source || "").toLowerCase()
    if (normalized === "wallet") return <Badge variant="outline">Wallet</Badge>
    if (normalized === "order") return <Badge variant="default">Order</Badge>
    return <Badge variant="secondary">Booking</Badge>
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Transaction Logs</h1>
          <p className="text-muted-foreground text-sm lg:text-base">All wallet, order, and booking transactions in one admin view.</p>
        </div>

        <div className="grid gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{transactions.length.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Filtered Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{filtered.length.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Filtered Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ₦{filtered.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={runWithdrawalReconcile} disabled={reconciling}>
                {reconciling ? "Reconciling..." : "Reconcile Withdrawal Statuses"}
              </Button>
              {reconcileMessage ? <p className="text-xs text-muted-foreground">{reconcileMessage}</p> : null}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by ref, user, provider"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {sourceOptions.map((source) => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {typeOptions.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />

              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />

              <div className="flex flex-wrap gap-2 lg:col-span-2">
                <Button type="button" variant="outline" onClick={() => applyDatePreset("today")}>
                  Today
                </Button>
                <Button type="button" variant="outline" onClick={() => applyDatePreset("last7")}>
                  Last 7 Days
                </Button>
                <Button type="button" variant="outline" onClick={() => applyDatePreset("month")}>
                  This Month
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("")
                    setSourceFilter("all")
                    setTypeFilter("all")
                    setStatusFilter("all")
                    setFromDate("")
                    setToDate("")
                  }}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  onClick={exportFilteredAsCsv}
                  disabled={filtered.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Logs ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-accent rounded-full"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">No transactions found.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(tx.createdAt).toLocaleString()}</TableCell>
                        <TableCell>{sourceBadge(tx.source)}</TableCell>
                        <TableCell className="text-xs">{tx.transactionType}</TableCell>
                        <TableCell>{statusBadge(tx.status)}</TableCell>
                        <TableCell>
                          <div className="max-w-[220px]">
                            <p className="text-sm font-medium truncate">{tx.userName}</p>
                            <p className="text-xs text-muted-foreground truncate">{tx.userEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[220px]">
                            <p className="text-xs font-medium truncate">{tx.reference}</p>
                            <p className="text-xs text-muted-foreground truncate">{tx.provider}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">₦{Number(tx.amount || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
