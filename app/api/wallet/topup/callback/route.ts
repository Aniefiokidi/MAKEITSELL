import { NextRequest, NextResponse } from 'next/server'
import { xoroPayService } from '@/lib/xoro-pay'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { User } from '@/lib/models/User'
import { connectToDatabase } from '@/lib/mongodb'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const paymentReference = searchParams.get('reference')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.makeitsell.org'
    const successRedirect = new URL('/stores', appUrl)
    const errorRedirect = new URL('/stores', appUrl)

    if (!paymentReference) {
      errorRedirect.searchParams.set('wallet', 'failed')
      errorRedirect.searchParams.set('reason', 'missing_reference')
      return NextResponse.redirect(errorRedirect.toString())
    }

    const verificationResult = await xoroPayService.verifyPayment(paymentReference)
    if (!verificationResult.success) {
      errorRedirect.searchParams.set('wallet', 'failed')
      errorRedirect.searchParams.set('reason', 'verification_failed')
      return NextResponse.redirect(errorRedirect.toString())
    }

    const paymentData = verificationResult.raw || {}
    const metadata = verificationResult.metadata || {}
    const orderIdFromMeta = metadata?.orderId || metadata?.orderID

    await connectToDatabase()

    const transaction = await WalletTransaction.findOne({
      $or: [{ paymentReference }, { reference: orderIdFromMeta }],
      type: 'topup',
    })

    if (!transaction) {
      errorRedirect.searchParams.set('wallet', 'failed')
      errorRedirect.searchParams.set('reason', 'transaction_not_found')
      return NextResponse.redirect(errorRedirect.toString())
    }

    if (transaction.status === 'completed') {
      successRedirect.searchParams.set('wallet', 'success')
      return NextResponse.redirect(successRedirect.toString())
    }

    const completeUpdate = await WalletTransaction.updateOne(
      { _id: transaction._id, status: 'pending' },
      {
        $set: {
          status: 'completed',
          paymentReference,
          metadata: {
            ...(transaction.metadata || {}),
            xoroPayData: paymentData,
          },
          updatedAt: new Date(),
        },
      }
    )

    if (completeUpdate.modifiedCount > 0) {
      const userIdObject = mongoose.Types.ObjectId.isValid(transaction.userId)
        ? new mongoose.Types.ObjectId(transaction.userId)
        : transaction.userId
      
      await User.updateOne(
        { _id: userIdObject, role: 'customer' },
        {
          $inc: { walletBalance: transaction.amount },
          $set: { updatedAt: new Date() },
        }
      )
    }

    successRedirect.searchParams.set('wallet', 'success')
    return NextResponse.redirect(successRedirect.toString())
  } catch (error) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.makeitsell.org'
    const errorRedirect = new URL('/stores', appUrl)
    errorRedirect.searchParams.set('wallet', 'failed')
    errorRedirect.searchParams.set('reason', 'server_error')
    return NextResponse.redirect(errorRedirect.toString())
  }
}
