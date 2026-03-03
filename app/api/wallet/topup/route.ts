import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { paystackService } from '@/lib/payment'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { connectToDatabase } from '@/lib/mongodb'
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

    const amount = Math.round(rawAmount * 100) / 100
    if (amount > 10000000) {
      return NextResponse.json(
        { success: false, error: 'Amount exceeds maximum allowed value' },
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

    if (currentUser.role !== 'customer') {
      return NextResponse.json(
        { success: false, error: 'Only customers can top up wallet' },
        { status: 403 }
      )
    }

    await connectToDatabase()

    const reference = `wallet_topup_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.makeitsell.org'}/api/wallet/topup/callback`

    const paymentResult = await paystackService.initializePayment({
      email: currentUser.email,
      amount,
      orderId: reference,
      customerId: String(currentUser.id),
      callbackUrl,
      items: [
        {
          productId: 'wallet-topup',
          title: 'Wallet Top Up',
          quantity: 1,
          price: amount,
          vendorId: 'makeitsell',
          vendorName: 'Make It Sell',
        },
      ],
    })

    if (!paymentResult.success || !paymentResult.authUrl || !paymentResult.data?.reference) {
      return NextResponse.json(
        { success: false, error: paymentResult.message || 'Failed to initialize wallet top-up' },
        { status: 400 }
      )
    }

    await WalletTransaction.create({
      userId: String(currentUser.id),
      type: 'topup',
      amount,
      status: 'pending',
      reference,
      paymentReference: paymentResult.data.reference,
      provider: 'paystack',
      metadata: {
        customerEmail: currentUser.email,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Wallet top-up initialized',
        authorization_url: paymentResult.authUrl,
        reference,
        paymentReference: paymentResult.data.reference,
      },
      { status: 200 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to top up wallet' },
      { status: 500 }
    )
  }
}
