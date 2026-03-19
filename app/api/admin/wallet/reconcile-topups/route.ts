import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectToDatabase } from '@/lib/mongodb'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { User } from '@/lib/models/User'
import { xoroPayService } from '@/lib/xoro-pay'

const getAdminKeyFromRequest = (request: NextRequest, body: any) => {
  return (
    request.headers.get('x-admin-key')
    || request.headers.get('x-api-key')
    || String(body?.adminKey || '').trim()
  )
}

const asStringCandidates = (...values: any[]) => {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
    )
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const adminKey = getAdminKeyFromRequest(request, body)
    const expectedAdminKey = String(process.env.ADMIN_API_KEY || '').trim()

    if (!expectedAdminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const referenceFilter = String(body?.reference || '').trim()
    const forceCreditAmountRaw = Number(body?.forceCreditAmount)
    const forceCreditAmount = Number.isFinite(forceCreditAmountRaw) && forceCreditAmountRaw > 0
      ? Math.round(forceCreditAmountRaw * 100) / 100
      : null

    const dryRun = Boolean(body?.dryRun)
    const limitRaw = Number(body?.limit)
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.floor(limitRaw)) : 50

    await connectToDatabase()

    const query: any = {
      type: 'topup',
      status: 'pending',
    }

    if (referenceFilter) {
      query.$or = [{ reference: referenceFilter }, { paymentReference: referenceFilter }]
    }

    const pendingTopups = await WalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    const results: Array<Record<string, any>> = []

    for (const tx of pendingTopups as any[]) {
      const txReference = String(tx.reference || '')
      const candidates = asStringCandidates(
        tx.paymentReference,
        tx.reference,
        tx?.metadata?.orderId,
        tx?.metadata?.orderID,
        tx?.metadata?.paymentReference,
        tx?.metadata?.payment_reference
      )

      let shouldComplete = false
      let verifiedReference = candidates[0] || txReference
      let verificationRaw: any = null
      let creditedAmount = Number(tx.amount || 0)
      let completionReason = 'verification_success'

      if (referenceFilter && forceCreditAmount !== null && txReference === referenceFilter) {
        shouldComplete = true
        creditedAmount = forceCreditAmount
        completionReason = 'manual_override'
      } else {
        for (const candidate of candidates) {
          try {
            const verification = await xoroPayService.verifyPayment(candidate)
            if (verification.success) {
              shouldComplete = true
              verifiedReference = verification.reference || candidate
              verificationRaw = verification.raw || null
              break
            }
          } catch {
            // Continue trying other candidates if one verification call fails.
          }
        }
      }

      if (!shouldComplete) {
        results.push({
          reference: txReference,
          status: 'skipped',
          reason: 'verification_failed',
        })
        continue
      }

      if (dryRun) {
        results.push({
          reference: txReference,
          status: 'dry_run',
          creditedAmount,
          reason: completionReason,
        })
        continue
      }

      const updateResult = await WalletTransaction.updateOne(
        { _id: tx._id, status: 'pending' },
        {
          $set: {
            status: 'completed',
            amount: creditedAmount,
            paymentReference: verifiedReference,
            metadata: {
              ...(tx.metadata || {}),
              xoroPayData: verificationRaw || tx?.metadata?.xoroPayData || null,
              adminReconcile: {
                reason: completionReason,
                originalAmount: Number(tx.amount || 0),
                creditedAmount,
                at: new Date().toISOString(),
              },
            },
            updatedAt: new Date(),
          },
        }
      )

      if (updateResult.modifiedCount === 0) {
        results.push({
          reference: txReference,
          status: 'skipped',
          reason: 'not_pending',
        })
        continue
      }

      const userIdObject = mongoose.Types.ObjectId.isValid(String(tx.userId))
        ? new mongoose.Types.ObjectId(String(tx.userId))
        : tx.userId

      await User.updateOne(
        { _id: userIdObject },
        {
          $inc: { walletBalance: creditedAmount },
          $set: { updatedAt: new Date() },
        }
      )

      results.push({
        reference: txReference,
        status: 'completed',
        creditedAmount,
        reason: completionReason,
      })
    }

    const completedCount = results.filter((item) => item.status === 'completed').length
    const skippedCount = results.filter((item) => item.status === 'skipped').length
    const dryRunCount = results.filter((item) => item.status === 'dry_run').length

    return NextResponse.json({
      success: true,
      summary: {
        processed: results.length,
        completed: completedCount,
        skipped: skippedCount,
        dryRun: dryRunCount,
      },
      results,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to reconcile pending topups' },
      { status: 500 }
    )
  }
}
