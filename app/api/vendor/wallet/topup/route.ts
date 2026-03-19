import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { xoroPayService } from '@/lib/xoro-pay'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { connectToDatabase } from '@/lib/mongodb'
import { calculateTopupAmounts } from '@/lib/topup-fee'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
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
    const sessionToken = cookieStore.get('sessionToken')?.value || request.headers.get('X-Session-Token')

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
    const appBaseUrl = requestOrigin || process.env.NEXT_PUBLIC_APP_URL || 'https://www.makeitsell.org'
    const callbackUrl = `${appBaseUrl}/api/vendor/wallet/topup/callback`

    const paymentResult = await xoroPayService.initializePayment({
      email: currentUser.email,
      amount: payableAmount,
      reference,
      callbackUrl,
      metadata: {
        orderId: reference,
        customerId: String(currentUser.id),
        walletCreditAmount,
        topupFeeAmount: feeAmount,
        payableAmount,
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
        type: 'vendor_wallet_topup',
      },
    })

    if (!paymentResult.success || !paymentResult.authorizationUrl || !paymentResult.reference) {
      const providerError = paymentResult.raw?.message
        || paymentResult.raw?.error
        || paymentResult.raw?.detail
        || paymentResult.raw?.details
      return NextResponse.json(
        {
          success: false,
          error: paymentResult.message || providerError || 'Failed to initialize wallet top-up',
          provider: 'xoro_pay',
          details: paymentResult.raw || null,
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
      paymentReference: paymentResult.reference,
      provider: 'xoro_pay',
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
        authorization_url: paymentResult.authorizationUrl,
        reference,
        paymentReference: paymentResult.reference,
        walletCreditAmount,
        feeAmount,
        payableAmount,
      },
      { status: 200 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to top up vendor wallet' },
      { status: 500 }
    )
  }
}
