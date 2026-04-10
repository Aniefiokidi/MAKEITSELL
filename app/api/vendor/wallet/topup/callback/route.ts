import { NextRequest, NextResponse } from 'next/server'
import { xoroPayService } from '@/lib/xoro-pay'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { User } from '@/lib/models/User'
import { connectToDatabase } from '@/lib/mongodb'
import mongoose from 'mongoose'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const referencesFromQuery = Array.from(
      new Set(
        [
          searchParams.get('reference'),
          searchParams.get('trxref'),
          searchParams.get('tx_ref'),
          searchParams.get('payment_reference'),
          searchParams.get('paymentReference'),
          searchParams.get('transaction_reference'),
          searchParams.get('transactionReference'),
          searchParams.get('transaction_id'),
          searchParams.get('transactionId'),
          searchParams.get('orderId'),
          searchParams.get('orderID'),
        ].filter((value): value is string => Boolean(value))
      )
    )

    const appUrl = getCanonicalAppBaseUrl()
    const successRedirect = new URL('/stores', appUrl)
    const errorRedirect = new URL('/stores', appUrl)

    if (referencesFromQuery.length === 0) {
      errorRedirect.searchParams.set('wallet', 'failed')
      errorRedirect.searchParams.set('reason', 'missing_reference')
      return NextResponse.redirect(errorRedirect.toString())
    }

    let verificationResult: Awaited<ReturnType<typeof xoroPayService.verifyPayment>> | null = null
    for (const reference of referencesFromQuery) {
      const attempt = await xoroPayService.verifyPayment(reference)
      if (attempt.success) {
        verificationResult = attempt
        break
      }
      if (!verificationResult) {
        verificationResult = attempt
      }
    }

    if (!verificationResult) {
      errorRedirect.searchParams.set('wallet', 'failed')
      errorRedirect.searchParams.set('reason', 'verification_failed')
      return NextResponse.redirect(errorRedirect.toString())
    }

    if (!verificationResult.success) {
      errorRedirect.searchParams.set('wallet', 'failed')
      errorRedirect.searchParams.set('reason', 'verification_failed')
      return NextResponse.redirect(errorRedirect.toString())
    }

    const paymentData = verificationResult.raw || {}
    const metadata = verificationResult.metadata || {}
    const orderIdFromMeta = metadata?.orderId || metadata?.orderID
    const resolvedReference = verificationResult.reference || referencesFromQuery[0]

    await connectToDatabase()

    const referenceMatchers = Array.from(
      new Set(
        [
          ...referencesFromQuery,
          resolvedReference,
          orderIdFromMeta,
        ].filter((value): value is string => Boolean(value))
      )
    )

    const transaction = await WalletTransaction.findOne({
      $or: [
        { paymentReference: { $in: referenceMatchers } },
        { reference: { $in: referenceMatchers } },
      ],
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
          paymentReference: resolvedReference,
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
        { _id: userIdObject, role: 'vendor' },
        {
          $inc: { walletBalance: transaction.amount },
          $set: { updatedAt: new Date() },
        }
      )
    }

    successRedirect.searchParams.set('wallet', 'success')
    return NextResponse.redirect(successRedirect.toString())
  } catch (error) {
    const appUrl = getCanonicalAppBaseUrl()
    const errorRedirect = new URL('/stores', appUrl)
    errorRedirect.searchParams.set('wallet', 'failed')
    errorRedirect.searchParams.set('reason', 'server_error')
    return NextResponse.redirect(errorRedirect.toString())
  }
}
