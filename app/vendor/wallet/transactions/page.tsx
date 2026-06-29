'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import VendorLayout from '@/components/vendor/VendorLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Filter, ArrowDownToLine, Loader2, TrendingUp, Gift, PiggyBank, Wallet } from 'lucide-react'
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

interface BalanceData {
  walletBalance: number
  earnedBalance: number
  depositedBalance: number
  prizeBalance: number
  escrowBalance: number
}

interface WithdrawalBreakdown {
  amount: number
  withdrawFromDeposited: number
  withdrawFromPrize: number
  withdrawFromEarned: number
  commission: number
  vendorReceives: number
}

const fmt = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type WithdrawStep = 'form' | 'preview' | 'submitting' | 'done'

export default function VendorWalletTransactionsPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<WalletTx[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<WalletTx[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [balances, setBalances] = useState<BalanceData | null>(null)

  // Withdrawal form state
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>('form')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [withdrawalPin, setWithdrawalPin] = useState('')
  const [breakdown, setBreakdown] = useState<WithdrawalBreakdown | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')
  const [withdrawSuccess, setWithdrawSuccess] = useState('')

  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [transactions, typeFilter, statusFilter])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/vendor/wallet/transactions', {
        method: 'GET',
        credentials: 'include',
      })
      const result = await response.json()
      if (response.ok && result?.success && Array.isArray(result.transactions)) {
        setTransactions(result.transactions)
        setBalances({
          walletBalance: typeof result.walletBalance === 'number' ? result.walletBalance : 0,
          earnedBalance: typeof result.earnedBalance === 'number' ? result.earnedBalance : 0,
          depositedBalance: typeof result.depositedBalance === 'number' ? result.depositedBalance : 0,
          prizeBalance: typeof result.prizeBalance === 'number' ? result.prizeBalance : 0,
          escrowBalance: typeof result.escrowBalance === 'number' ? result.escrowBalance : 0,
        })
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...transactions]
    if (typeFilter !== 'all') filtered = filtered.filter((tx) => tx.type === typeFilter)
    if (statusFilter !== 'all') filtered = filtered.filter((tx) => tx.status === statusFilter)
    setFilteredTransactions(filtered)
  }

  const handlePreview = async () => {
    setWithdrawError('')
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount <= 0) {
      setWithdrawError('Enter a valid withdrawal amount')
      return
    }
    if (!bankName.trim() || !bankCode.trim() || !accountNumber.trim() || !accountName.trim()) {
      setWithdrawError('Fill in all bank details')
      return
    }
    if (!/^\d{10}$/.test(accountNumber.replace(/\D/g, ''))) {
      setWithdrawError('Account number must be 10 digits')
      return
    }
    if (!withdrawalPin.trim() || !/^\d{4}$/.test(withdrawalPin.trim())) {
      setWithdrawError('Enter your 4-digit withdrawal PIN')
      return
    }

    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/vendor/wallet/withdraw/preview?amount=${amount}`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (!data.success) {
        setWithdrawError(data.error || 'Could not calculate breakdown')
        return
      }
      setBreakdown(data)
      setWithdrawStep('preview')
    } catch {
      setWithdrawError('Failed to calculate breakdown. Please try again.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleConfirmWithdraw = async () => {
    setWithdrawError('')
    setWithdrawStep('submitting')
    try {
      const res = await fetch('/api/vendor/wallet/withdraw', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(withdrawAmount),
          bankName,
          bankCode,
          accountNumber,
          accountName,
          withdrawalPin,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setWithdrawStep('preview')
        setWithdrawError(data.error || 'Withdrawal failed')
        return
      }
      setWithdrawSuccess(data.message || 'Withdrawal submitted successfully.')
      setWithdrawStep('done')
      await fetchTransactions()
    } catch {
      setWithdrawStep('preview')
      setWithdrawError('Withdrawal failed. Please try again.')
    }
  }

  const resetWithdrawForm = () => {
    setWithdrawAmount('')
    setBankName('')
    setBankCode('')
    setAccountNumber('')
    setAccountName('')
    setWithdrawalPin('')
    setBreakdown(null)
    setWithdrawError('')
    setWithdrawSuccess('')
    setWithdrawStep('form')
    setShowWithdraw(false)
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      vendor_credit: 'Order Payout',
      withdrawal: 'Withdrawal',
      topup: 'Top Up',
    }
    return labels[type] || type.replace(/_/g, ' ')
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      manual_review: 'bg-accent/10 text-accent',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    }
    return colors[status] || 'bg-muted text-muted-foreground'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = { manual_review: 'manual review' }
    return labels[status] || status.replace(/_/g, ' ')
  }

  return (
    <ProtectedRoute requiredRole="vendor">
      <div className="min-h-screen flex flex-col">
        <Header />
        <VendorLayout>
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/vendor/dashboard">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">Wallet</h1>
                  <p className="text-muted-foreground">Balance, earnings, and withdrawals</p>
                </div>
              </div>
              {!showWithdraw && balances && balances.walletBalance > 0 && (
                <Button onClick={() => setShowWithdraw(true)} className="gap-2">
                  <ArrowDownToLine className="h-4 w-4" />
                  Withdraw
                </Button>
              )}
            </div>

            {/* Balance breakdown */}
            {balances && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Total Available</p>
                    </div>
                    <p className="text-xl font-bold">{fmt.format(balances.walletBalance)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <p className="text-xs text-muted-foreground">Sales Earnings</p>
                    </div>
                    <p className="text-xl font-bold">{fmt.format(balances.earnedBalance)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">5% fee on withdrawal</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <PiggyBank className="h-4 w-4 text-blue-600" />
                      <p className="text-xs text-muted-foreground">Deposited Funds</p>
                    </div>
                    <p className="text-xl font-bold">{fmt.format(balances.depositedBalance)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">No fee on withdrawal</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Gift className="h-4 w-4 text-purple-600" />
                      <p className="text-xs text-muted-foreground">Prize Earnings</p>
                    </div>
                    <p className="text-xl font-bold">{fmt.format(balances.prizeBalance)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">No fee on withdrawal</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Escrow balance */}
            {balances && balances.escrowBalance > 0 && (
              <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {fmt.format(balances.escrowBalance)} held in escrow
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Released to you once orders are marked as completed
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Withdrawal form */}
            {showWithdraw && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Withdraw Funds</CardTitle>
                  <CardDescription>
                    {withdrawStep === 'preview'
                      ? 'Review the fee breakdown before confirming'
                      : withdrawStep === 'done'
                      ? 'Withdrawal submitted'
                      : 'Enter your bank details and withdrawal amount'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {withdrawStep === 'form' && (
                    <div className="space-y-4 max-w-md">
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Amount (₦)</label>
                        <input
                          type="number"
                          min="1000"
                          value={withdrawAmount}
                          onChange={e => setWithdrawAmount(e.target.value)}
                          placeholder="e.g. 10000"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Bank Name</label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={e => setBankName(e.target.value)}
                          placeholder="e.g. Guaranty Trust Bank"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Bank Code</label>
                        <input
                          type="text"
                          value={bankCode}
                          onChange={e => setBankCode(e.target.value)}
                          placeholder="e.g. 058"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Account Number</label>
                        <input
                          type="text"
                          value={accountNumber}
                          onChange={e => setAccountNumber(e.target.value)}
                          placeholder="10-digit account number"
                          maxLength={10}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Account Name</label>
                        <input
                          type="text"
                          value={accountName}
                          onChange={e => setAccountName(e.target.value)}
                          placeholder="As it appears on your bank account"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Withdrawal PIN</label>
                        <input
                          type="password"
                          value={withdrawalPin}
                          onChange={e => setWithdrawalPin(e.target.value)}
                          placeholder="4-digit PIN"
                          maxLength={4}
                          inputMode="numeric"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      {withdrawError && (
                        <p className="text-sm text-red-600">{withdrawError}</p>
                      )}
                      <div className="flex gap-3 pt-2">
                        <Button onClick={handlePreview} disabled={previewLoading} className="gap-2">
                          {previewLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                          Review Withdrawal
                        </Button>
                        <Button variant="outline" onClick={resetWithdrawForm}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {(withdrawStep === 'preview' || withdrawStep === 'submitting') && breakdown && (
                    <div className="max-w-md space-y-4">
                      <div className="rounded-lg border divide-y text-sm">
                        {breakdown.withdrawFromDeposited > 0 && (
                          <div className="flex justify-between items-center px-4 py-3">
                            <span className="text-muted-foreground">From your deposited funds</span>
                            <div className="text-right">
                              <span className="font-medium">{fmt.format(breakdown.withdrawFromDeposited)}</span>
                              <span className="text-xs text-green-600 ml-2">(no fee)</span>
                            </div>
                          </div>
                        )}
                        {breakdown.withdrawFromPrize > 0 && (
                          <div className="flex justify-between items-center px-4 py-3">
                            <span className="text-muted-foreground">From your prize earnings</span>
                            <div className="text-right">
                              <span className="font-medium">{fmt.format(breakdown.withdrawFromPrize)}</span>
                              <span className="text-xs text-green-600 ml-2">(no fee)</span>
                            </div>
                          </div>
                        )}
                        {breakdown.withdrawFromEarned > 0 && (
                          <div className="flex justify-between items-center px-4 py-3">
                            <span className="text-muted-foreground">From your sales earnings</span>
                            <div className="text-right">
                              <span className="font-medium">{fmt.format(breakdown.withdrawFromEarned)}</span>
                              {breakdown.commission > 0 && (
                                <p className="text-xs text-amber-600">5% fee = {fmt.format(breakdown.commission)}</p>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between items-center px-4 py-3 bg-muted/40 font-semibold">
                          <span>You will receive</span>
                          <span className="text-green-700 dark:text-green-400 text-base">{fmt.format(breakdown.vendorReceives)}</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Withdrawing {fmt.format(breakdown.amount)} to {accountName} ({bankName})
                      </div>
                      {withdrawError && (
                        <p className="text-sm text-red-600">{withdrawError}</p>
                      )}
                      <div className="flex gap-3">
                        <Button
                          onClick={handleConfirmWithdraw}
                          disabled={withdrawStep === 'submitting'}
                          className="gap-2"
                        >
                          {withdrawStep === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" />}
                          Confirm Withdrawal
                        </Button>
                        <Button variant="outline" onClick={() => setWithdrawStep('form')} disabled={withdrawStep === 'submitting'}>
                          Back
                        </Button>
                      </div>
                    </div>
                  )}

                  {withdrawStep === 'done' && (
                    <div className="max-w-md space-y-4">
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium">{withdrawSuccess}</p>
                      <Button variant="outline" onClick={resetWithdrawForm}>Close</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Filters */}
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
                        <SelectItem value="vendor_credit">Order Payout</SelectItem>
                        <SelectItem value="withdrawal">Withdrawal</SelectItem>
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

            {/* Transaction history */}
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
                          {tx.orderId && (
                            <p className="text-xs text-muted-foreground">Order: {tx.orderId}</p>
                          )}
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
                            {fmt.format(Number(tx.amount || 0))}
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
        </VendorLayout>
      </div>
    </ProtectedRoute>
  )
}
