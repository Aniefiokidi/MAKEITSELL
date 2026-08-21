// Shared wallet top-up initiation — extracted from app/api/wallet/topup/route.ts (customer)
// and app/api/vendor/wallet/topup/route.ts (vendor), which were already near byte-identical
// (same calculateTopupAmounts call, same paystackService.initializePayment shape — only the
// reference prefix, callback URL, and item title differed). Unlike the withdrawal routes,
// nothing here was previously extracted/shipped, so unifying carries no regression risk to
// already-tested code — it's a clean consolidation, not a refactor of proven logic.
//
// Both web routes AND the new WhatsApp top-up commands (lib/whatsapp/wallet-topup.ts) call
// this — the actual crediting happens in the existing, UNCHANGED callback routes
// (app/api/{,vendor/}wallet/topup/callback/route.ts) once Paystack redirects back, exactly
// the same way regardless of which channel initiated the payment link.
import { paystackService } from '@/lib/payment'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { connectToDatabase } from '@/lib/mongodb'
import { calculateTopupAmounts } from '@/lib/topup-fee'
import crypto from 'crypto'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

export type InitiateWalletTopupParams = {
  userId: string
  email: string
  role: 'customer' | 'vendor'
  amount: number
  requestOrigin?: string
}

export type InitiateWalletTopupResult =
  | {
      success: true
      authorization_url: string
      reference: string
      walletCreditAmount: number
      feeAmount: number
      payableAmount: number
    }
  | { success: false; error: string }

export async function initiateWalletTopup(params: InitiateWalletTopupParams): Promise<InitiateWalletTopupResult> {
  const { userId, email, role } = params
  const requestedAmount = Math.round(Number(params.amount) * 100) / 100

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return { success: false, error: 'Amount must be a valid number greater than zero' }
  }
  if (requestedAmount > 10000000) {
    return { success: false, error: 'Amount exceeds maximum allowed value' }
  }

  const { walletCreditAmount, feeAmount, payableAmount } = calculateTopupAmounts(requestedAmount)
  if (walletCreditAmount <= 0 || payableAmount <= 0) {
    return { success: false, error: 'Amount must be greater than zero' }
  }

  await connectToDatabase()

  const isVendor = role === 'vendor'
  const reference = `${isVendor ? 'vendor_' : ''}wallet_topup_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
  const appBaseUrl = getCanonicalAppBaseUrl(params.requestOrigin)
  const callbackUrl = `${appBaseUrl}/api/${isVendor ? 'vendor/' : ''}wallet/topup/callback`

  const paymentResult = await paystackService.initializePayment({
    email,
    amount: payableAmount,
    orderId: reference,
    customerId: String(userId),
    items: [
      {
        productId: isVendor ? 'vendor-wallet-topup' : 'wallet-topup',
        title: isVendor ? 'Vendor Wallet Top Up' : 'Wallet Top Up',
        quantity: 1,
        price: walletCreditAmount,
        vendorId: 'makeitsell',
        vendorName: 'Make It Sell',
      },
    ],
    callbackUrl,
  })

  if (!paymentResult.success || !paymentResult.authUrl) {
    const providerError = paymentResult?.data?.message || paymentResult?.message
    return { success: false, error: paymentResult.message || providerError || 'Failed to initialize wallet top-up' }
  }

  await WalletTransaction.create({
    userId: String(userId),
    type: 'topup',
    amount: walletCreditAmount,
    status: 'pending',
    reference,
    paymentReference: String(paymentResult.data?.reference || reference),
    provider: 'paystack',
    metadata: {
      customerEmail: email,
      walletCreditAmount,
      topupFeeAmount: feeAmount,
      payableAmount,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return {
    success: true,
    authorization_url: paymentResult.authUrl,
    reference,
    walletCreditAmount,
    feeAmount,
    payableAmount,
  }
}
