import { NextRequest, NextResponse } from 'next/server'
import { paystackService } from '@/lib/payment'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { User } from '@/lib/models/User'
import { connectToDatabase } from '@/lib/mongodb'

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

    const verificationResult = await paystackService.verifyPayment(paymentReference)
    if (!verificationResult.success || !verificationResult.data) {
      errorRedirect.searchParams.set('wallet', 'failed')
      errorRedirect.searchParams.set('reason', 'verification_failed')
      return NextResponse.redirect(errorRedirect.toString())
    }

    const paymentData = verificationResult.data
    const orderIdFromMeta = paymentData?.metadata?.orderId || paymentData?.metadata?.orderID

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
            paystackData: paymentData,
          },
          updatedAt: new Date(),
        },
      }
    )

    if (completeUpdate.modifiedCount > 0) {
      await User.updateOne(
        { _id: transaction.userId, role: 'vendor' },
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
