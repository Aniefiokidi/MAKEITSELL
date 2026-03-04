'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import { useNotification } from '@/contexts/NotificationContext'

interface WalletTx {
  id: string
  type: string
  amount: number
  status: string
  note?: string
  createdAt?: string
  direction?: 'credit' | 'debit' | 'neutral'
}

interface VendorWalletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  walletBalance: number
  onBalanceUpdated?: (balance: number) => void
}

export function VendorWalletModal({
  open,
  onOpenChange,
  walletBalance,
  onBalanceUpdated,
}: VendorWalletModalProps) {
  const notification = useNotification()
  const [activeWalletView, setActiveWalletView] = useState<'menu' | 'topup' | 'pin' | 'withdraw'>('menu')
  const [hasWithdrawalPin, setHasWithdrawalPin] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupAmount, setTopupAmount] = useState('')

  // PIN form states
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [showCurrentPin, setShowCurrentPin] = useState(false)
  const [showNewPin, setShowNewPin] = useState(false)
  const [showConfirmNewPin, setShowConfirmNewPin] = useState(false)

  // Withdrawal form states
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [withdrawalPin, setWithdrawalPin] = useState('')
  const [showWithdrawalPin, setShowWithdrawalPin] = useState(false)
  const [walletTransactions, setWalletTransactions] = useState<WalletTx[]>([])
  const [walletTxLoading, setWalletTxLoading] = useState(false)

  const currencyFormatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const formattedWalletBalance = currencyFormatter.format(walletBalance || 0)

  const fetchWalletTransactions = async () => {
    try {
      setWalletTxLoading(true)
      const response = await fetch('/api/vendor/wallet/transactions', {
        method: 'GET',
        credentials: 'include',
      })
      const result = await response.json()
      if (response.ok && result?.success && Array.isArray(result.transactions)) {
        setWalletTransactions(result.transactions)
        if (typeof result.walletBalance === 'number') {
          onBalanceUpdated?.(result.walletBalance)
        }
      }
    } catch {
      // ignore
    } finally {
      setWalletTxLoading(false)
    }
  }

  useEffect(() => {
    const fetchPinStatus = async () => {
      if (!open) return

      setActiveWalletView('menu')
      fetchWalletTransactions()
      try {
        const response = await fetch('/api/vendor/wallet/pin/status', {
          method: 'GET',
          credentials: 'include',
        })
        const result = await response.json()
        if (response.ok && result?.success) {
          setHasWithdrawalPin(!!result.hasWithdrawalPin)
        }
      } catch {
        // ignore
      }
    }

    fetchPinStatus()
  }, [open])

  useEffect(() => {
    if (!open) {
      // Clear form fields when modal closes
      setTopupAmount('')
      setWithdrawAmount('')
      setBankName('')
      setAccountName('')
      setAccountNumber('')
      setWithdrawalPin('')
      setCurrentPin('')
      setNewPin('')
      setConfirmNewPin('')
      setShowCurrentPin(false)
      setShowNewPin(false)
      setShowConfirmNewPin(false)
      setShowWithdrawalPin(false)
    }
  }, [open])

  const handleSetWithdrawalPin = async () => {
    if (!/^\d{4}$/.test(newPin.trim())) {
      notification.error('PIN must be exactly 4 digits', 'Invalid PIN', 3000)
      return
    }

    if (newPin.trim() !== confirmNewPin.trim()) {
      notification.error('PIN confirmation does not match', 'Invalid PIN', 3000)
      return
    }

    if (hasWithdrawalPin && !/^\d{4}$/.test(currentPin.trim())) {
      notification.error('Enter your current 4-digit PIN to change it', 'Current PIN required', 3000)
      return
    }

    try {
      setPinLoading(true)
      const response = await fetch('/api/vendor/wallet/pin/set', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPin: newPin.trim(),
          confirmNewPin: confirmNewPin.trim(),
          currentPin: currentPin.trim(),
        }),
      })

      const result = await response.json()
      if (response.ok && result?.success) {
        notification.success(result.message, 'PIN Updated', 3000)
        setHasWithdrawalPin(true)
        setNewPin('')
        setConfirmNewPin('')
        setCurrentPin('')
        setActiveWalletView('menu')
      } else {
        notification.error(result?.error || 'Failed to set PIN', 'Error', 3000)
      }
    } catch (error) {
      notification.error('Network error while setting PIN', 'Error', 3000)
    } finally {
      setPinLoading(false)
    }
  }

  const handleTopUp = async () => {
    const amount = Number(topupAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      notification.error('Please enter a valid amount greater than zero', 'Invalid amount', 3000)
      return
    }

    try {
      setTopupLoading(true)
      const response = await fetch('/api/vendor/wallet/topup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })

      const result = await response.json()
      if (!response.ok || !result?.success) {
        notification.error(result?.error || 'Unable to top up wallet', 'Top up failed', 3000)
        return
      }

      if (!result.authorization_url) {
        notification.error('Payment URL not returned', 'Top up failed', 3000)
        return
      }

      notification.info('Redirecting to secure payment...', 'Wallet top up', 2000)
      window.location.href = result.authorization_url
    } catch {
      notification.error('Network error while topping up wallet', 'Top up failed', 3000)
    } finally {
      setTopupLoading(false)
    }
  }

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      notification.error('Please enter a valid withdrawal amount', 'Invalid amount', 3000)
      return
    }

    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      notification.error('Enter bank name, account number and account name', 'Missing details', 3000)
      return
    }

    if (!/^\d{4}$/.test(withdrawalPin.trim())) {
      notification.error('Enter your 4-digit withdrawal PIN', 'Invalid PIN', 3000)
      return
    }

    try {
      setWithdrawLoading(true)
      const response = await fetch('/api/vendor/wallet/withdraw', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
          withdrawalPin: withdrawalPin.trim(),
        }),
      })

      const result = await response.json()
      if (response.ok && result?.success) {
        notification.success('Withdrawal request submitted', result.reference || 'Pending processing', 3000)
        if (typeof result.balance === 'number') {
          onBalanceUpdated?.(result.balance)
        }
        await fetchWalletTransactions()
        setWithdrawAmount('')
        setBankName('')
        setAccountName('')
        setAccountNumber('')
        setWithdrawalPin('')
        setActiveWalletView('menu')
      } else {
        notification.error(result?.error || 'Unable to process withdrawal', 'Withdrawal failed', 3000)
      }
    } catch (error) {
      notification.error('Network error while requesting withdrawal', 'Withdrawal failed', 3000)
    } finally {
      setWithdrawLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        {/* MENU VIEW */}
        {activeWalletView === 'menu' && (
          <>
            <DialogHeader>
              <DialogTitle>Vendor Wallet</DialogTitle>
              <DialogDescription>Manage your earnings and withdrawals</DialogDescription>
            </DialogHeader>

            <div className='space-y-4'>
              <div className='rounded-lg border p-3 bg-linear-to-br from-accent/10 to-transparent'>
                <p className='text-xs text-muted-foreground'>Wallet Balance</p>
                <p className='text-lg font-semibold text-foreground'>{formattedWalletBalance}</p>
              </div>

              <div className='grid grid-cols-3 gap-3'>
                <Button
                  onClick={() => setActiveWalletView('topup')}
                  className='h-20 flex flex-col items-center justify-center'
                >
                  <div className='text-2xl mb-1'>💰</div>
                  <span className='text-xs'>Top up</span>
                </Button>
                <Button
                  onClick={() => setActiveWalletView('pin')}
                  className='h-20 flex flex-col items-center justify-center'
                >
                  <div className='text-2xl mb-1'>🔐</div>
                  <span className='text-xs'>Manage PIN</span>
                </Button>
                <Button
                  onClick={() => setActiveWalletView('withdraw')}
                  variant='outline'
                  className='h-20 flex flex-col items-center justify-center'
                >
                  <div className='text-2xl mb-1'>💸</div>
                  <span className='text-xs'>Withdraw</span>
                </Button>
              </div>

              <div className='rounded-md border p-3'>
                <p className='text-xs font-medium mb-2'>Recent wallet activity</p>
                {walletTxLoading ? (
                  <p className='text-xs text-muted-foreground'>Loading transactions...</p>
                ) : walletTransactions.length === 0 ? (
                  <p className='text-xs text-muted-foreground'>No transactions yet.</p>
                ) : (
                  <div className='space-y-2 max-h-44 overflow-y-auto'>
                    {walletTransactions.slice(0, 8).map((tx) => (
                      <div key={tx.id} className='flex items-start justify-between gap-3 text-xs'>
                        <div>
                          <p className='font-medium text-foreground'>{tx.note || tx.type.replace(/_/g, ' ')}</p>
                          <p className='text-muted-foreground'>{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : ''}</p>
                        </div>
                        <div className='text-right'>
                          <p className={tx.direction === 'credit' ? 'font-semibold text-green-600' : tx.direction === 'debit' ? 'font-semibold text-red-600' : 'font-semibold'}>
                            {tx.direction === 'credit' ? '+' : tx.direction === 'debit' ? '-' : ''}
                            {currencyFormatter.format(Number(tx.amount || 0))}
                          </p>
                          <p className='text-muted-foreground'>{tx.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className='flex-col sm:flex-row gap-2'>
              <Button variant='ghost' size='sm' asChild className='w-full sm:w-auto'>
                <Link href='/vendor/wallet/transactions'>View all transactions</Link>
              </Button>
              <Button variant='outline' onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}

        {/* TOP UP VIEW */}
        {activeWalletView === 'topup' && (
          <>
            <DialogHeader>
              <DialogTitle>Top up wallet</DialogTitle>
              <DialogDescription>Add funds to your vendor wallet via Paystack.</DialogDescription>
            </DialogHeader>

            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Current balance: <span className='font-semibold text-foreground'>{formattedWalletBalance}</span>
              </p>

              <div className='space-y-2'>
                <label className='text-sm font-medium'>Amount to top up</label>
                <Input
                  type='number'
                  min='1'
                  step='0.01'
                  inputMode='decimal'
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder='Enter amount'
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant='outline' onClick={() => setActiveWalletView('menu')} disabled={topupLoading}>
                Back
              </Button>
              <Button onClick={handleTopUp} disabled={topupLoading}>
                {topupLoading ? 'Redirecting...' : 'Continue to payment'}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* PIN MANAGEMENT VIEW */}
        {activeWalletView === 'pin' && (
          <>
            <DialogHeader>
              <DialogTitle>{hasWithdrawalPin ? 'Change Withdrawal PIN' : 'Set Withdrawal PIN'}</DialogTitle>
              <DialogDescription>
                {hasWithdrawalPin
                  ? 'Set a new withdrawal PIN or keep your current one'
                  : 'Set a 4-digit PIN for secure withdrawals'}
              </DialogDescription>
            </DialogHeader>

            <div className='space-y-4'>
              {hasWithdrawalPin && (
                <div className='relative'>
                  <label className='text-xs font-medium block mb-1'>Current PIN</label>
                  <Input
                    type={showCurrentPin ? 'text' : 'password'}
                    inputMode='numeric'
                    pattern='[0-9]*'
                    maxLength={4}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder='Current PIN'
                  />
                  <button
                    type='button'
                    onClick={() => setShowCurrentPin(!showCurrentPin)}
                    className='absolute right-3 top-8 text-muted-foreground hover:text-foreground'
                  >
                    {showCurrentPin ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                  </button>
                </div>
              )}

              <div className='relative'>
                <label className='text-xs font-medium block mb-1'>New PIN</label>
                <Input
                  type={showNewPin ? 'text' : 'password'}
                  inputMode='numeric'
                  pattern='[0-9]*'
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder='4-digit PIN'
                />
                <button
                  type='button'
                  onClick={() => setShowNewPin(!showNewPin)}
                  className='absolute right-3 top-8 text-muted-foreground hover:text-foreground'
                >
                  {showNewPin ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                </button>
              </div>

              <div className='relative'>
                <label className='text-xs font-medium block mb-1'>Confirm PIN</label>
                <Input
                  type={showConfirmNewPin ? 'text' : 'password'}
                  inputMode='numeric'
                  pattern='[0-9]*'
                  maxLength={4}
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder='Confirm PIN'
                />
                <button
                  type='button'
                  onClick={() => setShowConfirmNewPin(!showConfirmNewPin)}
                  className='absolute right-3 top-8 text-muted-foreground hover:text-foreground'
                >
                  {showConfirmNewPin ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                </button>
              </div>
            </div>

            <DialogFooter className='gap-2'>
              <Button variant='outline' onClick={() => setActiveWalletView('menu')} disabled={pinLoading}>
                Back
              </Button>
              <Button onClick={handleSetWithdrawalPin} disabled={pinLoading}>
                {pinLoading ? 'Saving...' : 'Save PIN'}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* WITHDRAWAL VIEW */}
        {activeWalletView === 'withdraw' && (
          <>
            <DialogHeader>
              <DialogTitle>Request Withdrawal</DialogTitle>
              <DialogDescription>Withdraw your earnings to your bank account</DialogDescription>
            </DialogHeader>

            <div className='space-y-4 max-h-96 overflow-y-auto'>
              {!hasWithdrawalPin && (
                <div className='rounded-lg bg-yellow-50 dark:bg-yellow-950 p-3 border border-yellow-200 dark:border-yellow-800'>
                  <p className='text-sm font-medium text-yellow-800 dark:text-yellow-200'>
                    Set your withdrawal PIN first
                  </p>
                  <p className='text-xs text-yellow-700 dark:text-yellow-300 mt-1'>
                    You must set a 4-digit PIN before you can withdraw funds.
                  </p>
                  <Button
                    size='sm'
                    variant='outline'
                    className='mt-2 w-full'
                    onClick={() => setActiveWalletView('pin')}
                  >
                    Set PIN
                  </Button>
                </div>
              )}

              {hasWithdrawalPin && (
                <>
                  <div className='rounded-lg border p-3 bg-accent/5'>
                    <p className='text-xs text-muted-foreground'>Available Balance</p>
                    <p className='text-lg font-semibold'>{formattedWalletBalance}</p>
                  </div>

                  <div>
                    <label className='text-xs font-medium'>Amount</label>
                    <Input
                      type='number'
                      min='1'
                      step='0.01'
                      inputMode='decimal'
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder='Withdrawal amount'
                    />
                  </div>

                  <div>
                    <label className='text-xs font-medium'>Bank Name</label>
                    <Input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder='e.g., GTBank'
                    />
                  </div>

                  <div>
                    <label className='text-xs font-medium'>Account Number</label>
                    <Input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder='10-digit account number'
                    />
                  </div>

                  <div>
                    <label className='text-xs font-medium'>Account Name</label>
                    <Input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder='Account holder name'
                    />
                  </div>

                  <div className='relative'>
                    <label className='text-xs font-medium block mb-1'>Withdrawal PIN</label>
                    <Input
                      type={showWithdrawalPin ? 'text' : 'password'}
                      inputMode='numeric'
                      pattern='[0-9]*'
                      maxLength={4}
                      value={withdrawalPin}
                      onChange={(e) => setWithdrawalPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder='Enter PIN'
                    />
                    <button
                      type='button'
                      onClick={() => setShowWithdrawalPin(!showWithdrawalPin)}
                      className='absolute right-3 top-8 text-muted-foreground hover:text-foreground'
                    >
                      {showWithdrawalPin ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                    </button>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className='gap-2'>
              <Button
                variant='outline'
                onClick={() => setActiveWalletView('menu')}
                disabled={withdrawLoading || pinLoading}
              >
                Back
              </Button>
              {hasWithdrawalPin && (
                <Button onClick={handleWithdraw} disabled={withdrawLoading}>
                  {withdrawLoading ? 'Processing...' : 'Request Withdrawal'}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
