import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { Store } from '@/lib/models/Store'

const getDirection = (type: string) => {
  if (type === 'vendor_credit' || type === 'topup') return 'credit'
  if (type === 'withdrawal' || type === 'purchase_debit') return 'debit'
  return 'neutral'
}

export async function GET(request: NextRequest) {
  try {
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
      return NextResponse.json({ success: false, error: 'Only vendors can access this endpoint' }, { status: 403 })
    }

    await connectToDatabase()

    const transactions = await WalletTransaction.find({ userId: String(currentUser.id) })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    const store = await Store.findOne({ linkedWalletUserId: String(currentUser.id) })
      .sort({ createdAt: -1 })
      .select('walletBalance')
      .lean()

    const userBalance = typeof currentUser.walletBalance === 'number' ? currentUser.walletBalance : 0
    const storeBalance = typeof store?.walletBalance === 'number' ? store.walletBalance : 0
    const combinedBalance = userBalance + storeBalance

    const data = transactions.map((tx: any) => ({
      id: tx?._id?.toString?.() || '',
      type: tx.type,
      amount: Number(tx.amount || 0),
      status: tx.status,
      reference: tx.reference,
      note: tx.note || '',
      provider: tx.provider || '',
      orderId: tx.orderId || '',
      createdAt: tx.createdAt,
      direction: getDirection(String(tx.type || '')),
    }))

    return NextResponse.json({
      success: true,
      transactions: data,
      walletBalance: combinedBalance,
      breakdown: {
        userBalance,
        storeBalance,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch vendor wallet transactions' },
      { status: 500 }
    )
  }
}
