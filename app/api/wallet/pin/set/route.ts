import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import crypto from 'crypto'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/request-security'

const hashWithdrawalPin = (pin: string, userId: string) => {
  return crypto.createHash('sha256').update(`${pin}:${userId}`).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const originCheck = enforceSameOrigin(request)
    if (originCheck) return originCheck

    const rateLimitResponse = enforceRateLimit(request, {
      key: 'wallet-pin-set',
      maxRequests: 10,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const pin = String(body?.pin || '').trim()
    const currentPin = String(body?.currentPin || '').trim()

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: 'Withdrawal PIN must be exactly 4 digits' },
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
      return NextResponse.json({ success: false, error: 'Only customers can set withdrawal PIN' }, { status: 403 })
    }

    await connectToDatabase()
    const user = await User.findOne({ _id: currentUser.id }, { withdrawalPinHash: 1 })
    if (!user) {
      return NextResponse.json({ success: false, error: 'Customer account not found' }, { status: 404 })
    }

    if (user.withdrawalPinHash) {
      if (!/^\d{4}$/.test(currentPin)) {
        return NextResponse.json(
          { success: false, error: 'Current withdrawal PIN is required to change PIN' },
          { status: 400 }
        )
      }

      const currentPinHash = hashWithdrawalPin(currentPin, String(currentUser.id))
      if (user.withdrawalPinHash !== currentPinHash) {
        return NextResponse.json({ success: false, error: 'Current withdrawal PIN is incorrect' }, { status: 400 })
      }
    }

    const pinHash = hashWithdrawalPin(pin, String(currentUser.id))
    await User.updateOne(
      { _id: currentUser.id },
      {
        $set: {
          withdrawalPinHash: pinHash,
          withdrawalPinSetAt: new Date(),
          updatedAt: new Date(),
        },
      }
    )

    return NextResponse.json({
      success: true,
      message: user.withdrawalPinHash ? 'Withdrawal PIN updated successfully' : 'Withdrawal PIN set successfully',
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to set withdrawal PIN' },
      { status: 500 }
    )
  }
}
