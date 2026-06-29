import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'

export function calcWithdrawalBreakdown(
  amount: number,
  earnedBalance: number,
  depositedBalance: number,
  prizeBalance: number
) {
  const withdrawFromDeposited = Math.min(depositedBalance, amount)
  let remaining = amount - withdrawFromDeposited

  const withdrawFromPrize = Math.min(prizeBalance, remaining)
  remaining = remaining - withdrawFromPrize

  const withdrawFromEarned = remaining
  const commission = Math.round(withdrawFromEarned * 0.05 * 100) / 100
  const vendorReceives = Math.round((amount - commission) * 100) / 100

  return {
    withdrawFromDeposited,
    withdrawFromPrize,
    withdrawFromEarned,
    commission,
    vendorReceives,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawAmount = Number(searchParams.get('amount'))

    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 })
    }

    const amount = Math.round(rawAmount * 100) / 100

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value
    if (!sessionToken) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const currentUser = await getUserBySessionToken(sessionToken)
    if (!currentUser || currentUser.role !== 'vendor') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    await connectToDatabase()
    const user = await User.findById(currentUser.id)
      .select('walletBalance earnedBalance depositedBalance prizeBalance')
      .lean() as any

    const walletBalance = Number(user?.walletBalance || 0)
    const earnedBalance = Number(user?.earnedBalance || 0)
    const depositedBalance = Number(user?.depositedBalance || 0)
    const prizeBalance = Number(user?.prizeBalance || 0)

    if (walletBalance < amount) {
      return NextResponse.json(
        { success: false, error: 'Insufficient wallet balance' },
        { status: 400 }
      )
    }

    const breakdown = calcWithdrawalBreakdown(amount, earnedBalance, depositedBalance, prizeBalance)

    return NextResponse.json({
      success: true,
      amount,
      walletBalance,
      earnedBalance,
      depositedBalance,
      prizeBalance,
      ...breakdown,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Preview failed' }, { status: 500 })
  }
}
