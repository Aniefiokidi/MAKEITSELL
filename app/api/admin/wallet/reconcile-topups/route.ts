import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectToDatabase } from '@/lib/mongodb'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { User } from '@/lib/models/User'
import { paystackService } from '@/lib/payment'
import { requireAdminAccess } from '@/lib/server-route-auth'

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

const EXPLICIT_PAID_STATUSES = new Set([
  'success',
  'successful',
  'succeeded',
  'completed',
  'complete',
  'paid',
  'approved',
])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const adminKey = getAdminKeyFromRequest(request, body)
    const expectedAdminKey = String(process.env.ADMIN_API_KEY || '').trim()
    const hasValidAdminKey = Boolean(expectedAdminKey) && adminKey === expectedAdminKey

    // Kept the existing ADMIN_API_KEY header check (whatever operational tooling already
    // uses it keeps working) but also accept a standard admin session/ADMIN_SECRET, same
    // as every other admin route, so this doesn't require a separate secret to use from
    // the admin UI.
    if (!hasValidAdminKey) {
      const unauthorized = await requireAdminAccess(request)
      if (unauthorized) return unauthorized
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
            const verification = await paystackService.verifyPayment(candidate)
            const verifyStatus = String(verification.data?.status || '').trim().toLowerCase()
            if (verification.success && EXPLICIT_PAID_STATUSES.has(verifyStatus)) {
              shouldComplete = true
              verifiedReference = String(verification.data?.reference || candidate)
              verificationRaw = verification.data || null
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
              paystackData: verificationRaw || tx?.metadata?.paystackData || null,
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
