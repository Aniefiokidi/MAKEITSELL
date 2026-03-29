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
      key: 'vendor-wallet-pin-set',
      maxRequests: 10,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const { newPin, confirmNewPin, currentPin } = body
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await getUserBySessionToken(sessionToken)
    if (!currentUser || currentUser.role !== 'vendor') {
      return NextResponse.json(
        { success: false, error: 'Only vendors can set withdrawal PIN' },
        { status: 403 }
      )
    }

    // Validate new PIN
    if (!/^\d{4}$/.test(newPin || '')) {
      return NextResponse.json(
        { success: false, error: 'PIN must be exactly 4 digits' },
        { status: 400 }
      )
    }

    if (newPin !== confirmNewPin) {
      return NextResponse.json(
        { success: false, error: 'PIN confirmation does not match' },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const userForPin = await User.findById(currentUser.id).select('withdrawalPinHash').lean()

    // If user already has PIN, require current PIN to change it
    if (userForPin?.withdrawalPinHash) {
      if (!currentPin || !/^\d{4}$/.test(currentPin)) {
        return NextResponse.json(
          { success: false, error: 'Enter your current 4-digit PIN to change it' },
          { status: 400 }
        )
      }

      const currentPinHash = hashWithdrawalPin(currentPin, String(currentUser.id))
      if (userForPin.withdrawalPinHash !== currentPinHash) {
        return NextResponse.json(
          { success: false, error: 'Incorrect current PIN' },
          { status: 401 }
        )
      }
    }

    const newPinHash = hashWithdrawalPin(newPin, String(currentUser.id))

    const result = await User.updateOne(
      { _id: currentUser.id },
      {
        $set: {
          withdrawalPinHash: newPinHash,
          withdrawalPinSetAt: new Date(),
          updatedAt: new Date(),
        },
      }
    )

    if (result.modifiedCount > 0) {
      return NextResponse.json({
        success: true,
        message: userForPin?.withdrawalPinHash ? 'PIN changed successfully' : 'PIN set successfully',
      })
    }

    return NextResponse.json(
      { success: false, error: 'Failed to set PIN' },
      { status: 500 }
    )
  } catch (error) {
    console.error('[vendor/wallet/pin/set] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to set PIN' },
      { status: 500 }
    )
  }
}
