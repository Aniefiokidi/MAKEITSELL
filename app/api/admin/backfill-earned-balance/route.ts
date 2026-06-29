import { NextRequest, NextResponse } from 'next/server'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'

// ONE-TIME MIGRATION ENDPOINT — Delete this file after running once.
// Sets earnedBalance = walletBalance for all existing vendors where earnedBalance is 0.
// Call with: GET /api/admin/backfill-earned-balance?secret=arnold

export async function GET(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  await connectToDatabase()

  const targets = await User.find({
    role: 'vendor',
    walletBalance: { $gt: 0 },
    $or: [
      { earnedBalance: { $exists: false } },
      { earnedBalance: 0 },
    ],
  }).select('_id walletBalance').lean() as any[]

  if (targets.length === 0) {
    return NextResponse.json({ success: true, message: 'Nothing to backfill — all vendors already have earnedBalance set.', updated: 0 })
  }

  let updated = 0
  let failed = 0
  let totalBackfilled = 0
  const results: any[] = []

  for (const vendor of targets) {
    try {
      const wallet = Number(vendor.walletBalance || 0)
      const result = await User.updateOne(
        {
          _id: vendor._id,
          role: 'vendor',
          walletBalance: { $gt: 0 },
          $or: [
            { earnedBalance: { $exists: false } },
            { earnedBalance: 0 },
          ],
        },
        { $set: { earnedBalance: wallet, updatedAt: new Date() } }
      )
      if (result.modifiedCount === 1) {
        updated++
        totalBackfilled += wallet
        results.push({ id: String(vendor._id), walletBalance: wallet, earnedBalance: wallet, status: 'updated' })
      } else {
        results.push({ id: String(vendor._id), status: 'skipped' })
      }
    } catch (err: any) {
      failed++
      results.push({ id: String(vendor._id), status: 'failed', error: err.message })
    }
  }

  return NextResponse.json({
    success: true,
    vendorsFound: targets.length,
    updated,
    failed,
    totalBackfilled,
    results,
  })
}
