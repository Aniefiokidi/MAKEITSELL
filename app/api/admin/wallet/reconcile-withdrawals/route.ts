import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { requireAdminAccess } from '@/lib/server-route-auth'

const mapTransferStatusToTxStatus = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (['success', 'successful', 'completed', 'paid', 'approved'].includes(normalized)) {
    return 'completed'
  }
  if (['failed', 'reversed', 'declined', 'cancelled', 'canceled'].includes(normalized)) {
    return 'failed'
  }
  return 'pending'
}

const pickTransferStatus = (tx: any) => {
  const rawStatus =
    tx?.metadata?.transferStatus
    || tx?.metadata?.paystackTransferRaw?.status
    || tx?.metadata?.paystackTransferRaw?.transfer_status
    || tx?.metadata?.paystackTransferRaw?.transferStatus
    || ''

  return String(rawStatus || '').trim()
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdminAccess(req)
  if (unauthorized) return unauthorized

  try {
    const body = await req.json().catch(() => ({}))
    const dryRun = Boolean(body?.dryRun)
    const limitRaw = Number(body?.limit)
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(2000, Math.floor(limitRaw)) : 500

    await connectToDatabase()

    const withdrawals = await WalletTransaction.find({
      type: 'withdrawal',
      provider: 'paystack_payout',
      status: { $in: ['pending', 'failed'] },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    let scanned = 0
    let updated = 0
    let alreadyCorrect = 0
    let skippedNoSignal = 0

    const details: Array<Record<string, any>> = []

    for (const tx of withdrawals as any[]) {
      scanned += 1

      const transferStatus = pickTransferStatus(tx)
      const mappedStatus = mapTransferStatusToTxStatus(transferStatus)

      if (!transferStatus || mappedStatus === 'pending') {
        skippedNoSignal += 1
        details.push({
          reference: String(tx.reference || ''),
          currentStatus: String(tx.status || 'pending'),
          transferStatus,
          action: 'skipped_no_signal',
        })
        continue
      }

      if (String(tx.status || '') === mappedStatus) {
        alreadyCorrect += 1
        details.push({
          reference: String(tx.reference || ''),
          currentStatus: String(tx.status || 'pending'),
          transferStatus,
          targetStatus: mappedStatus,
          action: 'already_correct',
        })
        continue
      }

      if (!dryRun) {
        const updateResult = await WalletTransaction.updateOne(
          { _id: tx._id },
          {
            $set: {
              status: mappedStatus,
              metadata: {
                ...(tx.metadata || {}),
                adminStatusReconcile: {
                  at: new Date().toISOString(),
                  reason: 'mapped_from_transfer_status',
                  fromStatus: String(tx.status || ''),
                  toStatus: mappedStatus,
                  transferStatus,
                },
              },
              updatedAt: new Date(),
            },
          }
        )

        if (updateResult.modifiedCount > 0) {
          updated += 1
        }
      }

      details.push({
        reference: String(tx.reference || ''),
        currentStatus: String(tx.status || 'pending'),
        transferStatus,
        targetStatus: mappedStatus,
        action: dryRun ? 'would_update' : 'updated',
      })
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        scanned,
        updated,
        alreadyCorrect,
        skippedNoSignal,
      },
      details,
    })
  } catch (error: any) {
    console.error('[admin/wallet/reconcile-withdrawals] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to reconcile withdrawal statuses' },
      { status: 500 }
    )
  }
}
