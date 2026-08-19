import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/request-security'
import { verifyWithdrawalPin, processVendorWithdrawal, clearWhatsAppWithdrawalLockout } from '@/lib/vendor-withdrawal'

export async function POST(request: NextRequest) {
  try {
    const originCheck = enforceSameOrigin(request)
    if (originCheck) return originCheck

    const rateLimitResponse = await enforceRateLimit(request, {
      key: 'vendor-wallet-withdraw',
      maxRequests: 8,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const {
      amount,
      bankName,
      bankCode,
      accountNumber,
      accountName,
      withdrawalPin,
    } = body

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await getUserBySessionToken(sessionToken)
    if (!currentUser || currentUser.role !== 'vendor') {
      return NextResponse.json(
        { success: false, error: 'Only vendors can withdraw' },
        { status: 403 }
      )
    }

    if (!/^\d{4}$/.test(String(withdrawalPin || '').trim())) {
      return NextResponse.json(
        { success: false, error: 'Enter your 4-digit withdrawal PIN' },
        { status: 400 }
      )
    }

    const pinCheck = await verifyWithdrawalPin(currentUser.id, withdrawalPin)
    if (!pinCheck.hasPinSet) {
      return NextResponse.json(
        { success: false, error: 'Set your 4-digit withdrawal PIN before requesting withdrawal' },
        { status: 400 }
      )
    }
    if (!pinCheck.valid) {
      return NextResponse.json(
        { success: false, error: 'Incorrect withdrawal PIN' },
        { status: 401 }
      )
    }

    // Proving the PIN here — an authenticated web session, a second factor beyond
    // whatever's happening on WhatsApp — is the recovery path out of a WhatsApp PIN
    // lockout (lib/whatsapp/vendor-withdrawal.ts). Cleared before the withdrawal itself
    // runs, so it takes effect even if the withdrawal fails for an unrelated reason
    // (insufficient Paystack balance, etc).
    await clearWhatsAppWithdrawalLockout(currentUser.id)

    const result = await processVendorWithdrawal({
      userId: currentUser.id,
      amount,
      bankName,
      bankCode,
      accountNumber,
      accountName,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      reference: result.reference,
      newBalance: result.newBalance,
      balance: result.newBalance,
      commissionBreakdown: result.commissionBreakdown,
    })
  } catch (error: any) {
    console.error('[vendor/wallet/withdraw] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process withdrawal' },
      { status: 500 }
    )
  }
}
