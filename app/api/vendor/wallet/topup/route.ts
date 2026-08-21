import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/request-security'
import { initiateWalletTopup } from '@/lib/wallet-topup'

export async function POST(request: NextRequest) {
  try {
    const originCheck = enforceSameOrigin(request)
    if (originCheck) return originCheck

    const rateLimitResponse = await enforceRateLimit(request, {
      key: 'vendor-wallet-topup',
      maxRequests: 12,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const rawAmount = Number(body?.amount)

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

    const result = await initiateWalletTopup({
      userId: currentUser.id,
      email: currentUser.email,
      role: 'vendor',
      amount: rawAmount,
      requestOrigin: request.nextUrl?.origin || '',
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error, provider: 'paystack' }, { status: 400 })
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Vendor wallet top-up initialized',
        authorization_url: result.authorization_url,
        reference: result.reference,
        walletCreditAmount: result.walletCreditAmount,
        feeAmount: result.feeAmount,
        payableAmount: result.payableAmount,
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
