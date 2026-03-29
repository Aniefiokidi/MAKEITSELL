import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await getUserBySessionToken(sessionToken)
    if (!currentUser || currentUser.role !== 'vendor') {
      return NextResponse.json(
        { success: false, error: 'Only vendors can access this endpoint' },
        { status: 403 }
      )
    }

    await connectToDatabase()
    const userForPin = await User.findById(currentUser.id).select('withdrawalPinHash').lean()

    return NextResponse.json({
      success: true,
      hasWithdrawalPin: !!userForPin?.withdrawalPinHash,
    })
  } catch (error) {
    console.error('[vendor/wallet/pin/status] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check PIN status' },
      { status: 500 }
    )
  }
}
