import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { getRecentPerformanceLogs } from '@/lib/performance-logs'

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(request.url)
    const limitParam = Number.parseInt(searchParams.get('limit') || '200', 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 10), 500) : 200

    const logs = await getRecentPerformanceLogs(limit)

    return NextResponse.json({
      success: true,
      data: logs.map((item: any) => ({
        id: item._id?.toString?.() || '',
        route: item.route,
        method: item.method,
        statusCode: item.statusCode,
        durationMs: item.durationMs,
        cacheHit: Boolean(item.cacheHit),
        metadata: item.metadata || {},
        createdAt: item.createdAt,
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch performance logs',
        data: [],
      },
      { status: 500 }
    )
  }
}
