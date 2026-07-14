import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/server-route-auth'
import connectToDatabase from '@/lib/mongodb'
import { SupportQueryLog } from '@/lib/models/SupportQueryLog'

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const limitParam = Number.parseInt(searchParams.get('limit') || '50', 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 10), 200) : 50

    // Unmatched queries grouped by normalized text — these are the real FAQ gaps.
    const unmatched = await SupportQueryLog.aggregate([
      { $match: { matchedEntryId: null } },
      {
        $group: {
          _id: '$normalizedQuery',
          count: { $sum: 1 },
          lastQuery: { $last: '$query' },
          lastLang: { $last: '$lang' },
          lastSeenAt: { $max: '$createdAt' },
        },
      },
      { $sort: { count: -1, lastSeenAt: -1 } },
      { $limit: limit },
    ])

    // Which FAQ topics get asked about most — tells you what's actually load-bearing.
    const topMatched = await SupportQueryLog.aggregate([
      { $match: { matchedEntryId: { $ne: null } } },
      { $group: { _id: '$matchedEntryId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ])

    const totals = await SupportQueryLog.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unmatchedTotal: {
            $sum: { $cond: [{ $eq: ['$matchedEntryId', null] }, 1, 0] },
          },
        },
      },
    ])

    return NextResponse.json({
      success: true,
      totals: totals[0] || { total: 0, unmatchedTotal: 0 },
      unmatched: unmatched.map((row: any) => ({
        normalizedQuery: row._id,
        count: row.count,
        lastQuery: row.lastQuery,
        lastLang: row.lastLang,
        lastSeenAt: row.lastSeenAt,
      })),
      topMatched: topMatched.map((row: any) => ({
        entryId: row._id,
        count: row.count,
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch support query logs', unmatched: [], topMatched: [] },
      { status: 500 }
    )
  }
}
