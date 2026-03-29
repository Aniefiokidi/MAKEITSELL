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
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== 'customer') {
      return NextResponse.json({ success: false, error: 'Only customers have withdrawal PIN' }, { status: 403 })
    }

    await connectToDatabase()
    const user = await User.findOne({ _id: currentUser.id }, { withdrawalPinHash: 1 })

    return NextResponse.json({
      success: true,
      hasWithdrawalPin: !!user?.withdrawalPinHash,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch withdrawal PIN status' },
      { status: 500 }
    )
  }
}
