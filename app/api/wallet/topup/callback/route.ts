import { NextRequest, NextResponse } from 'next/server'
import { paystackService } from '@/lib/payment'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { User } from '@/lib/models/User'
import { connectToDatabase } from '@/lib/mongodb'
import mongoose from 'mongoose'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

const EXPLICIT_SUCCESS_STATUSES = new Set([
  'success',
  'successful',
  'succeeded',
  'completed',
  'complete',
  'paid',
  'approved',
])

const EXPLICIT_FAILURE_HINTS = new Set([
  'failed',
  'failure',
  'declined',
  'cancelled',
  'canceled',
  'abandoned',
  'expired',
])

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

    const appUrl = getCanonicalAppBaseUrl(new URL(request.url).origin)
    const successRedirect = new URL('/stores', appUrl)
    const errorRedirect = new URL('/stores', appUrl)
    const pendingRedirect = new URL('/stores', appUrl)
    pendingRedirect.searchParams.set('wallet', 'pending')
    pendingRedirect.searchParams.set('reason', 'awaiting_confirmation')

    const statusHint = String(
      searchParams.get('status')
      || searchParams.get('payment_status')
      || searchParams.get('paymentStatus')
      || ''
    ).toLowerCase()
    const successHints = new Set(['success', 'successful', 'completed', 'paid', 'true'])
    const failureHints = new Set(['failed', 'failure', 'declined', 'cancelled', 'canceled', 'abandoned', 'expired'])
    const querySuggestsSuccess = successHints.has(statusHint)
    const querySuggestsFailure = failureHints.has(statusHint)

    if (referencesFromQuery.length === 0) {
      errorRedirect.searchParams.set('wallet', 'failed')
      errorRedirect.searchParams.set('reason', 'missing_reference')
      return NextResponse.redirect(errorRedirect.toString())
    }

    let verificationResult: Awaited<ReturnType<typeof paystackService.verifyPayment>> | null = null
    for (const reference of referencesFromQuery) {
      try {
        const attempt = await paystackService.verifyPayment(reference)
        if (attempt.success) {
          verificationResult = attempt
          break
        }
        if (!verificationResult) {
          verificationResult = attempt
        }
      } catch {
        // Continue trying other references.
      }
    }

    const paymentData = verificationResult?.data || {}
    const metadata = paymentData?.metadata || {}
    const orderIdFromMeta = metadata?.orderId || metadata?.orderID
    const resolvedReference = String(paymentData?.reference || referencesFromQuery[0])

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

    if (querySuggestsFailure) {
      await WalletTransaction.updateOne(
        { _id: transaction._id, status: 'pending' },
        {
          $set: {
            status: 'failed',
            metadata: {
              ...(transaction.metadata || {}),
              callbackData: {
                statusHint,
                reason: 'provider_callback_failure_hint',
              },
            },
            updatedAt: new Date(),
          },
        }
      )

      errorRedirect.searchParams.set('wallet', 'failed')
      errorRedirect.searchParams.set('reason', 'cancelled')
      return NextResponse.redirect(errorRedirect.toString())
    }

    if (!verificationResult?.success) {
      if (querySuggestsSuccess || transaction.status === 'pending') {
        return NextResponse.redirect(pendingRedirect.toString())
      }

      errorRedirect.searchParams.set('wallet', 'failed')
      errorRedirect.searchParams.set('reason', 'verification_failed')
      return NextResponse.redirect(errorRedirect.toString())
    }

    if (transaction.status === 'completed') {
      successRedirect.searchParams.set('wallet', 'success')
      return NextResponse.redirect(successRedirect.toString())
    }

    const verifyStatus = String(paymentData?.status || '').toLowerCase().trim()
    const verifyExplicitSuccess = EXPLICIT_SUCCESS_STATUSES.has(verifyStatus)
    const verifyExplicitFailure = EXPLICIT_FAILURE_HINTS.has(verifyStatus)

    if (!verifyExplicitSuccess) {
      if (verifyExplicitFailure) {
        await WalletTransaction.updateOne(
          { _id: transaction._id, status: 'pending' },
          {
            $set: {
              status: 'failed',
              metadata: {
                ...(transaction.metadata || {}),
                  paystackVerification: {
                    status: paymentData?.status,
                    message: verificationResult?.message,
                  at: new Date().toISOString(),
                },
              },
              updatedAt: new Date(),
            },
          }
        )
        errorRedirect.searchParams.set('wallet', 'failed')
        errorRedirect.searchParams.set('reason', 'verification_failed')
        return NextResponse.redirect(errorRedirect.toString())
      }

      return NextResponse.redirect(pendingRedirect.toString())
    }

    const completeUpdate = await WalletTransaction.updateOne(
      { _id: transaction._id, status: 'pending' },
      {
        $set: {
          status: 'completed',
          paymentReference: resolvedReference,
          metadata: {
            ...(transaction.metadata || {}),
            paystackData: paymentData,
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

      // Send wallet top-up email notification
      try {
        const user = await User.findOne({ _id: userIdObject }, { email: 1, walletBalance: 1 })
        if (user && user.email) {
          const { sendWalletTopupEmail } = await import('@/lib/wallet-emails')
          await sendWalletTopupEmail({
            to: user.email,
            amount: transaction.amount,
            reference: transaction.reference,
            balance: typeof user.walletBalance === 'number' ? user.walletBalance : 0,
          })
        }
      } catch (emailErr) {
        console.error('[wallet/topup/callback] Failed to send top-up email:', emailErr)
      }
    }

    successRedirect.searchParams.set('wallet', 'success')
    return NextResponse.redirect(successRedirect.toString())
  } catch (error) {
    const appUrl = getCanonicalAppBaseUrl(new URL(request.url).origin)
    const errorRedirect = new URL('/stores', appUrl)
    errorRedirect.searchParams.set('wallet', 'failed')
    errorRedirect.searchParams.set('reason', 'server_error')
    return NextResponse.redirect(errorRedirect.toString())
  }
}
