import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { requireRoles } from '@/lib/server-route-auth'
import mongoose from 'mongoose'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'

export async function GET(request: NextRequest) {
  const { response } = await requireRoles(request, ['admin'])
  if (response) return response

  try {
    await connectToDatabase()

    const orders = await Order.find({
      paymentStatus: 'escrow',
      $or: [
        { disputeStatus: 'active' },
        { disputeRaisedAt: { $ne: null } },
      ],
    })
      .sort({ disputeRaisedAt: -1, createdAt: -1 })
      .limit(100)
      .lean()

    return NextResponse.json({ success: true, orders })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch disputed escrow orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireRoles(request, ['admin'])
  if (response || !user) return response || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || 'claim').trim().toLowerCase()
    const orderId = String(body?.orderId || '').trim()

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 })
    }

    await connectToDatabase()

    const existing = await Order.findOne({ orderId }).lean()
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const paymentStatus = String((existing as any)?.paymentStatus || '').toLowerCase()
    const isEscrow = paymentStatus === 'escrow' || paymentStatus === 'disputed'
    const isDisputed = String((existing as any)?.disputeStatus || '').toLowerCase() === 'active'
      || Boolean((existing as any)?.disputeRaisedAt)

    if (!isEscrow || !isDisputed) {
      return NextResponse.json(
        { success: false, error: 'Only disputed escrow orders can be claimed' },
        { status: 400 }
      )
    }

    const claimedById = String((existing as any)?.disputeClaimedById || '').trim()

    if (action === 'refund') {
      if (claimedById && claimedById !== user.id) {
        return NextResponse.json(
          { success: false, error: 'This dispute is claimed by another admin' },
          { status: 409 }
        )
      }

      const refundAmount = Math.round(Number((existing as any)?.totalAmount || 0) * 100) / 100
      if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        return NextResponse.json({ success: false, error: 'Invalid refund amount' }, { status: 400 })
      }

      const refundReference = `escrow_refund_${orderId}`
      const session = await mongoose.startSession()

      try {
        let alreadyRefunded = false

        await session.withTransaction(async () => {
          const orderInTxn: any = await Order.findOne({ orderId }).session(session)
          if (!orderInTxn) {
            throw new Error('Order not found')
          }

          const orderPaymentStatus = String(orderInTxn.paymentStatus || '').toLowerCase() as 'escrow' | 'disputed' | 'refunded';
          const orderDisputed = String(orderInTxn.disputeStatus || '').toLowerCase() === 'active' || Boolean(orderInTxn.disputeRaisedAt)
          if (!(orderPaymentStatus === 'escrow' || orderPaymentStatus === 'disputed' || orderPaymentStatus === 'refunded') || !orderDisputed) {
            throw new Error('Only disputed escrow orders can be refunded')
          }

          if (orderPaymentStatus === 'refunded') {
            alreadyRefunded = true
            return
          }

          const refundTxResult = await WalletTransaction.updateOne(
            { reference: refundReference },
            {
              $setOnInsert: {
                userId: String(orderInTxn.customerId || ''),
                type: 'topup',
                amount: refundAmount,
                status: 'completed',
                reference: refundReference,
                paymentReference: String(orderInTxn.paymentReference || refundReference),
                provider: 'escrow_refund',
                note: `Escrow refund for order ${orderId}`,
                metadata: {
                  source: 'admin_dispute_refund',
                  orderId,
                  refundedByAdminId: user.id,
                  refundedByAdminEmail: user.email,
                },
                orderId,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
            { upsert: true, session }
          )

          const inserted = Number((refundTxResult as any)?.upsertedCount || 0) > 0
          if (!inserted) {
            alreadyRefunded = true
            return
          }

          const customerUpdate = await User.updateOne(
            { _id: String(orderInTxn.customerId || '') },
            {
              $inc: { walletBalance: refundAmount },
              $set: { updatedAt: new Date() },
            },
            { session }
          )

          if (customerUpdate.modifiedCount === 0) {
            throw new Error('Failed to credit customer wallet')
          }

          await Order.updateOne(
            { orderId },
            {
              $set: {
                paymentStatus: 'refunded',
                status: 'refunded',
                disputeStatus: 'resolved',
                refundedAt: new Date(),
                refundedByAdminId: user.id,
                refundedByAdminEmail: user.email,
                updatedAt: new Date(),
              },
            },
            { session }
          )
        })

        if (alreadyRefunded) {
          return NextResponse.json({ success: true, message: 'Order already refunded' })
        }

        return NextResponse.json({ success: true, message: 'Refund initiated and customer wallet credited' })
      } finally {
        await session.endSession()
      }
    }
    if (claimedById && claimedById !== user.id) {
      return NextResponse.json(
        { success: false, error: 'This dispute is already claimed by another admin' },
        { status: 409 }
      )
    }

    if (claimedById === user.id) {
      return NextResponse.json({ success: true, message: 'Already claimed by you' })
    }

    const claimResult = await Order.updateOne(
      {
        orderId,
        paymentStatus: 'escrow',
        $and: [
          {
            $or: [
              { disputeStatus: 'active' },
              { disputeRaisedAt: { $ne: null } },
            ],
          },
          {
            $or: [
              { disputeClaimedById: { $exists: false } },
              { disputeClaimedById: null },
              { disputeClaimedById: '' },
            ],
          },
        ],
      },
      {
        $set: {
          disputeClaimedById: user.id,
          disputeClaimedByEmail: user.email,
          disputeClaimedByName: user.name || user.email,
          disputeClaimedAt: new Date(),
        },
      }
    )

    if (claimResult.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Unable to claim dispute. It may already be claimed.' },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, message: 'Dispute claimed successfully' })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to claim dispute' },
      { status: 500 }
    )
  }
}
