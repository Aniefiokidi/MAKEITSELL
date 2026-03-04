import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { Store } from '@/lib/models/Store'
import crypto from 'crypto'

const hashWithdrawalPin = (pin: string, userId: string) => {
  return crypto.createHash('sha256').update(`${pin}:${userId}`).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      amount,
      bankName,
      accountNumber,
      accountName,
      withdrawalPin,
    } = body

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('sessionToken')?.value || request.headers.get('X-Session-Token')

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

    // Validate inputs
    const normalizedAmount = Math.round(Number(amount) * 100) / 100
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid withdrawal amount' },
        { status: 400 }
      )
    }

    if (!bankName?.trim() || !accountName?.trim() || !accountNumber?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Enter bank name, account number and account name' },
        { status: 400 }
      )
    }

    if (!/^\d{4}$/.test(withdrawalPin?.trim() || '')) {
      return NextResponse.json(
        { success: false, error: 'Enter your 4-digit withdrawal PIN' },
        { status: 400 }
      )
    }

    await connectToDatabase()

    // Get user for PIN verification
    const userForPin = await User.findById(currentUser.id).select('withdrawalPinHash walletBalance').lean()

    if (!userForPin?.withdrawalPinHash) {
      return NextResponse.json(
        { success: false, error: 'Set your 4-digit withdrawal PIN before requesting withdrawal' },
        { status: 400 }
      )
    }

    // Verify PIN
    const providedPinHash = hashWithdrawalPin(withdrawalPin.trim(), String(currentUser.id))
    if (userForPin.withdrawalPinHash !== providedPinHash) {
      return NextResponse.json(
        { success: false, error: 'Incorrect withdrawal PIN' },
        { status: 401 }
      )
    }

    const store = await Store.findOne({ linkedWalletUserId: String(currentUser.id) })
      .sort({ createdAt: -1 })
      .select('_id walletBalance')
      .lean()

    const userBalance = typeof userForPin.walletBalance === 'number' ? userForPin.walletBalance : 0
    const storeBalance = typeof store?.walletBalance === 'number' ? store.walletBalance : 0
    const totalAvailable = userBalance + storeBalance

    if (totalAvailable < normalizedAmount) {
      return NextResponse.json(
        { success: false, error: 'Insufficient wallet balance for this withdrawal' },
        { status: 400 }
      )
    }

    const withdrawFromStore = Math.min(storeBalance, normalizedAmount)
    const withdrawFromUser = normalizedAmount - withdrawFromStore

    if (withdrawFromStore > 0 && store?._id) {
      await Store.updateOne(
        { _id: store._id, walletBalance: { $gte: withdrawFromStore } },
        {
          $inc: { walletBalance: -withdrawFromStore },
          $set: { updatedAt: new Date() },
        }
      )
    }

    if (withdrawFromUser > 0) {
      const updateResult = await User.updateOne(
        {
          _id: currentUser.id,
          walletBalance: { $gte: withdrawFromUser },
        },
        {
          $inc: { walletBalance: -withdrawFromUser },
          $set: { updatedAt: new Date() },
        }
      )

      if (updateResult.modifiedCount === 0) {
        return NextResponse.json(
          { success: false, error: 'Unable to process withdrawal right now. Please try again.' },
          { status: 400 }
        )
      }
    }

    // Create withdrawal request transaction
    const reference = `vendor_withdraw_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`

    await WalletTransaction.create({
      userId: String(currentUser.id),
      type: 'withdrawal',
      amount: normalizedAmount,
      status: 'pending',
      reference,
      provider: 'bank_transfer',
      note: `Vendor withdrawal to ${accountName} (${bankName})`,
      metadata: {
        bankName,
        accountNumber,
        accountName,
        vendorRole: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Fetch updated balance
    const [updatedUser, updatedStore] = await Promise.all([
      User.findById(currentUser.id).select('walletBalance').lean(),
      store?._id ? Store.findById(store._id).select('walletBalance').lean() : Promise.resolve(null),
    ])

    const updatedUserBalance = typeof updatedUser?.walletBalance === 'number' ? updatedUser.walletBalance : 0
    const updatedStoreBalance = typeof updatedStore?.walletBalance === 'number' ? updatedStore.walletBalance : 0
    const newBalance = updatedUserBalance + updatedStoreBalance

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request submitted',
      reference,
      newBalance,
      balance: newBalance,
      breakdown: {
        userBalance: updatedUserBalance,
        storeBalance: updatedStoreBalance,
      },
    })
  } catch (error: any) {
    console.error('[vendor/wallet/withdraw] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to process withdrawal' },
      { status: 500 }
    )
  }
}
