import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/request-security'
import { verifyWithdrawalPin, processCustomerWithdrawal, clearWhatsAppWithdrawalLockoutForCustomer } from '@/lib/customer-withdrawal'

export async function POST(request: NextRequest) {
  try {
    const originCheck = enforceSameOrigin(request)
    if (originCheck) return originCheck

    const rateLimitResponse = await enforceRateLimit(request, {
      key: 'wallet-withdraw',
      maxRequests: 8,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const amount = Number(body?.amount)
    const bankName = String(body?.bankName || '').trim()
    const bankCode = String(body?.bankCode || '').trim()
    const accountNumber = String(body?.accountNumber || '').trim()
    const accountName = String(body?.accountName || '').trim()
    const withdrawalPin = String(body?.withdrawalPin || '').trim()

    if (!/^\d{4}$/.test(withdrawalPin)) {
      return NextResponse.json(
        { success: false, error: 'Valid 4-digit withdrawal PIN is required' },
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

    if (currentUser.role !== 'customer') {
      return NextResponse.json({ success: false, error: 'Only customers can withdraw' }, { status: 403 })
    }

    const pinCheck = await verifyWithdrawalPin(currentUser.id, withdrawalPin)
    if (!pinCheck.hasPinSet) {
      return NextResponse.json(
        { success: false, error: 'Set your 4-digit withdrawal PIN before requesting withdrawal' },
        { status: 400 }
      )
    }
    if (!pinCheck.valid) {
      return NextResponse.json({ success: false, error: 'Incorrect withdrawal PIN' }, { status: 400 })
    }

    // Proving the PIN here — an authenticated web session, a second factor beyond
    // whatever's happening on WhatsApp — is the recovery path out of a WhatsApp PIN
    // lockout (lib/whatsapp/customer-withdrawal.ts).
    await clearWhatsAppWithdrawalLockoutForCustomer(currentUser.id)

    const result = await processCustomerWithdrawal({
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
      balance: result.newBalance,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to create withdrawal request' },
      { status: 500 }
    )
  }
}
