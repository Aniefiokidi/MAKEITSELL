'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Download, Filter } from 'lucide-react'
import Link from 'next/link'

interface WalletTx {
  id: string
  type: string
  amount: number
  status: string
  reference?: string
  note?: string
  provider?: string
  orderId?: string
  createdAt?: string
  direction?: 'credit' | 'debit' | 'neutral'
}

export default function WalletTransactionsPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<WalletTx[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<WalletTx[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const currencyFormatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [transactions, typeFilter, statusFilter])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/wallet/transactions', {
        method: 'GET',
        credentials: 'include',
      })
      const result = await response.json()
      if (response.ok && result?.success && Array.isArray(result.transactions)) {
        setTransactions(result.transactions)
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...transactions]

    if (typeFilter !== 'all') {
      filtered = filtered.filter((tx) => tx.type === typeFilter)
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((tx) => tx.status === statusFilter)
    }

    setFilteredTransactions(filtered)
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      topup: 'Top Up',
      withdrawal: 'Withdrawal',
      purchase_debit: 'Purchase',
      vendor_credit: 'Vendor Credit',
    }
    return labels[type] || type.replace(/_/g, ' ')
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      manual_review: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    }
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      manual_review: 'manual review',
    }
    return labels[status] || status.replace(/_/g, ' ')
  }

  return (
    <ProtectedRoute requiredRole="customer">
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/stores">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">Wallet Transactions</h1>
                  <p className="text-muted-foreground">View your complete transaction history</p>
                </div>
              </div>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
                <CardDescription>Filter transactions by type and status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Transaction Type</label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="topup">Top Up</SelectItem>
                        <SelectItem value="withdrawal">Withdrawal</SelectItem>
                        <SelectItem value="purchase_debit">Purchase</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="manual_review">Manual Review</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading transactions...</p>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No transactions found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-start justify-between gap-4 p-4 rounded-lg border hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{getTypeLabel(tx.type)}</p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(tx.status)}`}
                            >
                              {getStatusLabel(tx.status)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{tx.note || 'No description'}</p>
                          {tx.reference && (
                            <p className="text-xs text-muted-foreground font-mono">Ref: {tx.reference}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : ''}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <p
                            className={`text-lg font-bold ${
                              tx.direction === 'credit'
                                ? 'text-green-600'
                                : tx.direction === 'debit'
                                ? 'text-red-600'
                                : 'text-foreground'
                            }`}
                          >
                            {tx.direction === 'credit' ? '+' : tx.direction === 'debit' ? '-' : ''}
                            {currencyFormatter.format(Number(tx.amount || 0))}
                          </p>
                          {tx.provider && (
                            <p className="text-xs text-muted-foreground capitalize">{tx.provider}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
