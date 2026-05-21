import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { logisticsEmailAllowedForRegion, resolveLogisticsRegion } from '@/lib/logistics-access'

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const region = resolveLogisticsRegion(request.nextUrl.searchParams.get('region'))

    if (!logisticsEmailAllowedForRegion(sessionUser.email, region)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectToDatabase()

    const logisticsUser = await User.findOne({
      email: { $regex: new RegExp(`^${region.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).lean()

    if (!logisticsUser) {
      return NextResponse.json({ success: false, error: 'Logistics user account not found' }, { status: 404 })
    }

    const userId = String((logisticsUser as any)._id)
    const walletBalance = Number((logisticsUser as any).walletBalance || 0)

    const transactions = await WalletTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()

    const txData = (transactions as any[]).map(tx => ({
      id: String(tx._id),
      type: tx.type,
      amount: Number(tx.amount || 0),
      status: tx.status,
      reference: tx.reference,
      note: tx.note || '',
      orderId: tx.orderId || '',
      createdAt: tx.createdAt,
      direction: tx.type === 'logistics_delivery_credit' ? 'credit' : 'debit',
    }))

    return NextResponse.json({
      success: true,
      walletBalance,
      transactions: txData,
      region: region.key,
      cityLabel: region.cityLabel,
    })
  } catch (error: any) {
    console.error('[logistics-wallet] GET error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Failed to fetch wallet' }, { status: 500 })
  }
}
