import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { paystackService } from '@/lib/payment'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { connectToDatabase } from '@/lib/mongodb'
import { calculateTopupAmounts } from '@/lib/topup-fee'
import crypto from 'crypto'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/request-security'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

export async function POST(request: NextRequest) {
  try {
    const originCheck = enforceSameOrigin(request)
    if (originCheck) return originCheck

    const rateLimitResponse = enforceRateLimit(request, {
      key: 'vendor-wallet-topup',
      maxRequests: 12,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const rawAmount = Number(body?.amount)

    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be a valid number greater than zero' },
        { status: 400 }
      )
    }

    const requestedAmount = Math.round(rawAmount * 100) / 100
    if (requestedAmount > 10000000) {
      return NextResponse.json(
        { success: false, error: 'Amount exceeds maximum allowed value' },
        { status: 400 }
      )
    }

    const { walletCreditAmount, feeAmount, payableAmount } = calculateTopupAmounts(requestedAmount)
    if (walletCreditAmount <= 0 || payableAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than zero' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await getUserBySessionToken(sessionToken)
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== 'vendor') {
      return NextResponse.json(
        { success: false, error: 'Only vendors can top up wallet here' },
        { status: 403 }
      )
    }

    await connectToDatabase()

    const reference = `vendor_wallet_topup_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
    const requestOrigin = request.nextUrl?.origin || ''
    const appBaseUrl = getCanonicalAppBaseUrl(requestOrigin)
    const callbackUrl = `${appBaseUrl}/api/vendor/wallet/topup/callback`

    const paymentResult = await paystackService.initializePayment({
      email: currentUser.email,
      amount: payableAmount,
      orderId: reference,
      customerId: String(currentUser.id),
      items: [
        {
          productId: 'vendor-wallet-topup',
          title: 'Vendor Wallet Top Up',
          quantity: 1,
          price: walletCreditAmount,
          vendorId: 'makeitsell',
          vendorName: 'Make It Sell',
        },
      ],
      callbackUrl,
    })

    if (!paymentResult.success || !paymentResult.authUrl) {
      const providerError = paymentResult?.data?.message
        || paymentResult?.message
      return NextResponse.json(
        {
          success: false,
          error: paymentResult.message || providerError || 'Failed to initialize wallet top-up',
          provider: 'paystack',
        },
        { status: 400 }
      )
    }

    await WalletTransaction.create({
      userId: String(currentUser.id),
      type: 'topup',
      amount: walletCreditAmount,
      status: 'pending',
      reference,
      paymentReference: String(paymentResult.data?.reference || reference),
      provider: 'paystack',
      metadata: {
        customerEmail: currentUser.email,
        walletCreditAmount,
        topupFeeAmount: feeAmount,
        payableAmount,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Vendor wallet top-up initialized',
        authorization_url: paymentResult.authUrl,
        reference,
        paymentReference: String(paymentResult.data?.reference || reference),
        walletCreditAmount,
        feeAmount,
        payableAmount,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('app/api/vendor/wallet/topup/route.ts error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to top up vendor wallet' },
      { status: 500 }
    )
  }
}
